
import { describe, it, expect } from 'vitest';
import { server } from './setup';
import { http, HttpResponse } from 'msw';
import { customersApi, aiApi, mailApi } from '../../services/apiService';
import { mockCustomers, mockMailLogs, mockScheduledMails, mockSmtpStatus } from './handlers';

// ─── customersApi ────────────────────────────────────────────
describe('customersApi', () => {
  describe('list()', () => {
    it('검색어 없이 전체 고객 목록을 반환한다', async () => {
      const result = await customersApi.list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('홍길동');
    });

    it('검색어를 쿼리 파라미터로 전달한다', async () => {
      let capturedUrl = '';
      server.use(
        http.get('/api/customers', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([mockCustomers[0]]);
        }),
      );

      await customersApi.list('테크코리아');

      expect(capturedUrl).toContain('search=%ED%85%8C%ED%81%AC%EC%BD%94%EB%A6%AC%EC%95%84');
    });
  });

  describe('create()', () => {
    it('새 고객을 생성하고 반환한다', async () => {
      const newCustomer = { ...mockCustomers[0], id: 999, name: '새고객', email: 'new@test.com' };
      server.use(
        http.post('/api/customers', () => HttpResponse.json(newCustomer, { status: 201 })),
      );

      const result = await customersApi.create({ name: '새고객', email: 'new@test.com' });

      expect(result.id).toBe(999);
      expect(result.name).toBe('새고객');
    });

    it('서버 오류 시 Error를 던진다', async () => {
      server.use(
        http.post('/api/customers', () =>
          HttpResponse.json({ message: '이미 등록된 이메일입니다.' }, { status: 409 }),
        ),
      );

      await expect(customersApi.create({ name: '홍길동', email: 'hong@techkorea.com' })).rejects.toThrow(
        '이미 등록된 이메일입니다.',
      );
    });
  });

  describe('update()', () => {
    it('고객 정보를 수정하고 반환한다', async () => {
      const updated = { ...mockCustomers[0], company: 'XYZ' };
      server.use(http.put('/api/customers/1', () => HttpResponse.json(updated)));

      const result = await customersApi.update(1, { company: 'XYZ' });

      expect(result.company).toBe('XYZ');
    });

    it('존재하지 않는 ID면 Error를 던진다', async () => {
      server.use(
        http.put('/api/customers/999', () =>
          HttpResponse.json({ message: '고객을 찾을 수 없습니다.' }, { status: 404 }),
        ),
      );

      await expect(customersApi.update(999, { company: 'test' })).rejects.toThrow('고객을 찾을 수 없습니다.');
    });
  });

  describe('delete()', () => {
    it('고객 삭제 성공 시 null을 반환한다', async () => {
      server.use(http.delete('/api/customers/1', () => new HttpResponse(null, { status: 204 })));

      const result = await customersApi.delete(1);

      expect(result).toBeNull();
    });

    it('존재하지 않는 ID면 Error를 던진다', async () => {
      server.use(
        http.delete('/api/customers/999', () =>
          HttpResponse.json({ message: '고객을 찾을 수 없습니다.' }, { status: 404 }),
        ),
      );

      await expect(customersApi.delete(999)).rejects.toThrow('고객을 찾을 수 없습니다.');
    });
  });

  describe('import()', () => {
    it('파일을 전송하고 결과를 반환한다', async () => {
      server.use(
        http.post('/api/customers/import', () => {
          return HttpResponse.json({ created: 3, skipped: 1, errors: [] });
        }),
      );

      const file = new File(['name,email\n홍길동,hong@test.com'], 'test.csv', { type: 'text/csv' });
      const result = await customersApi.import(file);

      expect(result.created).toBe(3);
      expect(result.skipped).toBe(1);
    });
  });
});

// ─── aiApi ───────────────────────────────────────────────────
describe('aiApi', () => {
  describe('draft()', () => {
    it('customerId로 이메일 초안을 요청한다', async () => {
      let requestBody: any = null;
      server.use(
        http.post('/api/ai/draft', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ subject: '테스트 제목', body: '테스트 본문' });
        }),
      );

      const result = await aiApi.draft(1);

      expect(requestBody.customerId).toBe(1);
      expect(result.subject).toBe('테스트 제목');
      expect(result.body).toBe('테스트 본문');
    });

    it('additionalContext를 함께 전송한다', async () => {
      let requestBody: any = null;
      server.use(
        http.post('/api/ai/draft', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ subject: '제목', body: '본문' });
        }),
      );

      await aiApi.draft(1, '행사 초대');

      expect(requestBody.additionalContext).toBe('행사 초대');
    });
  });

  describe('tone()', () => {
    it('subject, body, tone을 전송하고 변환된 이메일을 반환한다', async () => {
      let requestBody: any = null;
      server.use(
        http.post('/api/ai/tone', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ subject: '변환된 제목', body: '변환된 본문' });
        }),
      );

      const result = await aiApi.tone('원본 제목', '원본 본문', 'formal');

      expect(requestBody).toEqual({ subject: '원본 제목', body: '원본 본문', tone: 'formal' });
      expect(result.subject).toBe('변환된 제목');
    });
  });

  describe('translate()', () => {
    it('targetLanguage를 포함하여 번역 요청을 전송한다', async () => {
      let requestBody: any = null;
      server.use(
        http.post('/api/ai/translate', async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ subject: 'Translated Subject', body: 'Translated Body' });
        }),
      );

      const result = await aiApi.translate('제목', '본문', 'English');

      expect(requestBody.targetLanguage).toBe('English');
      expect(result.subject).toBe('Translated Subject');
    });
  });
});

// ─── mailApi ─────────────────────────────────────────────────
describe('mailApi', () => {
  describe('send()', () => {
    it('메일 발송 요청을 보내고 결과를 반환한다', async () => {
      const result = await mailApi.send({
        toEmail: 'hong@test.com',
        subject: '테스트',
        body: '본문',
      });

      expect(result.success).toBe(true);
      expect(result.logId).toBe(200);
    });
  });

  describe('schedule()', () => {
    it('예약 발송 요청을 보내고 201 응답을 반환한다', async () => {
      const scheduledAt = new Date(Date.now() + 86400000).toISOString();

      const result = await mailApi.schedule({
        toEmail: 'hong@test.com',
        subject: '예약 테스트',
        body: '본문',
        scheduledAt,
      });

      expect(result.status).toBe('PENDING');
    });
  });

  describe('getScheduled()', () => {
    it('예약 메일 목록을 반환한다', async () => {
      const result = await mailApi.getScheduled();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PENDING');
    });
  });

  describe('cancelScheduled()', () => {
    it('예약 취소 요청을 보내고 결과를 반환한다', async () => {
      const result = await mailApi.cancelScheduled(10);

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('getLogs()', () => {
    it('발송 기록 목록을 반환한다', async () => {
      const result = await mailApi.getLogs();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('SUCCESS');
      expect(result[1].status).toBe('FAILED');
    });
  });

  describe('getSmtpStatus()', () => {
    it('SMTP 연결 상태를 반환한다', async () => {
      const result = await mailApi.getSmtpStatus();

      expect(result.connected).toBe(true);
      expect(result.email).toBe('sender@company.com');
    });
  });

  describe('testSmtp()', () => {
    it('SMTP 연결 테스트 결과를 반환한다', async () => {
      const result = await mailApi.testSmtp();

      expect(result.success).toBe(true);
    });
  });
});
