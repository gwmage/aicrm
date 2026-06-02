
import { http, HttpResponse } from 'msw';
import { Customer, ScheduledMail, MailLog, SmtpStatus } from '../../types';

// ─── 픽스처 데이터 ────────────────────────────────────────────
export const mockCustomers: Customer[] = [
  {
    id: 1,
    name: '홍길동',
    company: '테크코리아',
    title: 'CTO',
    email: 'hong@techkorea.com',
    memo: '엔터프라이즈 라이선스 관심',
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 2,
    name: '김미나',
    company: '이노베이트',
    title: '마케팅 팀장',
    email: 'mina@innovate.io',
    memo: '신규 제품 협업 논의',
    createdAt: '2024-01-10T09:00:00.000Z',
    updatedAt: '2024-01-10T09:00:00.000Z',
  },
];

export const mockScheduledMails: ScheduledMail[] = [
  {
    id: 10,
    customerId: 1,
    customer: { name: '홍길동', company: '테크코리아' },
    toEmail: 'hong@techkorea.com',
    subject: '견적서 안내',
    body: '안녕하세요...',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockMailLogs: MailLog[] = [
  {
    id: 100,
    customerId: 2,
    customer: { id: 2, name: '김미나', company: '이노베이트', title: '마케팅 팀장', email: 'mina@innovate.io', memo: null },
    toEmail: 'mina@innovate.io',
    subject: 'AI CRM 소개',
    body: '안녕하세요 김미나 팀장님...',
    sentAt: '2024-01-20T09:12:00.000Z',
    status: 'SUCCESS',
    errorMessage: null,
  },
  {
    id: 101,
    customerId: null,
    customer: null,
    toEmail: 'test@fail.com',
    subject: '실패 테스트',
    body: '본문...',
    sentAt: '2024-01-19T09:00:00.000Z',
    status: 'FAILED',
    errorMessage: 'SMTP 연결 오류',
  },
];

export const mockSmtpStatus: SmtpStatus = {
  connected: true,
  email: 'sender@company.com',
  host: 'smtp.gmail.com',
  port: 587,
};

// ─── MSW 핸들러 ───────────────────────────────────────────────
export const handlers = [
  // 고객 목록
  http.get('/api/customers', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const filtered = search
      ? mockCustomers.filter(
          (c) => c.name.includes(search) || c.email.includes(search) || (c.company && c.company.includes(search)),
        )
      : mockCustomers;
    return HttpResponse.json(filtered);
  }),

  // 고객 생성
  http.post('/api/customers', async ({ request }) => {
    const body = (await request.json()) as Partial<Customer>;
    if (!body.name || !body.email) {
      return HttpResponse.json({ message: '이름과 이메일은 필수입니다.' }, { status: 400 });
    }
    if (mockCustomers.some((c) => c.email === body.email)) {
      return HttpResponse.json({ message: `이미 등록된 이메일입니다: ${body.email}` }, { status: 409 });
    }
    const created: Customer = {
      id: 999,
      name: body.name,
      company: body.company ?? null,
      title: body.title ?? null,
      email: body.email,
      memo: body.memo ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  // 고객 수정
  http.put('/api/customers/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const customer = mockCustomers.find((c) => c.id === id);
    if (!customer) return HttpResponse.json({ message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    const body = (await request.json()) as Partial<Customer>;
    return HttpResponse.json({ ...customer, ...body });
  }),

  // 고객 삭제
  http.delete('/api/customers/:id', ({ params }) => {
    const id = Number(params.id);
    if (!mockCustomers.some((c) => c.id === id)) {
      return HttpResponse.json({ message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // 파일 가져오기
  http.post('/api/customers/import', () => {
    return HttpResponse.json({ created: 3, skipped: 1, errors: ['잘못된 이메일 형식: "bad"'] });
  }),

  // AI 초안
  http.post('/api/ai/draft', () => {
    return HttpResponse.json({
      subject: '[테크코리아 홍길동님] 엔터프라이즈 라이선스 안내',
      body: '안녕하세요 홍길동 이사님.\n\n귀하의 관심에 감사드립니다.',
    });
  }),

  // 말투 변경
  http.post('/api/ai/tone', async ({ request }) => {
    const body = (await request.json()) as { subject: string; body: string; tone: string };
    return HttpResponse.json({
      subject: body.tone === 'casual' ? `[친근] ${body.subject}` : `[격식] ${body.subject}`,
      body: body.body,
    });
  }),

  // 번역
  http.post('/api/ai/translate', async ({ request }) => {
    const body = (await request.json()) as { subject: string; body: string; targetLanguage: string };
    return HttpResponse.json({
      subject: `[${body.targetLanguage}] ${body.subject}`,
      body: `[Translated] ${body.body}`,
    });
  }),

  // 메일 발송
  http.post('/api/mail/send', async ({ request }) => {
    const body = (await request.json()) as { toEmail: string; subject: string; body: string };
    if (!body.toEmail || !body.subject) {
      return HttpResponse.json({ message: '필수 항목 누락' }, { status: 400 });
    }
    return HttpResponse.json({ success: true, logId: 200, sentAt: new Date().toISOString() });
  }),

  // 메일 예약
  http.post('/api/mail/schedule', async ({ request }) => {
    const body = (await request.json()) as { toEmail: string; subject: string; scheduledAt: string };
    return HttpResponse.json(
      {
        id: 201,
        customerId: null,
        customer: null,
        toEmail: body.toEmail,
        subject: body.subject,
        body: '',
        scheduledAt: body.scheduledAt,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // 예약 목록
  http.get('/api/mail/scheduled', () => HttpResponse.json(mockScheduledMails)),

  // 예약 취소
  http.delete('/api/mail/scheduled/:id', ({ params }) => {
    const id = Number(params.id);
    const mail = mockScheduledMails.find((m) => m.id === id);
    if (!mail) return HttpResponse.json({ message: '예약 메일을 찾을 수 없습니다.' }, { status: 404 });
    return HttpResponse.json({ id, status: 'CANCELLED', updatedAt: new Date().toISOString() });
  }),

  // 발송 기록 목록
  http.get('/api/mail/logs', () => HttpResponse.json(mockMailLogs)),

  // 발송 기록 상세
  http.get('/api/mail/logs/:id', ({ params }) => {
    const log = mockMailLogs.find((l) => l.id === Number(params.id));
    if (!log) return HttpResponse.json({ message: '기록을 찾을 수 없습니다.' }, { status: 404 });
    return HttpResponse.json(log);
  }),

  // SMTP 상태
  http.get('/api/mail/smtp/status', () => HttpResponse.json(mockSmtpStatus)),

  // SMTP 저장
  http.post('/api/mail/smtp', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (!body.email || !body.password) {
      return HttpResponse.json({ message: '이메일과 비밀번호는 필수입니다.' }, { status: 400 });
    }
    return HttpResponse.json({ id: 1, email: body.email, host: 'smtp.gmail.com', port: 587 });
  }),

  // SMTP 테스트
  http.post('/api/mail/smtp/test', () => {
    return HttpResponse.json({ success: true, message: 'SMTP 연결이 성공적으로 확인되었습니다.' });
  }),
];
