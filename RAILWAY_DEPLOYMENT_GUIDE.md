# Railway에 AI CRM 백엔드 배포하기 (GitHub 없이)

이 가이드는 **GitHub을 사용하지 않고** Railway CLI로 직접 배포하는 방법입니다.

---

## 📋 사전 준비물

- **Railway 계정** (https://railway.app 에서 무료 가입, 이메일/Google 가입 가능)
- **Claude API 키** (https://console.anthropic.com 에서 발급)
- **인터넷 연결**

> Railway CLI는 이미 설치되어 있습니다 (v4.44.0).

---

## 🚀 배포 단계

### 1단계: Railway 가입

1. https://railway.app 접속
2. **"Login"** → **"Login with Google"** 또는 이메일로 가입
3. 가입 완료 후 무료 크레딧($5)이 자동 지급됨

> Hobby 플랜($5/월)이 필요하지만, 처음 가입 시 받는 무료 크레딧으로 약 1달 무료 이용 가능합니다.

---

### 2단계: Railway CLI 로그인

**터미널(PowerShell)에서 직접 실행해야 합니다.** 브라우저 인증이 필요합니다.

```bash
railway login
```

- 위 명령을 실행하면 자동으로 브라우저가 열립니다
- 브라우저에서 **"Authorize"** 클릭하면 로그인 완료
- 터미널로 돌아오면 `Logged in as your-email@example.com` 메시지 확인

> Claude Code에서 `! railway login` 으로도 실행 가능합니다.

---

### 3단계: 프로젝트 생성

로그인 후 아래 명령들을 순서대로 실행하면 됩니다.
**이 단계부터는 Claude Code가 대신 실행해드립니다.** "로그인 했어" 라고 말씀하시면 됩니다.

#### 3-1. 프로젝트 초기화
```bash
cd C:\Users\fbrms\aicrm\backend
railway init
```
- 프로젝트 이름 입력: `aicrm-backend` (또는 원하는 이름)

#### 3-2. PostgreSQL 데이터베이스 추가
```bash
railway add --database postgres
```
- 자동으로 PostgreSQL 서비스가 생성되고 `DATABASE_URL` 환경변수가 자동 설정됨

#### 3-3. 환경변수 설정
```bash
railway variables --set "ANTHROPIC_API_KEY=sk-ant-여기에키입력"
```

> `sk-ant-...` 부분에 https://console.anthropic.com 에서 발급받은 실제 API 키를 넣으세요.

#### 3-4. 배포
```bash
railway up
```

- 코드가 압축되어 Railway로 업로드됨
- Railway가 자동으로 빌드 → 마이그레이션 → 실행
- 완료까지 2-5분 소요

---

### 4단계: 배포된 URL 확인

```bash
railway domain
```

- 처음 실행 시 자동으로 도메인 생성됨 (예: `aicrm-backend-production.up.railway.app`)
- 이 URL이 백엔드 API 주소입니다

---

### 5단계: 배포 확인

브라우저에서 아래 주소 접속:
```
https://여기에본인URL.up.railway.app/api/mail/smtp/status
```

다음과 같은 응답이 나오면 정상 ✅:
```json
{"connected":false,"email":null}
```

---

## 🔍 자주 쓰는 명령어

```bash
# 현재 배포 상태 확인
railway status

# 로그 실시간 보기
railway logs

# 환경변수 목록 보기
railway variables

# 환경변수 추가/수정
railway variables --set "KEY=VALUE"

# 다시 배포
railway up

# 대시보드 열기 (웹브라우저)
railway open
```

---

## ⚠️ 주의사항

### 1. 비용
- **무료 크레딧 $5** 지급 (가입 시 1회)
- 이후 **Hobby 플랜 $5/월** 청구
- 사용량이 적으면 $5 미만으로 사용 가능

### 2. API 키 보안
- `.env` 파일은 절대 커밋되지 않도록 `.gitignore`에 등록되어 있음
- 실제 키는 Railway 환경변수로만 관리

### 3. CORS 설정
- 프론트엔드 배포 후, 프론트엔드 URL을 `CORS_ORIGIN` 환경변수에 추가:
  ```bash
  railway variables --set "CORS_ORIGIN=https://프론트엔드주소.com"
  ```

---

## 🆘 문제 해결

### 문제: `railway: command not found`
**해결:** 터미널 재시작 또는:
```bash
npm install -g @railway/cli
```

### 문제: 배포 실패 (`railway up` 에러)
**해결:**
```bash
railway logs
```
로 로그 확인 후 원인 파악:
- `DATABASE_URL is required` → `railway add --database postgres` 다시 실행
- `ANTHROPIC_API_KEY missing` → 환경변수 다시 설정

### 문제: 502 Bad Gateway
**해결:** 콜드 스타트 중. 2-3분 후 다시 시도

### 문제: 데이터베이스 연결 안 됨
**해결:**
```bash
railway variables
```
로 `DATABASE_URL`이 있는지 확인. 없으면:
```bash
railway add --database postgres
railway up
```

---

## ✅ 체크리스트

- [ ] Railway 계정 생성
- [ ] `railway login` 완료
- [ ] `railway init` 으로 프로젝트 생성
- [ ] PostgreSQL 추가
- [ ] `ANTHROPIC_API_KEY` 환경변수 설정
- [ ] `railway up` 으로 배포
- [ ] 배포 URL 확인
- [ ] `/api/mail/smtp/status` 접속해서 정상 응답 확인

---

## 📞 추가 지원

- Railway CLI 문서: https://docs.railway.app/develop/cli
- Anthropic Console: https://console.anthropic.com
- Prisma 문서: https://www.prisma.io/docs

---

**🎉 배포가 완료되면 24/7 백엔드 서버가 실행됩니다.**
