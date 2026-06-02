/**
 * 3가지 MVP 패치에 대한 통합 테스트
 *  - 패치 ① 예약 메일 cron 원자적 락 (중복 발송 방지)
 *  - 패치 ② 임포트 시 빈 값 덮어쓰기 방지
 *  - 패치 ③ SmtpConfig 저장-조회 정렬 일치
 *
 * 외부 SMTP는 nodemailer 모킹으로 차단. Prisma는 test.db (sqlite) 실 DB 사용.
 */

// ─── nodemailer 모킹 (실제 발송 차단) ─────────────────────────────
const mockSendMail = jest.fn();
const mockVerify = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as XLSX from 'xlsx';
import { createTestApp } from './app.helper';
import { PrismaClient } from '@prisma/client';
import { MailService } from '../src/mail/mail.service';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/test.db' } },
});

describe('[통합] MVP 패치 검증', () => {
  let app: INestApplication;
  let mailService: MailService;

  beforeAll(async () => {
    app = await createTestApp();
    mailService = app.get(MailService);

    // 깨끗한 상태로 시작
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.smtpConfig.deleteMany();
    await prisma.customer.deleteMany();

    // SMTP 설정 (모킹된 nodemailer가 받음)
    await prisma.smtpConfig.create({
      data: {
        email: 'fake@gmail.com',
        password: 'fake-pw',
        host: 'smtp.gmail.com',
        port: 587,
      },
    });
  });

  afterAll(async () => {
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.smtpConfig.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(() => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'm1' });
  });

  // ════════════════════════════════════════════════════════════════
  // 시나리오 A — 예약 메일 cron 원자적 락 (패치 ①)
  // ════════════════════════════════════════════════════════════════
  describe('시나리오 A: 예약 메일 cron 락', () => {
    beforeEach(async () => {
      await prisma.mailLog.deleteMany();
      await prisma.scheduledMail.deleteMany();
    });

    const makeDuePending = async (overrides: Partial<any> = {}) =>
      prisma.scheduledMail.create({
        data: {
          toEmail: 'a@test.com',
          subject: 'sub',
          body: 'body',
          scheduledAt: new Date(Date.now() - 1000),
          status: 'PENDING',
          ...overrides,
        },
      });

    it('A1: 만기 PENDING 1건 → cron 1회 → SENT, mailLog SUCCESS, sendMail 1회', async () => {
      const m = await makeDuePending();

      await mailService.processScheduledMails();

      const after = await prisma.scheduledMail.findUnique({ where: { id: m.id } });
      expect(after.status).toBe('SENT');
      const logs = await prisma.mailLog.findMany();
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('SUCCESS');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('A2: cron 2회 동시 실행 → sendMail 정확히 1회 (중복 발송 방지)', async () => {
      await makeDuePending({ toEmail: 'a2@test.com' });

      await Promise.all([
        mailService.processScheduledMails(),
        mailService.processScheduledMails(),
      ]);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const logs = await prisma.mailLog.findMany();
      expect(logs.filter((l) => l.status === 'SUCCESS')).toHaveLength(1);
    });

    it('A3: cron 실행 후 즉시 재실행 → 두 번째는 무시 (재발송 없음)', async () => {
      await makeDuePending({ toEmail: 'a3@test.com' });

      await mailService.processScheduledMails();
      await mailService.processScheduledMails();

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const logs = await prisma.mailLog.findMany();
      expect(logs).toHaveLength(1);
    });

    it('A4: sendMail throw → status=FAILED, mailLog FAILED with errorMessage', async () => {
      const m = await makeDuePending({ toEmail: 'a4@test.com' });
      mockSendMail.mockReset();
      mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

      await mailService.processScheduledMails();

      const after = await prisma.scheduledMail.findUnique({ where: { id: m.id } });
      expect(after.status).toBe('FAILED');
      const log = await prisma.mailLog.findFirst({ where: { toEmail: 'a4@test.com' } });
      expect(log.status).toBe('FAILED');
      expect(log.errorMessage).toBe('SMTP timeout');
    });

    it('A5: CANCELLED + 만기 → cron이 무시 (sendMail 호출 0회)', async () => {
      await makeDuePending({ toEmail: 'a5@test.com', status: 'CANCELLED' });

      await mailService.processScheduledMails();

      expect(mockSendMail).not.toHaveBeenCalled();
      const logs = await prisma.mailLog.findMany();
      expect(logs).toHaveLength(0);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 시나리오 B — 임포트 빈 값 덮어쓰기 방지 (패치 ②)
  // ════════════════════════════════════════════════════════════════
  describe('시나리오 B: 임포트 빈 값 보존', () => {
    const makeXlsx = (rows: any[][]) => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['이름', '이메일', '회사명', '직함', '메모'],
        ...rows,
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    };

    beforeEach(async () => {
      await prisma.customer.deleteMany();
    });

    it('B1: 기존 memo가 있는 고객을 빈 메모 행으로 import → memo 보존', async () => {
      await prisma.customer.create({
        data: {
          name: '김기존',
          email: 'b1@test.com',
          company: 'OldCo',
          title: 'OldT',
          memo: 'VIP 고객',
        },
      });

      const buf = makeXlsx([['김갱신', 'b1@test.com', 'NewCo', 'NewT', '']]);
      const res = await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', buf, 'test.xlsx')
        .expect(201);

      expect(res.body.created).toBe(1);
      const after = await prisma.customer.findUnique({ where: { email: 'b1@test.com' } });
      expect(after.name).toBe('김갱신');       // 갱신
      expect(after.company).toBe('NewCo');     // 갱신
      expect(after.title).toBe('NewT');        // 갱신
      expect(after.memo).toBe('VIP 고객');     // ★ 보존
    });

    it('B2: 기존 company가 있는 고객을 빈 회사 행으로 import → company 보존', async () => {
      await prisma.customer.create({
        data: { name: '김회사', email: 'b2@test.com', company: 'KeepCo' },
      });

      const buf = makeXlsx([['김회사', 'b2@test.com', '', '', '']]);
      await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', buf, 'test.xlsx')
        .expect(201);

      const after = await prisma.customer.findUnique({ where: { email: 'b2@test.com' } });
      expect(after.company).toBe('KeepCo');
    });

    it('B3: 기존 memo="old" → memo="new" 행 import → memo 갱신', async () => {
      await prisma.customer.create({
        data: { name: '김메모', email: 'b3@test.com', memo: 'old' },
      });

      const buf = makeXlsx([['김메모', 'b3@test.com', '', '', 'new']]);
      await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', buf, 'test.xlsx')
        .expect(201);

      const after = await prisma.customer.findUnique({ where: { email: 'b3@test.com' } });
      expect(after.memo).toBe('new');
    });

    it('B4: 신규 이메일 + 빈 보조필드 → row 생성 (빈 문자열 그대로)', async () => {
      const buf = makeXlsx([['김신규', 'b4@test.com', '', '', '']]);
      const res = await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', buf, 'test.xlsx')
        .expect(201);

      expect(res.body.created).toBe(1);
      const after = await prisma.customer.findUnique({ where: { email: 'b4@test.com' } });
      expect(after).toBeTruthy();
      expect(after.name).toBe('김신규');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // 시나리오 C — SMTP 저장-조회 정렬 일치 (패치 ③)
  // ════════════════════════════════════════════════════════════════
  describe('시나리오 C: SmtpConfig 저장-조회 정렬 일치', () => {
    beforeEach(async () => {
      await prisma.smtpConfig.deleteMany();
    });

    afterAll(async () => {
      // 다음 테스트 묶음을 위해 SMTP 재설정
      await prisma.smtpConfig.deleteMany();
      await prisma.smtpConfig.create({
        data: { email: 'fake@gmail.com', password: 'fake-pw', host: 'smtp.gmail.com', port: 587 },
      });
    });

    it('C1: 행 2개(오래된 vs 최근) 상태에서 저장 → 최신 행이 갱신됨', async () => {
      // 오래된 행
      const older = await prisma.smtpConfig.create({
        data: { email: 'old@gmail.com', password: 'p1', host: 'smtp.gmail.com', port: 587 },
      });
      // 시간차를 확실히 벌려 updatedAt 정렬이 안정적이도록
      await new Promise((r) => setTimeout(r, 1100));
      // 최근 행
      const newer = await prisma.smtpConfig.create({
        data: { email: 'newer@gmail.com', password: 'p2', host: 'smtp.gmail.com', port: 587 },
      });

      // 정렬 검증 (디버그 안전망)
      const sorted = await prisma.smtpConfig.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      expect(sorted[0].id).toBe(newer.id);

      // 갱신 시도
      const res = await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({ email: 'updated@gmail.com', password: 'pNew' })
        .expect(201);

      // 응답이 최근 행을 가리켜야 함
      expect(res.body.id).toBe(newer.id);
      expect(res.body.email).toBe('updated@gmail.com');

      // 오래된 행은 그대로
      const stillOld = await prisma.smtpConfig.findUnique({ where: { id: older.id } });
      expect(stillOld.email).toBe('old@gmail.com');
    });

    it('C2: 저장 후 GET status가 최신 행을 반환한다', async () => {
      await prisma.smtpConfig.create({
        data: { email: 'old@gmail.com', password: 'p', host: 'smtp.gmail.com', port: 587 },
      });
      // 저장
      await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({ email: 'latest@gmail.com', password: 'pp' })
        .expect(201);

      const status = await request(app.getHttpServer())
        .get('/api/mail/smtp/status')
        .expect(200);
      expect(status.body.connected).toBe(true);
      expect(status.body.email).toBe('latest@gmail.com');
    });

    it('C3: 행 0개 → POST → create 1건, GET status connected:true', async () => {
      await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({ email: 'first@gmail.com', password: 'pw' })
        .expect(201);

      const all = await prisma.smtpConfig.findMany();
      expect(all).toHaveLength(1);

      const status = await request(app.getHttpServer())
        .get('/api/mail/smtp/status')
        .expect(200);
      expect(status.body.connected).toBe(true);
      expect(status.body.email).toBe('first@gmail.com');
    });
  });
});
