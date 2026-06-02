import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { SmtpConfigDto } from './dto/smtp-config.dto';
import { SendMailDto } from './dto/send-mail.dto';
import { ScheduleMailDto } from './dto/schedule-mail.dto';

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  // SMTP 트랜스포터 생성
  private async createTransporter() {
    const config = await this.prisma.smtpConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!config) {
      throw new BadRequestException(
        'SMTP 설정이 없습니다. 먼저 구글 계정을 연결해주세요.',
      );
    }
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: {
        user: config.email,
        pass: config.password,
      },
    });
  }

  // 기능 09: SMTP 설정 저장/업데이트
  async saveSmtpConfig(dto: SmtpConfigDto) {
    // 조회 측(createTransporter)과 동일한 정렬을 사용해야 같은 행을 갱신함
    const existing = await this.prisma.smtpConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const data = {
      email: dto.email,
      password: dto.password,
      host: dto.host || 'smtp.gmail.com',
      port: dto.port || 587,
    };

    if (existing) {
      return this.prisma.smtpConfig.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.smtpConfig.create({ data });
  }

  // 기능 09: SMTP 연결 상태 조회
  async getSmtpStatus() {
    const config = await this.prisma.smtpConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    if (!config) return { connected: false, email: null };
    return {
      connected: true,
      email: config.email,
      host: config.host,
      port: config.port,
      updatedAt: config.updatedAt,
    };
  }

  // 기능 09: SMTP 연결 테스트
  async testSmtpConnection() {
    try {
      const transporter = await this.createTransporter();
      await transporter.verify();
      return { success: true, message: 'SMTP 연결이 성공적으로 확인되었습니다.' };
    } catch (err) {
      throw new BadRequestException(`SMTP 연결 실패: ${err.message}`);
    }
  }

  // 기능 12: 즉시 메일 발송
  async sendNow(dto: SendMailDto) {
    try {
      const transporter = await this.createTransporter();
      await transporter.sendMail({
        to: dto.toEmail,
        subject: dto.subject,
        text: dto.body,
        html: dto.body.replace(/\n/g, '<br>'),
      });

      // 발송 기록 저장
      const log = await this.prisma.mailLog.create({
        data: {
          customerId: dto.customerId || null,
          toEmail: dto.toEmail,
          subject: dto.subject,
          body: dto.body,
          status: 'SUCCESS',
        },
      });

      return { success: true, logId: log.id, sentAt: log.sentAt };
    } catch (err) {
      // 실패 기록도 저장
      await this.prisma.mailLog.create({
        data: {
          customerId: dto.customerId || null,
          toEmail: dto.toEmail,
          subject: dto.subject,
          body: dto.body,
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      throw new InternalServerErrorException(`메일 발송 실패: ${err.message}`);
    }
  }

  // 기능 10: 메일 예약 발송
  async scheduleMail(dto: ScheduleMailDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('예약 시간은 현재 시간 이후여야 합니다.');
    }

    return this.prisma.scheduledMail.create({
      data: {
        customerId: dto.customerId || null,
        toEmail: dto.toEmail,
        subject: dto.subject,
        body: dto.body,
        scheduledAt,
        status: 'PENDING',
      },
    });
  }

  // 기능 11: 예약된 메일 목록 조회
  async getScheduledMails() {
    return this.prisma.scheduledMail.findMany({
      where: { status: 'PENDING' },
      include: { customer: { select: { name: true, company: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // 기능 11: 예약 취소
  async cancelScheduledMail(id: number) {
    const mail = await this.prisma.scheduledMail.findUnique({ where: { id } });
    if (!mail) throw new NotFoundException(`예약 메일을 찾을 수 없습니다: ID ${id}`);
    if (mail.status !== 'PENDING') {
      throw new BadRequestException(`취소할 수 없는 상태입니다: ${mail.status}`);
    }
    return this.prisma.scheduledMail.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // 기능 12: 발송 기록 조회
  async getMailLogs() {
    return this.prisma.mailLog.findMany({
      include: { customer: { select: { name: true, company: true } } },
      orderBy: { sentAt: 'desc' },
    });
  }

  // 기능 12: 발송 기록 단건 조회 (상세 보기)
  async getMailLogDetail(id: number) {
    const log = await this.prisma.mailLog.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!log) throw new NotFoundException(`발송 기록을 찾을 수 없습니다: ID ${id}`);
    return log;
  }

  // 매 분마다 예약된 메일 발송 처리 (기능 10)
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledMails() {
    const now = new Date();
    const pendingMails = await this.prisma.scheduledMail.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
    });

    for (const mail of pendingMails) {
      // PENDING → SENDING으로 원자적 전환. 다른 tick이 이미 잡았다면 count=0 → 스킵.
      // 이전 tick이 처리 중에 살아있다면 SENDING 상태로 남아있으므로 재발송되지 않음.
      const claimed = await this.prisma.scheduledMail.updateMany({
        where: { id: mail.id, status: 'PENDING' },
        data: { status: 'SENDING' },
      });
      if (claimed.count === 0) continue;

      try {
        const transporter = await this.createTransporter();
        await transporter.sendMail({
          to: mail.toEmail,
          subject: mail.subject,
          text: mail.body,
          html: mail.body.replace(/\n/g, '<br>'),
        });

        // 예약 메일 상태 업데이트
        await this.prisma.scheduledMail.update({
          where: { id: mail.id },
          data: { status: 'SENT' },
        });

        // 발송 기록 생성
        await this.prisma.mailLog.create({
          data: {
            customerId: mail.customerId,
            toEmail: mail.toEmail,
            subject: mail.subject,
            body: mail.body,
            status: 'SUCCESS',
          },
        });

        console.log(`✅ 예약 메일 발송 완료: ID ${mail.id} → ${mail.toEmail}`);
      } catch (err) {
        await this.prisma.scheduledMail.update({
          where: { id: mail.id },
          data: { status: 'FAILED' },
        });
        await this.prisma.mailLog.create({
          data: {
            customerId: mail.customerId,
            toEmail: mail.toEmail,
            subject: mail.subject,
            body: mail.body,
            status: 'FAILED',
            errorMessage: err.message,
          },
        });
        console.error(`❌ 예약 메일 발송 실패: ID ${mail.id} - ${err.message}`);
      }
    }
  }
}
