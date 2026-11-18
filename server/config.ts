import path from 'node:path';

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'lsf-local-dev-signing-secret-change-in-prod-2026',
  jwtTtlSeconds: 60 * 60 * 24 * 7, // 7 days
  dbPath: process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'local-service-finder.sqlite'),
  defaultPageSize: 12,
  maxPageSize: 50,
};
