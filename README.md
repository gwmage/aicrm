# AI CRM — 고객관리 & 메일 자동화

도서 **《설계 지능》(이지스퍼블리싱)**의 **실전 프로젝트 I** 예제 소스입니다.
AI가 고객의 메모를 바탕으로 맞춤 메일 초안을 써 주는 1인용 고객관리(CRM) 도구입니다.

## 주요 기능
- 고객 정보 등록 · 조회 · 수정 · 삭제
- 엑셀(CSV/XLSX) 파일로 고객 명단 일괄 업로드
- 선택한 고객의 메모를 바탕으로 **AI 메일 초안 자동 작성**
- 메일 말투 변경 · 다국어 번역
- 메일 예약 발송(SMTP) 및 발송 기록 관리

## 기술 스택
| 영역 | 도구 |
|------|------|
| 프론트엔드 | React |
| 백엔드 | NestJS |
| 데이터베이스 | Prisma + PostgreSQL (로컬은 SQLite로도 시작 가능) |
| AI | Anthropic Claude API |
| 메일 | Nodemailer (SMTP) |

## 폴더 구조
```
aicrm/
├─ backend/    # NestJS 엔진 (API, AI 호출, DB)
├─ frontend/   # React 화면
├─ docs/       # 기획·화면 정의 문서
└─ package.json # 루트(프론트+백엔드 동시 실행)
```

## 실행 방법
1. **준비물**: Node.js 20 이상
2. **의존성 설치**
   ```
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```
3. **환경변수 설정** — `backend/.env.example`을 복사해 `backend/.env`를 만들고 값을 채운다.
   ```
   DATABASE_URL=...          # 데이터베이스 접속 주소
   ANTHROPIC_API_KEY=...     # 앤스로픽 Claude API 키
   PORT=3000
   CORS_ORIGIN=http://localhost:5173
   ```
4. **데이터베이스 준비**
   ```
   npm --prefix backend run prisma:migrate
   ```
5. **개발 서버 실행** (백엔드 + 프론트엔드 동시)
   ```
   npm run dev
   ```

> ⚠️ `.env`에는 실제 API 키 등 민감 정보가 들어가므로 절대 깃허브에 올리지 마세요. (`.gitignore`로 제외되어 있습니다.)

## 라이선스
학습용 예제 코드입니다. 자유롭게 참고·수정해 사용하세요.
