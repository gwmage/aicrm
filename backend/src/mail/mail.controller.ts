import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { SmtpConfigDto } from './dto/smtp-config.dto';
import { SendMailDto } from './dto/send-mail.dto';
import { ScheduleMailDto } from './dto/schedule-mail.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // ─── SMTP 설정 (기능 09) ─────────────────────────────────────────

  // POST /api/mail/smtp - SMTP 계정 저장/업데이트
  @Post('smtp')
  saveSmtpConfig(@Body() dto: SmtpConfigDto) {
    return this.mailService.saveSmtpConfig(dto);
  }

  // GET /api/mail/smtp/status - SMTP 연결 상태 조회
  @Get('smtp/status')
  getSmtpStatus() {
    return this.mailService.getSmtpStatus();
  }

  // POST /api/mail/smtp/test - SMTP 연결 테스트
  @Post('smtp/test')
  @HttpCode(HttpStatus.OK)
  testSmtpConnection() {
    return this.mailService.testSmtpConnection();
  }

  // ─── 메일 발송 ───────────────────────────────────────────────────

  // POST /api/mail/send - 즉시 발송 (기능 12)
  @Post('send')
  @HttpCode(HttpStatus.OK)
  sendNow(@Body() dto: SendMailDto) {
    return this.mailService.sendNow(dto);
  }

  // POST /api/mail/schedule - 예약 발송 (기능 10)
  @Post('schedule')
  @HttpCode(HttpStatus.CREATED)
  scheduleMail(@Body() dto: ScheduleMailDto) {
    return this.mailService.scheduleMail(dto);
  }

  // ─── 예약 메일 관리 (기능 11) ────────────────────────────────────

  // GET /api/mail/scheduled - 예약 대기 목록
  @Get('scheduled')
  getScheduledMails() {
    return this.mailService.getScheduledMails();
  }

  // DELETE /api/mail/scheduled/:id - 예약 취소
  @Delete('scheduled/:id')
  @HttpCode(HttpStatus.OK)
  cancelScheduledMail(@Param('id', ParseIntPipe) id: number) {
    return this.mailService.cancelScheduledMail(id);
  }

  // ─── 발송 기록 (기능 12) ─────────────────────────────────────────

  // GET /api/mail/logs - 발송 기록 목록
  @Get('logs')
  getMailLogs() {
    return this.mailService.getMailLogs();
  }

  // GET /api/mail/logs/:id - 발송 기록 상세
  @Get('logs/:id')
  getMailLogDetail(@Param('id', ParseIntPipe) id: number) {
    return this.mailService.getMailLogDetail(id);
  }
}
