
import { Customer, ScheduledMail, MailLog, SmtpStatus } from '../types';

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `서버 오류 (${res.status})` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

// ─── 고객 관리 API ────────────────────────────────────────────
export const customersApi = {
  list: (search?: string): Promise<Customer[]> =>
    req(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  get: (id: number): Promise<Customer> =>
    req(`/customers/${id}`),

  create: (data: {
    name: string;
    email: string;
    company?: string;
    title?: string;
    memo?: string;
  }): Promise<Customer> =>
    req('/customers', { method: 'POST', body: JSON.stringify(data) }),

  update: (
    id: number,
    data: Partial<{ name: string; email: string; company: string; title: string; memo: string }>,
  ): Promise<Customer> =>
    req(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: number): Promise<null> =>
    req(`/customers/${id}`, { method: 'DELETE' }),

  // multipart/form-data - XLSX 또는 CSV 파일
  import: (file: File): Promise<{ created: number; skipped: number; errors: string[] }> => {
    const form = new FormData();
    form.append('file', file);
    return req('/customers/import', { method: 'POST', body: form });
  },
};

// ─── AI 메일 작성 API ─────────────────────────────────────────
export const aiApi = {
  draft: (
    customerId: number,
    additionalContext?: string,
  ): Promise<{ subject: string; body: string }> =>
    req('/ai/draft', {
      method: 'POST',
      body: JSON.stringify({ customerId, additionalContext }),
    }),

  tone: (
    subject: string,
    body: string,
    tone: 'formal' | 'casual',
  ): Promise<{ subject: string; body: string }> =>
    req('/ai/tone', { method: 'POST', body: JSON.stringify({ subject, body, tone }) }),

  translate: (
    subject: string,
    body: string,
    targetLanguage: string,
  ): Promise<{ subject: string; body: string }> =>
    req('/ai/translate', {
      method: 'POST',
      body: JSON.stringify({ subject, body, targetLanguage }),
    }),
};

// ─── 메일 발송 / 예약 / 기록 API ─────────────────────────────
export const mailApi = {
  send: (data: {
    toEmail: string;
    subject: string;
    body: string;
    customerId?: number;
  }): Promise<{ success: boolean; logId: number; sentAt: string }> =>
    req('/mail/send', { method: 'POST', body: JSON.stringify(data) }),

  schedule: (data: {
    toEmail: string;
    subject: string;
    body: string;
    scheduledAt: string;
    customerId?: number;
  }): Promise<ScheduledMail> =>
    req('/mail/schedule', { method: 'POST', body: JSON.stringify(data) }),

  getScheduled: (): Promise<ScheduledMail[]> =>
    req('/mail/scheduled'),

  cancelScheduled: (id: number): Promise<{ id: number; status: string; updatedAt: string }> =>
    req(`/mail/scheduled/${id}`, { method: 'DELETE' }),

  getLogs: (): Promise<MailLog[]> =>
    req('/mail/logs'),

  getLog: (id: number): Promise<MailLog> =>
    req(`/mail/logs/${id}`),

  getSmtpStatus: (): Promise<SmtpStatus> =>
    req('/mail/smtp/status'),

  saveSmtp: (data: {
    email: string;
    password: string;
    host?: string;
    port?: number;
  }): Promise<{ id: number; email: string; host: string; port: number }> =>
    req('/mail/smtp', { method: 'POST', body: JSON.stringify(data) }),

  testSmtp: (): Promise<{ success: boolean; message: string }> =>
    req('/mail/smtp/test', { method: 'POST' }),
};
