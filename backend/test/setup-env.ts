// 각 Jest 워커에서 테스트 DB 경로를 설정 (.env 로드 전에 적용됨)
process.env.DATABASE_URL = 'file:./prisma/test.db';
