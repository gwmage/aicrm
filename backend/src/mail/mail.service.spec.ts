
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── nodemailer 모킹 ─────────────────────────────────────────
const mockSendMail = jest.fn();
const mockVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

// ─── PrismaService 모킹 ───────────────────────────────────────
const mockPrisma = {
  smtpConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  mailLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  scheduledMail: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockSmtpConfig = {
  id: 1,
  email: 'sender@gmail.com',
  password: 'app-password',
  host: 'smtp.gmail.com',
  port: 587,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMailLog = {
  id: 100,
  customerId: null,
  toEmail: 'hong@test.com',
  subject: '테스트 제목',
  body: '테스트 본문',
  sentAt: new Date(),
  status: 'SUCCESS',
  errorMessage: null,
};

const mockScheduledMail = {
  id: 10,
  customerId: 1,
  toEmail: 'hong@test.com',
  subject: '예약 메일',
  body: '예약 본문',
  scheduledAt: new Date(Date.now() + 86400000),
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  // ─── SMTP 설정 ───────────────────────────────────────────────
  describe('saveSmtpConfig()', () => {
    it('기존 설정이 없으면 새로 생성한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);
      mockPrisma.smtpConfig.create.mockResolvedValue(mockSmtpConfig);

      const result = await service.saveSmtpConfig({
        email: 'sender@gmail.com',
        password: 'app-password',
      });

      expect(mockPrisma.smtpConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'sender@gmail.com',
          host: 'smtp.gmail.com',
          port: 587,
        }),
      });
      expect(result).toEqual(mockSmtpConfig);
    });

    it('기존 설정이 있으면 업데이트한다', async () => {
      const updated = { ...mockSmtpConfig, email: 'new@gmail.com' };
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockPrisma.smtpConfig.update.mockResolvedValue(updated);

      const result = await service.saveSmtpConfig({
        email: 'new@gmail.com',
        password: 'new-password',
      });

      expect(mockPrisma.smtpConfig.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ email: 'new@gmail.com' }),
      });
      expect(result.email).toBe('new@gmail.com');
    });

    it('host/port 기본값을 사용한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);
      mockPrisma.smtpConfig.create.mockResolvedValue(mockSmtpConfig);

      await service.saveSmtpConfig({ email: 'test@gmail.com', password: 'pw' });

      const createCall = mockPrisma.smtpConfig.create.mock.calls[0][0];
      expect(createCall.data.host).toBe('smtp.gmail.com');
      expect(createCall.data.port).toBe(587);
    });

    // [패치 ③] 저장 측의 findFirst가 조회 측(createTransporter)과 동일한
    // 정렬(updatedAt desc)을 사용해야 같은 행을 갱신할 수 있다.
    it('findFirst 조회 시 orderBy: updatedAt desc 를 사용한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockPrisma.smtpConfig.update.mockResolvedValue(mockSmtpConfig);

      await service.saveSmtpConfig({ email: 'a@gmail.com', password: 'p' });

      expect(mockPrisma.smtpConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
    });

    it('SmtpConfig 행이 여러 개일 때 가장 최근 행을 갱신한다', async () => {
      const newer = { ...mockSmtpConfig, id: 7, updatedAt: new Date() };
      // findFirst가 정렬을 따르므로 newer를 반환한다고 가정
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(newer);
      mockPrisma.smtpConfig.update.mockResolvedValue(newer);

      await service.saveSmtpConfig({ email: 'x@gmail.com', password: 'p' });

      expect(mockPrisma.smtpConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7 } }),
      );
    });
  });

  describe('getSmtpStatus()', () => {
    it('설정이 있으면 connected: true를 반환한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);

      const result = await service.getSmtpStatus();

      expect(result.connected).toBe(true);
      expect(result.email).toBe('sender@gmail.com');
    });

    it('설정이 없으면 connected: false를 반환한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);

      const result = await service.getSmtpStatus();

      expect(result.connected).toBe(false);
      expect(result.email).toBeNull();
    });
  });

  describe('testSmtpConnection()', () => {
    it('연결 성공 시 success: true를 반환한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockVerify.mockResolvedValue(true);

      const result = await service.testSmtpConnection();

      expect(result.success).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('SMTP 설정이 없으면 BadRequestException을 던진다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);

      await expect(service.testSmtpConnection()).rejects.toThrow(BadRequestException);
    });

    it('연결 실패 시 BadRequestException을 던진다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockVerify.mockRejectedValue(new Error('Connection refused'));

      await expect(service.testSmtpConnection()).rejects.toThrow(BadRequestException);
    });
  });

  // ─── 메일 발송 ───────────────────────────────────────────────
  describe('sendNow()', () => {
    it('SMTP 발송 성공 시 SUCCESS 로그를 저장하고 반환한다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockSendMail.mockResolvedValue({ messageId: 'abc123' });
      mockPrisma.mailLog.create.mockResolvedValue({ ...mockMailLog, status: 'SUCCESS' });

      const result = await service.sendNow({
        toEmail: 'hong@test.com',
        subject: '테스트 제목',
        body: '테스트 본문',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'hong@test.com',
          subject: '테스트 제목',
        }),
      );
      expect(mockPrisma.mailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESS' }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.logId).toBe(100);
    });

    it('SMTP 발송 실패 시 FAILED 로그를 저장하고 예외를 던진다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockSendMail.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.mailLog.create.mockResolvedValue({ ...mockMailLog, status: 'FAILED' });

      await expect(
        service.sendNow({ toEmail: 'hong@test.com', subject: '제목', body: '본문' }),
      ).rejects.toThrow();

      // FAILED 로그는 저장되어야 함
      expect(mockPrisma.mailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('SMTP 설정이 없으면 예외를 던진다', async () => {
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.sendNow({ toEmail: 'hong@test.com', subject: '제목', body: '본문' }),
      ).rejects.toThrow();

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // ─── 예약 발송 ───────────────────────────────────────────────
  describe('scheduleMail()', () => {
    it('미래 시간으로 예약 메일을 생성한다', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      mockPrisma.scheduledMail.create.mockResolvedValue({ ...mockScheduledMail, scheduledAt: new Date(futureTime) });

      const result = await service.scheduleMail({
        toEmail: 'hong@test.com',
        subject: '예약 메일',
        body: '본문',
        scheduledAt: futureTime,
      });

      expect(mockPrisma.scheduledMail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            toEmail: 'hong@test.com',
          }),
        }),
      );
      expect(result.status).toBe('PENDING');
    });

    it('현재 시간 이전의 scheduledAt은 BadRequestException을 던진다', async () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();

      await expect(
        service.scheduleMail({
          toEmail: 'hong@test.com',
          subject: '과거 예약',
          body: '본문',
          scheduledAt: pastTime,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.scheduledMail.create).not.toHaveBeenCalled();
    });
  });

  // ─── 예약 목록 / 취소 ────────────────────────────────────────
  describe('getScheduledMails()', () => {
    it('PENDING 상태의 예약 메일 목록을 반환한다', async () => {
      const mails = [mockScheduledMail];
      mockPrisma.scheduledMail.findMany.mockResolvedValue(mails);

      const result = await service.getScheduledMails();

      expect(mockPrisma.scheduledMail.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        }),
      );
      expect(result).toEqual(mails);
    });
  });

  describe('cancelScheduledMail()', () => {
    it('PENDING 상태의 예약 메일을 취소한다', async () => {
      const cancelled = { ...mockScheduledMail, status: 'CANCELLED' };
      mockPrisma.scheduledMail.findUnique.mockResolvedValue(mockScheduledMail);
      mockPrisma.scheduledMail.update.mockResolvedValue(cancelled);

      const result = await service.cancelScheduledMail(10);

      expect(mockPrisma.scheduledMail.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { status: 'CANCELLED' },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('존재하지 않는 예약이면 NotFoundException을 던진다', async () => {
      mockPrisma.scheduledMail.findUnique.mockResolvedValue(null);

      await expect(service.cancelScheduledMail(999)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.scheduledMail.update).not.toHaveBeenCalled();
    });

    it('이미 취소된 예약이면 BadRequestException을 던진다', async () => {
      mockPrisma.scheduledMail.findUnique.mockResolvedValue({
        ...mockScheduledMail,
        status: 'CANCELLED',
      });

      await expect(service.cancelScheduledMail(10)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── 발송 기록 ───────────────────────────────────────────────
  describe('getMailLogs()', () => {
    it('발송 기록 목록을 최신순으로 반환한다', async () => {
      const logs = [mockMailLog];
      mockPrisma.mailLog.findMany.mockResolvedValue(logs);

      const result = await service.getMailLogs();

      expect(mockPrisma.mailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sentAt: 'desc' },
        }),
      );
      expect(result).toEqual(logs);
    });
  });

  describe('getMailLogDetail()', () => {
    it('존재하는 로그 ID로 상세 기록을 반환한다', async () => {
      mockPrisma.mailLog.findUnique.mockResolvedValue({ ...mockMailLog, customer: null });

      const result = await service.getMailLogDetail(100);

      expect(mockPrisma.mailLog.findUnique).toHaveBeenCalledWith({
        where: { id: 100 },
        include: { customer: true },
      });
      expect(result.id).toBe(100);
    });

    it('존재하지 않는 ID면 NotFoundException을 던진다', async () => {
      mockPrisma.mailLog.findUnique.mockResolvedValue(null);

      await expect(service.getMailLogDetail(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── [패치 ①] 예약 메일 cron 락 ─────────────────────────────────
  // PENDING → SENDING 원자적 전환 후에만 실제 발송한다. updateMany.count===0이면
  // 다른 tick이 이미 가져갔으므로 sendMail을 호출하지 않는다.
  describe('processScheduledMails() - 원자적 락', () => {
    const dueMail = {
      ...mockScheduledMail,
      scheduledAt: new Date(Date.now() - 1000), // 만기
      status: 'PENDING',
    };

    it('updateMany가 행을 잠근 경우(count=1)에만 sendMail을 호출하고 SENT로 마킹한다', async () => {
      mockPrisma.scheduledMail.findMany.mockResolvedValue([dueMail]);
      mockPrisma.scheduledMail.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockSendMail.mockResolvedValue({ messageId: 'm1' });
      mockPrisma.scheduledMail.update.mockResolvedValue({ ...dueMail, status: 'SENT' });
      mockPrisma.mailLog.create.mockResolvedValue(mockMailLog);

      await service.processScheduledMails();

      // 락 성공 호출
      expect(mockPrisma.scheduledMail.updateMany).toHaveBeenCalledWith({
        where: { id: dueMail.id, status: 'PENDING' },
        data: { status: 'SENDING' },
      });
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      // 발송 후 SENT로 전환
      expect(mockPrisma.scheduledMail.update).toHaveBeenCalledWith({
        where: { id: dueMail.id },
        data: { status: 'SENT' },
      });
      // 발송 기록도 생성
      expect(mockPrisma.mailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCESS', toEmail: dueMail.toEmail }),
        }),
      );
    });

    it('updateMany.count===0 (다른 tick이 이미 잡음)이면 sendMail을 호출하지 않고 스킵한다', async () => {
      mockPrisma.scheduledMail.findMany.mockResolvedValue([dueMail]);
      mockPrisma.scheduledMail.updateMany.mockResolvedValue({ count: 0 });

      await service.processScheduledMails();

      expect(mockPrisma.scheduledMail.updateMany).toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(mockPrisma.scheduledMail.update).not.toHaveBeenCalled();
      expect(mockPrisma.mailLog.create).not.toHaveBeenCalled();
    });

    it('두 tick이 동시에 실행돼도 한 쪽만 sendMail을 호출한다 (중복 발송 방지)', async () => {
      mockPrisma.scheduledMail.findMany.mockResolvedValue([dueMail]);
      // 첫 호출은 락 획득(count=1), 두 번째는 실패(count=0)
      mockPrisma.scheduledMail.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockSendMail.mockResolvedValue({ messageId: 'm1' });
      mockPrisma.scheduledMail.update.mockResolvedValue({ ...dueMail, status: 'SENT' });
      mockPrisma.mailLog.create.mockResolvedValue(mockMailLog);

      // 두 tick을 동시에 실행
      await Promise.all([service.processScheduledMails(), service.processScheduledMails()]);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('sendMail이 실패하면 FAILED로 마킹하고 FAILED 로그를 남긴다', async () => {
      mockPrisma.scheduledMail.findMany.mockResolvedValue([dueMail]);
      mockPrisma.scheduledMail.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.smtpConfig.findFirst.mockResolvedValue(mockSmtpConfig);
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));
      mockPrisma.scheduledMail.update.mockResolvedValue({ ...dueMail, status: 'FAILED' });
      mockPrisma.mailLog.create.mockResolvedValue({ ...mockMailLog, status: 'FAILED' });

      await service.processScheduledMails();

      expect(mockPrisma.scheduledMail.update).toHaveBeenCalledWith({
        where: { id: dueMail.id },
        data: { status: 'FAILED' },
      });
      expect(mockPrisma.mailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED', errorMessage: 'SMTP timeout' }),
        }),
      );
    });
  });
});
