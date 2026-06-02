# AI CRM - Backend API 문서

> **Base URL**: `http://localhost:3000/api`
> **Content-Type**: `application/json`

---

## 목차

1. [고객 관리 API](#1-고객-관리-api)
2. [AI 메일 작성 API](#2-ai-메일-작성-api)
3. [메일 발송 API](#3-메일-발송-api)
4. [SMTP 설정 API](#4-smtp-설정-api)
5. [예약 메일 관리 API](#5-예약-메일-관리-api)
6. [발송 기록 API](#6-발송-기록-api)
7. [에러 코드](#7-에러-코드)
8. [데이터 모델](#8-데이터-모델)

---

## 1. 고객 관리 API

### 1.1 고객 등록

> 기능명세 01 - 이름, 회사명, 직함, 이메일, 메모를 입력하여 고객을 저장합니다.

```
POST /api/customers
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | string | ✅ | 고객 이름 |
| email | string | ✅ | 이메일 주소 (유효성 검사 포함, 중복 불가) |
| company | string | | 회사명 |
| title | string | | 직함 |
| memo | string | | 메모 (AI 메일 초안의 핵심 소스) |

**요청 예시**

```json
{
  "name": "홍길동",
  "email": "hong@example.com",
  "company": "ABC 주식회사",
  "title": "마케팅 팀장",
  "memo": "신제품 발표회에 관심 있음. 지난번 미팅에서 B2B 협력 논의함."
}
```

**응답 예시** `201 Created`

```json
{
  "id": 1,
  "name": "홍길동",
  "email": "hong@example.com",
  "company": "ABC 주식회사",
  "title": "마케팅 팀장",
  "memo": "신제품 발표회에 관심 있음. 지난번 미팅에서 B2B 협력 논의함.",
  "createdAt": "2024-12-01T09:00:00.000Z",
  "updatedAt": "2024-12-01T09:00:00.000Z"
}
```

---

### 1.2 고객 목록 조회

> 기능명세 02 - 저장된 고객 목록을 조회합니다. 검색 키워드로 실시간 필터링 가능합니다.

```
GET /api/customers
GET /api/customers?search=홍길동
```

**Query Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| search | string | 이름, 회사명, 이메일을 포함 검색 |

**응답 예시** `200 OK`

```json
[
  {
    "id": 1,
    "name": "홍길동",
    "email": "hong@example.com",
    "company": "ABC 주식회사",
    "title": "마케팅 팀장",
    "memo": "신제품 발표회에 관심 있음.",
    "createdAt": "2024-12-01T09:00:00.000Z",
    "updatedAt": "2024-12-01T09:00:00.000Z"
  }
]
```

---

### 1.3 고객 단건 조회

```
GET /api/customers/:id
```

**Path Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 고객 ID |

**응답 예시** `200 OK`

```json
{
  "id": 1,
  "name": "홍길동",
  "email": "hong@example.com",
  "company": "ABC 주식회사",
  "title": "마케팅 팀장",
  "memo": "신제품 발표회에 관심 있음.",
  "createdAt": "2024-12-01T09:00:00.000Z",
  "updatedAt": "2024-12-01T09:00:00.000Z"
}
```

---

### 1.4 고객 수정

> 기능명세 05 - 등록된 고객 정보를 수정합니다.

```
PUT /api/customers/:id
```

**Path Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 고객 ID |

**Request Body** (변경할 필드만 전송 가능)

```json
{
  "company": "XYZ 코퍼레이션",
  "memo": "2024년 Q4 프로젝트 협력 검토 중"
}
```

**응답 예시** `200 OK`

```json
{
  "id": 1,
  "name": "홍길동",
  "email": "hong@example.com",
  "company": "XYZ 코퍼레이션",
  "title": "마케팅 팀장",
  "memo": "2024년 Q4 프로젝트 협력 검토 중",
  "createdAt": "2024-12-01T09:00:00.000Z",
  "updatedAt": "2024-12-01T10:30:00.000Z"
}
```

---

### 1.5 고객 삭제

> 기능명세 05 - 고객 데이터를 DB에서 영구 삭제합니다.

```
DELETE /api/customers/:id
```

**Path Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 고객 ID |

**응답** `204 No Content`

---

### 1.6 파일로 고객 명단 가져오기

> 기능명세 03 - Excel(XLSX) 또는 CSV 파일을 업로드하면 자동으로 파싱하여 고객 목록에 추가합니다.

```
POST /api/customers/import
Content-Type: multipart/form-data
```

**Form Data**

| 필드 | 타입 | 설명 |
|------|------|------|
| file | File | XLSX 또는 CSV 파일 (최대 10MB) |

**파일 컬럼 규칙** (한글/영문 컬럼명 모두 지원)

| 한글 컬럼명 | 영문 컬럼명 | 필수 | 설명 |
|-------------|-------------|------|------|
| 이름 | name / Name | ✅ | 고객 이름 |
| 이메일 | email / Email | ✅ | 이메일 주소 |
| 회사명 | company / Company | | 회사명 |
| 직함 | title / Title | | 직함 |
| 메모 | memo / Memo | | 메모 |

**응답 예시** `200 OK`

```json
{
  "created": 15,
  "skipped": 2,
  "errors": [
    "필수값 누락 (이름: \"\", 이메일: \"\")",
    "잘못된 이메일 형식: \"invalid-email\""
  ]
}
```

---

## 2. AI 메일 작성 API

> Claude claude-sonnet-4-6 모델을 사용합니다. `ANTHROPIC_API_KEY` 환경 변수 설정 필요.

### 2.1 AI 메일 초안 생성

> 기능명세 06 - 고객의 메모를 분석하여 AI가 이메일 제목과 본문을 자동 생성합니다.

```
POST /api/ai/draft
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| customerId | number | ✅ | 고객 ID |
| additionalContext | string | | 추가 작성 맥락 |

**요청 예시**

```json
{
  "customerId": 1,
  "additionalContext": "이번 달 신제품 출시 행사 초대 메일"
}
```

**응답 예시** `200 OK`

```json
{
  "subject": "[ABC 주식회사 홍길동 팀장님께] 신제품 발표회 초대",
  "body": "안녕하세요, 홍길동 팀장님.\n\n저희 회사의 신제품 발표회에 귀하를 초대하게 되어 영광입니다.\n\n이전 미팅에서 나누셨던 B2B 협력에 대한 관심을 바탕으로,\n이번 행사가 더욱 의미 있는 자리가 될 것이라 생각합니다.\n\n많은 참석 부탁드립니다.\n\n감사합니다."
}
```

---

### 2.2 메일 말투 변경

> 기능명세 07 - 작성된 메일의 내용을 유지하며 문체만 변경합니다.

```
POST /api/ai/tone
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| subject | string | ✅ | 현재 메일 제목 |
| body | string | ✅ | 현재 메일 본문 |
| tone | string | ✅ | `"formal"` (정중하게) 또는 `"casual"` (친근하게) |

**요청 예시**

```json
{
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요. 발표회에 초대합니다.",
  "tone": "formal"
}
```

**응답 예시** `200 OK`

```json
{
  "subject": "신제품 발표회 참석 초대의 말씀을 드립니다",
  "body": "안녕하십니까.\n\n귀하를 저희 신제품 발표회에 정중히 초대하고자 합니다.\n\n바쁘신 가운데 번거로움을 드려 대단히 죄송합니다만, 참석하여 주시면 감사하겠습니다."
}
```

---

### 2.3 메일 다국어 번역

> 기능명세 08 - 작성된 메일을 선택한 언어로 비즈니스 격식에 맞게 번역합니다.

```
POST /api/ai/translate
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| subject | string | ✅ | 현재 메일 제목 |
| body | string | ✅ | 현재 메일 본문 |
| targetLanguage | string | ✅ | 번역 대상 언어 (예: `"English"`, `"Japanese"`, `"Chinese"`) |

**요청 예시**

```json
{
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요. 발표회에 초대합니다.",
  "targetLanguage": "English"
}
```

**응답 예시** `200 OK`

```json
{
  "subject": "Invitation to New Product Launch Event",
  "body": "Dear Mr./Ms. Hong,\n\nI hope this message finds you well. We would like to cordially invite you to our upcoming product launch event.\n\nWe look forward to your presence.\n\nBest regards."
}
```

---

## 3. 메일 발송 API

### 3.1 즉시 발송

> 기능명세 12 - 연결된 SMTP 계정을 통해 메일을 즉시 발송하고 기록을 저장합니다.

```
POST /api/mail/send
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| toEmail | string | ✅ | 수신자 이메일 |
| subject | string | ✅ | 메일 제목 |
| body | string | ✅ | 메일 본문 |
| customerId | number | | 연결된 고객 ID (발송 기록용) |

**요청 예시**

```json
{
  "customerId": 1,
  "toEmail": "hong@example.com",
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요, 홍길동 팀장님. 발표회에 초대합니다."
}
```

**응답 예시** `200 OK`

```json
{
  "success": true,
  "logId": 42,
  "sentAt": "2024-12-01T09:00:00.000Z"
}
```

---

### 3.2 메일 예약 발송

> 기능명세 10 - 지정한 날짜/시간에 자동으로 메일이 발송되도록 예약합니다. (매 분마다 자동 처리)

```
POST /api/mail/schedule
```

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| toEmail | string | ✅ | 수신자 이메일 |
| subject | string | ✅ | 메일 제목 |
| body | string | ✅ | 메일 본문 |
| scheduledAt | string | ✅ | 발송 예약 시간 (ISO 8601, 현재 시간 이후) |
| customerId | number | | 연결된 고객 ID |

**요청 예시**

```json
{
  "customerId": 1,
  "toEmail": "hong@example.com",
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요, 발표회에 초대합니다.",
  "scheduledAt": "2024-12-25T09:00:00.000Z"
}
```

**응답 예시** `201 Created`

```json
{
  "id": 5,
  "customerId": 1,
  "toEmail": "hong@example.com",
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요, 발표회에 초대합니다.",
  "scheduledAt": "2024-12-25T09:00:00.000Z",
  "status": "PENDING",
  "createdAt": "2024-12-01T09:00:00.000Z",
  "updatedAt": "2024-12-01T09:00:00.000Z"
}
```

---

## 4. SMTP 설정 API

### 4.1 SMTP 계정 저장

> 기능명세 09 - 구글 SMTP 계정(앱 비밀번호)을 연결합니다.

```
POST /api/mail/smtp
```

> **Google 앱 비밀번호 발급**: Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| email | string | ✅ | Gmail 주소 |
| password | string | ✅ | Google 앱 비밀번호 (16자리) |
| host | string | | SMTP 서버 호스트 (기본값: `smtp.gmail.com`) |
| port | number | | SMTP 포트 (기본값: `587`) |

**요청 예시**

```json
{
  "email": "myapp@gmail.com",
  "password": "xxxx xxxx xxxx xxxx"
}
```

**응답 예시** `200 OK`

```json
{
  "id": 1,
  "email": "myapp@gmail.com",
  "host": "smtp.gmail.com",
  "port": 587,
  "createdAt": "2024-12-01T09:00:00.000Z",
  "updatedAt": "2024-12-01T09:00:00.000Z"
}
```

> **보안 주의**: `password` 필드는 응답에서 제외됩니다.

---

### 4.2 SMTP 연결 상태 조회

```
GET /api/mail/smtp/status
```

**응답 예시** `200 OK` (연결됨)

```json
{
  "connected": true,
  "email": "myapp@gmail.com",
  "host": "smtp.gmail.com",
  "port": 587,
  "updatedAt": "2024-12-01T09:00:00.000Z"
}
```

**응답 예시** `200 OK` (미연결)

```json
{
  "connected": false,
  "email": null
}
```

---

### 4.3 SMTP 연결 테스트

```
POST /api/mail/smtp/test
```

**응답 예시** `200 OK`

```json
{
  "success": true,
  "message": "SMTP 연결이 성공적으로 확인되었습니다."
}
```

---

## 5. 예약 메일 관리 API

### 5.1 예약 대기 목록 조회

> 기능명세 11 - 현재 대기 중(PENDING)인 예약 메일 목록을 반환합니다.

```
GET /api/mail/scheduled
```

**응답 예시** `200 OK`

```json
[
  {
    "id": 5,
    "customerId": 1,
    "customer": {
      "name": "홍길동",
      "company": "ABC 주식회사"
    },
    "toEmail": "hong@example.com",
    "subject": "신제품 발표회 초대",
    "body": "안녕하세요...",
    "scheduledAt": "2024-12-25T09:00:00.000Z",
    "status": "PENDING",
    "createdAt": "2024-12-01T09:00:00.000Z",
    "updatedAt": "2024-12-01T09:00:00.000Z"
  }
]
```

---

### 5.2 예약 취소

> 기능명세 11 - 대기 중인 메일 예약을 취소합니다.

```
DELETE /api/mail/scheduled/:id
```

**Path Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 예약 메일 ID |

**응답 예시** `200 OK`

```json
{
  "id": 5,
  "status": "CANCELLED",
  "updatedAt": "2024-12-01T10:00:00.000Z"
}
```

---

## 6. 발송 기록 API

### 6.1 발송 기록 목록 조회

> 기능명세 12 - 성공/실패 모든 메일 발송 기록을 반환합니다. (최신 순)

```
GET /api/mail/logs
```

**응답 예시** `200 OK`

```json
[
  {
    "id": 42,
    "customerId": 1,
    "customer": {
      "name": "홍길동",
      "company": "ABC 주식회사"
    },
    "toEmail": "hong@example.com",
    "subject": "신제품 발표회 초대",
    "body": "안녕하세요...",
    "sentAt": "2024-12-01T09:00:00.000Z",
    "status": "SUCCESS",
    "errorMessage": null
  }
]
```

**status 값**

| 값 | 설명 |
|----|------|
| `SUCCESS` | 발송 성공 |
| `FAILED` | 발송 실패 |

---

### 6.2 발송 기록 상세 조회

> 기능명세 12 - 발송된 메일의 제목/본문 전체를 확인합니다.

```
GET /api/mail/logs/:id
```

**Path Parameters**

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 발송 기록 ID |

**응답 예시** `200 OK`

```json
{
  "id": 42,
  "customerId": 1,
  "customer": {
    "id": 1,
    "name": "홍길동",
    "company": "ABC 주식회사",
    "title": "마케팅 팀장",
    "email": "hong@example.com",
    "memo": "신제품 발표회에 관심 있음.",
    "createdAt": "2024-12-01T09:00:00.000Z",
    "updatedAt": "2024-12-01T09:00:00.000Z"
  },
  "toEmail": "hong@example.com",
  "subject": "신제품 발표회 초대",
  "body": "안녕하세요, 홍길동 팀장님...",
  "sentAt": "2024-12-01T09:00:00.000Z",
  "status": "SUCCESS",
  "errorMessage": null
}
```

---

## 7. 에러 코드

| HTTP 상태 | 코드 | 설명 |
|-----------|------|------|
| 400 | Bad Request | 요청 데이터 형식 오류, 유효성 검사 실패 |
| 404 | Not Found | 해당 리소스를 찾을 수 없음 |
| 409 | Conflict | 중복 이메일 등 충돌 |
| 500 | Internal Server Error | 서버 내부 오류 (SMTP 발송 실패 등) |

**에러 응답 형식**

```json
{
  "statusCode": 409,
  "message": "이미 등록된 이메일입니다: hong@example.com",
  "error": "Conflict"
}
```

---

## 8. 데이터 모델

### Customer (고객)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | Int | PK, 자동 증가 |
| name | String | 이름 (필수) |
| email | String | 이메일 (필수, 유니크) |
| company | String? | 회사명 |
| title | String? | 직함 |
| memo | String? | 메모 (AI 초안 소스) |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

### ScheduledMail (예약 메일)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | Int | PK, 자동 증가 |
| customerId | Int? | 고객 ID (FK) |
| toEmail | String | 수신자 이메일 |
| subject | String | 제목 |
| body | String | 본문 |
| scheduledAt | DateTime | 예약 발송 시간 |
| status | String | `PENDING` / `SENT` / `CANCELLED` / `FAILED` |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

### MailLog (발송 기록)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | Int | PK, 자동 증가 |
| customerId | Int? | 고객 ID (FK) |
| toEmail | String | 수신자 이메일 |
| subject | String | 제목 |
| body | String | 본문 |
| sentAt | DateTime | 발송 일시 (초 단위) |
| status | String | `SUCCESS` / `FAILED` |
| errorMessage | String? | 실패 시 에러 메시지 |

### SmtpConfig (SMTP 설정)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | Int | PK, 자동 증가 |
| email | String | Gmail 주소 |
| password | String | Google 앱 비밀번호 |
| host | String | SMTP 호스트 (기본: smtp.gmail.com) |
| port | Int | SMTP 포트 (기본: 587) |
| createdAt | DateTime | 생성일시 |
| updatedAt | DateTime | 수정일시 |

---

## 시작 방법

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 파일에서 ANTHROPIC_API_KEY 설정

# 2. 패키지 설치
npm install

# 3. DB 마이그레이션 (SQLite 자동 생성)
npm run prisma:migrate

# 4. 개발 서버 시작
npm run start:dev

# 서버: http://localhost:3000/api
```

---

*작성일: 2026-02-20*
