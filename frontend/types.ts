
export enum View {
  CUSTOMERS = 'CUSTOMERS',
  COMPOSE = 'COMPOSE',
  SCHEDULE = 'SCHEDULE'
}

// 백엔드 Customer 모델과 일치
export interface Customer {
  id: number;
  name: string;
  company: string | null;
  title: string | null;
  email: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

// 예약 메일 (GET /api/mail/scheduled)
export interface ScheduledMail {
  id: number;
  customerId: number | null;
  customer: { name: string; company: string | null } | null;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

// 발송 기록 (GET /api/mail/logs)
export interface MailLog {
  id: number;
  customerId: number | null;
  customer: {
    id: number;
    name: string;
    company: string | null;
    title: string | null;
    email: string;
    memo: string | null;
  } | null;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
}

export interface SmtpStatus {
  connected: boolean;
  email: string | null;
  host?: string;
  port?: number;
  updatedAt?: string;
}

export type Tone = 'FORMAL' | 'FRIENDLY';
export type Language = 'ko' | 'en' | 'ja' | 'zh';
