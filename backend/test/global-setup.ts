import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

export default async function globalSetup() {
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: 'file:./prisma/test.db' };

  console.log('\n[통합테스트] 테스트 DB 초기화 중...');

  // schema.prisma 가 postgres provider 로 설정돼 있더라도, 생성된 prisma client 는
  // sqlite 로 동작하는 상태일 수 있다. 이 경우 `prisma migrate deploy` 가 검증 단계에서
  // 실패하므로, 테이블이 이미 존재하면 건너뛴다.
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:./prisma/test.db' } },
  });
  try {
    const tables: { name: string }[] = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    const required = ['Customer', 'ScheduledMail', 'MailLog', 'SmtpConfig'];
    const have = new Set(tables.map((t) => t.name));
    const missing = required.filter((t) => !have.has(t));
    if (missing.length === 0) {
      console.log('[통합테스트] 테스트 DB 스키마 확인 완료 (마이그레이션 건너뜀)');
      return;
    }
    console.log(`[통합테스트] 누락 테이블: ${missing.join(', ')} → migrate deploy 시도`);
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'inherit' });
  console.log('[통합테스트] 테스트 DB 준비 완료\n');
}
