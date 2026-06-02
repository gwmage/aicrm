import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './app.helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/test.db' } },
});

describe('[통합] AiModule — 실제 Claude API', () => {
  let app: INestApplication;
  let testCustomerId: number;

  beforeAll(async () => {
    app = await createTestApp();

    // AI 테스트용 고객 생성
    const customer = await prisma.customer.create({
      data: {
        name: '홍길동',
        email: 'ai-test@integration.test',
        company: '테크코리아',
        title: 'CTO',
        memo: '엔터프라이즈 라이선스 도입 검토 중',
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: { endsWith: '@integration.test' } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ─── 이메일 초안 생성 ──────────────────────────────────────────
  describe('POST /api/ai/draft', () => {
    it('200: 고객 정보를 기반으로 이메일 초안을 생성한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .send({ customerId: testCustomerId })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
      // 고객 이름이나 회사명이 포함되어야 함
      const combined = res.body.subject + res.body.body;
      expect(combined).toMatch(/홍길동|테크코리아|CTO/);
    }, 30000);

    it('200: additionalContext를 포함한 초안을 생성한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .send({ customerId: testCustomerId, additionalContext: '신제품 발표회 초대' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
    }, 30000);

    it('404: 존재하지 않는 고객 ID면 404를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .send({ customerId: 99999 })
        .expect(404);

      expect(res.body.message).toBeDefined();
    });

    it('400: customerId 없이 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/draft')
        .send({})
        .expect(400);
    });
  });

  // ─── 말투 변환 ────────────────────────────────────────────────
  describe('POST /api/ai/tone', () => {
    const baseSubject = '미팅 요청드립니다';
    const baseBody = '안녕하세요. 다음 주 미팅이 가능하신지 여쭤보고 싶습니다.';

    it('200: formal 말투로 변환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/tone')
        .send({ subject: baseSubject, body: baseBody, tone: 'formal' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
      // 격식체 특징 확인
      expect(res.body.body.length).toBeGreaterThan(10);
    }, 30000);

    it('200: casual 말투로 변환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/tone')
        .send({ subject: baseSubject, body: baseBody, tone: 'casual' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
    }, 30000);

    it('400: tone 없이 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/tone')
        .send({ subject: baseSubject, body: baseBody })
        .expect(400);
    });

    it('400: subject/body 없이 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/tone')
        .send({ tone: 'formal' })
        .expect(400);
    });
  });

  // ─── 번역 ─────────────────────────────────────────────────────
  describe('POST /api/ai/translate', () => {
    const subject = '엔터프라이즈 라이선스 안내';
    const body = '안녕하세요. 저희 솔루션의 엔터프라이즈 라이선스에 관심 가져주셔서 감사합니다.';

    it('200: 영어로 번역한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/translate')
        .send({ subject, body, targetLanguage: 'English' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
      // 영어 문자 포함 여부 확인
      expect(res.body.subject).toMatch(/[a-zA-Z]/);
    }, 30000);

    it('200: 일본어로 번역한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/translate')
        .send({ subject, body, targetLanguage: 'Japanese' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
      // 일본어 문자(히라가나/가타카나/한자) 포함 여부
      expect(res.body.body).toMatch(/[\u3040-\u30FF\u4E00-\u9FAF]/);
    }, 30000);

    it('200: 중국어로 번역한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ai/translate')
        .send({ subject, body, targetLanguage: 'Chinese' })
        .expect(200);

      expect(res.body.subject).toBeTruthy();
      expect(res.body.body).toBeTruthy();
    }, 30000);

    it('400: targetLanguage 없이 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/translate')
        .send({ subject, body })
        .expect(400);
    });
  });
});
