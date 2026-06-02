import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './app.helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/test.db' } },
});

describe('[통합] CustomersModule', () => {
  let app: INestApplication;
  let createdId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    await prisma.mailLog.deleteMany();
    await prisma.scheduledMail.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.$disconnect();
    await app.close();
  });

  // ─── 고객 생성 ────────────────────────────────────────────────
  describe('POST /api/customers', () => {
    it('201: 유효한 데이터로 고객을 생성한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .send({ name: '홍길동', email: 'hong@integration.test', company: '테크코리아', title: 'CTO' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('홍길동');
      expect(res.body.email).toBe('hong@integration.test');
      expect(res.body.company).toBe('테크코리아');
      expect(res.body.createdAt).toBeDefined();
      createdId = res.body.id;
    });

    it('201: 선택 필드(company, title, memo) 없이도 생성된다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .send({ name: '김미나', email: 'mina@integration.test' })
        .expect(201);

      expect(res.body.company).toBeNull();
      expect(res.body.title).toBeNull();
    });

    it('400: 이름 없이 제출하면 오류를 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .send({ email: 'noname@integration.test' })
        .expect(400);
    });

    it('400: 이메일 없이 제출하면 오류를 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/api/customers')
        .send({ name: '이름만' })
        .expect(400);
    });

    it('409: 중복 이메일이면 409를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/customers')
        .send({ name: '중복', email: 'hong@integration.test' })
        .expect(409);

      expect(res.body.message).toMatch(/이미 등록된 이메일/);
    });
  });

  // ─── 고객 목록 조회 ────────────────────────────────────────────
  describe('GET /api/customers', () => {
    it('200: 전체 고객 목록을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('200: 이름으로 검색하면 필터된 목록을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers?search=홍길동')
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('홍길동');
    });

    it('200: 회사명으로 검색하면 필터된 목록을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers?search=테크코리아')
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].company).toBe('테크코리아');
    });

    it('200: 존재하지 않는 검색어는 빈 배열을 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers?search=없는이름xyz')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ─── 고객 단건 조회 ────────────────────────────────────────────
  describe('GET /api/customers/:id', () => {
    it('200: 존재하는 ID로 고객 상세 정보를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/customers/${createdId}`)
        .expect(200);

      expect(res.body.id).toBe(createdId);
      expect(res.body.name).toBe('홍길동');
    });

    it('404: 존재하지 않는 ID면 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/api/customers/99999')
        .expect(404);
    });
  });

  // ─── 고객 수정 ────────────────────────────────────────────────
  describe('PUT /api/customers/:id', () => {
    it('200: 고객 정보를 수정하고 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/customers/${createdId}`)
        .send({ name: '홍길동(수정)', email: 'hong@integration.test', company: '새회사', title: 'CEO' })
        .expect(200);

      expect(res.body.name).toBe('홍길동(수정)');
      expect(res.body.company).toBe('새회사');
      expect(res.body.title).toBe('CEO');
    });

    it('404: 존재하지 않는 ID를 수정하면 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/api/customers/99999')
        .send({ name: '없음', email: 'none@integration.test' })
        .expect(404);
    });

    it('409: 다른 고객의 이메일로 변경 시 409를 반환한다', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/customers/${createdId}`)
        .send({ name: '홍길동', email: 'mina@integration.test' })
        .expect(409);

      expect(res.body.message).toMatch(/이미.+이메일/);
    });
  });

  // ─── CSV 가져오기 ──────────────────────────────────────────────
  describe('POST /api/customers/import', () => {
    it('200: CSV 파일에서 고객을 가져온다', async () => {
      const csvContent = [
        'name,email,company,title',
        '박민준,minjun@integration.test,스타트업,개발자',
        '이수진,sujin@integration.test,대기업,PM',
      ].join('\n');

      const res = await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', Buffer.from(csvContent), { filename: 'test.csv', contentType: 'text/csv' })
        .expect(201);

      expect(res.body.created).toBe(2);
      expect(res.body.skipped).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('201: 중복 이메일은 upsert로 업데이트되고 created로 카운트된다', async () => {
      const csvContent = [
        'name,email',
        '중복업데이트,minjun@integration.test',
      ].join('\n');

      const res = await request(app.getHttpServer())
        .post('/api/customers/import')
        .attach('file', Buffer.from(csvContent), { filename: 'dup.csv', contentType: 'text/csv' })
        .expect(201);

      // upsert이므로 created로 카운트됨
      expect(res.body.created).toBe(1);
    });
  });

  // ─── 고객 삭제 ────────────────────────────────────────────────
  describe('DELETE /api/customers/:id', () => {
    it('204: 고객을 삭제하고 204를 반환한다', async () => {
      await request(app.getHttpServer())
        .delete(`/api/customers/${createdId}`)
        .expect(204);

      // 삭제 후 조회 시 404
      await request(app.getHttpServer())
        .get(`/api/customers/${createdId}`)
        .expect(404);
    });

    it('404: 존재하지 않는 ID 삭제 시 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .delete('/api/customers/99999')
        .expect(404);
    });
  });
});
