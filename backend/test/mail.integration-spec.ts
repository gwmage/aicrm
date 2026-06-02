import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './app.helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/test.db' } },
});

const SMTP_EMAIL = 'gwmage12@gmail.com';
const SMTP_PASSWORD = 'czaz klcv dyid iyku';
const TEST_RECIPIENT = 'gwmage12@gmail.com';

describe('[통합] MailModule', () => {
  let app: INestApplication;
  let testCustomerId: number;
  let scheduledMailId: number;

  beforeAll(async () => {
    app = await createTestApp();

    // 초기 정리
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.smtpConfig.deleteMany();
    await prisma.customer.deleteMany({ where: { email: { endsWith: '@integration.test' } } });

    // 테스트용 고객 생성
    const customer = await prisma.customer.create({
      data: {
        name: '통합테스트 고객',
        email: TEST_RECIPIENT,
        company: '테스트컴퍼니',
        title: '테스트',
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.smtpConfig.deleteMany();
    await prisma.customer.deleteMany({ where: { email: TEST_RECIPIENT } });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── SMTP 설정 ────────────────────────────────────────────────
  describe('SMTP 설정', () => {
    it('GET /api/mail/smtp/status — SMTP 미설정 시 connected: false 반환', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mail/smtp/status')
        .expect(200);

      expect(res.body.connected).toBe(false);
      expect(res.body.email).toBeNull();
    });

    it('POST /api/mail/smtp — 이메일/비밀번호 없이 요청하면 400 반환', async () => {
      await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({})
        .expect(400);
    });

    it('POST /api/mail/smtp — Gmail 설정을 저장한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({ email: SMTP_EMAIL, password: SMTP_PASSWORD })
        .expect(201);

      expect(res.body.email).toBe(SMTP_EMAIL);
      expect(res.body.host).toBe('smtp.gmail.com');
      expect(res.body.port).toBe(587);
    });

    it('GET /api/mail/smtp/status — 설정 저장 후 connected: true 반환', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mail/smtp/status')
        .expect(200);

      expect(res.body.connected).toBe(true);
      expect(res.body.email).toBe(SMTP_EMAIL);
    });

    it('POST /api/mail/smtp — 기존 설정 업데이트 (같은 계정 재설정)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mail/smtp')
        .send({ email: SMTP_EMAIL, password: SMTP_PASSWORD, host: 'smtp.gmail.com', port: 587 })
        .expect(201);

      expect(res.body.email).toBe(SMTP_EMAIL);
    });

    it('POST /api/mail/smtp/test — 실제 SMTP 연결 테스트 성공', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mail/smtp/test')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeTruthy();
    }, 15000);
  });

  // ─── 메일 즉시 발송 ────────────────────────────────────────────
  describe('POST /api/mail/send — 실제 메일 발송', () => {
    it('200: 메일을 즉시 발송하고 발송 로그를 저장한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/mail/send')
        .send({
          toEmail: TEST_RECIPIENT,
          subject: '[통합테스트] AI CRM 메일 발송 테스트',
          body: `안녕하세요.\n\n이 메일은 AI CRM 시스템의 통합 테스트 발송입니다.\n발송 시각: ${new Date().toLocaleString('ko-KR')}\n\n정상 수신되었다면 테스트 성공입니다.`,
          customerId: testCustomerId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.logId).toBeDefined();
      expect(res.body.sentAt).toBeDefined();

      // DB에 SUCCESS 로그가 저장됐는지 확인
      const log = await prisma.mailLog.findUnique({ where: { id: res.body.logId } });
      expect(log).toBeTruthy();
      expect(log.status).toBe('SUCCESS');
      expect(log.toEmail).toBe(TEST_RECIPIENT);
    }, 20000);

    it('400: SMTP 미설정 상태에서 발송 시 예외를 반환한다', async () => {
      // 임시로 SMTP 설정 삭제
      await prisma.smtpConfig.deleteMany();

      await request(app.getHttpServer())
        .post('/api/mail/send')
        .send({ toEmail: TEST_RECIPIENT, subject: '테스트', body: '본문' })
        .expect((res) => {
          expect([400, 500]).toContain(res.status);
        });

      // 테스트 후 SMTP 재설정
      await prisma.smtpConfig.create({
        data: {
          email: SMTP_EMAIL,
          password: SMTP_PASSWORD,
          host: 'smtp.gmail.com',
          port: 587,
        },
      });
    });
  });

  // ─── 메일 예약 ────────────────────────────────────────────────
  describe('POST /api/mail/schedule — 메일 예약', () => {
    it('201: 미래 시간으로 메일을 예약한다', async () => {
      const scheduledAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1시간 후

      const res = await request(app.getHttpServer())
        .post('/api/mail/schedule')
        .send({
          toEmail: TEST_RECIPIENT,
          subject: '[통합테스트] 예약 발송 테스트',
          body: '이 메일은 예약 발송 테스트입니다.',
          scheduledAt,
          customerId: testCustomerId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
      expect(res.body.toEmail).toBe(TEST_RECIPIENT);
      scheduledMailId = res.body.id;
    });

    it('400: 현재 시간 이전으로 예약하면 400을 반환한다', async () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();

      await request(app.getHttpServer())
        .post('/api/mail/schedule')
        .send({
          toEmail: TEST_RECIPIENT,
          subject: '과거 예약',
          body: '본문',
          scheduledAt: pastTime,
        })
        .expect(400);
    });

    it('400: 필수 필드 누락 시 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/mail/schedule')
        .send({ toEmail: TEST_RECIPIENT })
        .expect(400);
    });
  });

  // ─── 예약 메일 목록 조회 ────────────────────────────────────────
  describe('GET /api/mail/scheduled — 예약 목록', () => {
    it('200: PENDING 상태의 예약 메일 목록을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mail/scheduled')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].status).toBe('PENDING');
    });
  });

  // ─── 예약 취소 ────────────────────────────────────────────────
  describe('DELETE /api/mail/scheduled/:id — 예약 취소', () => {
    it('200: PENDING 예약을 취소하고 CANCELLED 상태를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/mail/scheduled/${scheduledMailId}`)
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.id).toBe(scheduledMailId);
    });

    it('400: 이미 취소된 예약을 다시 취소하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .delete(`/api/mail/scheduled/${scheduledMailId}`)
        .expect(400);
    });

    it('404: 존재하지 않는 예약 취소 시 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .delete('/api/mail/scheduled/99999')
        .expect(404);
    });
  });

  // ─── 발송 기록 ────────────────────────────────────────────────
  describe('GET /api/mail/logs — 발송 기록 목록', () => {
    it('200: 발송 기록 목록을 최신순으로 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mail/logs')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // 최신순 정렬 확인
      if (res.body.length >= 2) {
        const first = new Date(res.body[0].sentAt).getTime();
        const second = new Date(res.body[1].sentAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('200: 각 로그에 status 필드가 있다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/mail/logs')
        .expect(200);

      res.body.forEach((log: any) => {
        expect(['SUCCESS', 'FAILED']).toContain(log.status);
      });
    });
  });

  describe('GET /api/mail/logs/:id — 발송 기록 상세', () => {
    let logId: number;

    beforeAll(async () => {
      const logs = await prisma.mailLog.findFirst({ orderBy: { sentAt: 'desc' } });
      logId = logs.id;
    });

    it('200: 특정 발송 기록 상세를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/mail/logs/${logId}`)
        .expect(200);

      expect(res.body.id).toBe(logId);
      expect(res.body.toEmail).toBeDefined();
      expect(res.body.subject).toBeDefined();
      expect(res.body.body).toBeDefined();
    });

    it('404: 존재하지 않는 로그 ID면 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/api/mail/logs/99999')
        .expect(404);
    });
  });
});
