import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { NextFunction, Request, Response } from 'express';
import { config } from './server/config.ts';
import { initDatabase } from './server/db.ts';
import { createAdminRouter } from './server/routes/admin.ts';
import { createAuthRouter } from './server/routes/auth.ts';
import { createCustomerRouter } from './server/routes/customer.ts';
import { createMarketplaceRouter } from './server/routes/marketplace.ts';
import { createProviderRouter } from './server/routes/provider.ts';
import { seedDatabaseIfEmpty } from './server/seed.ts';
import { ApiError } from './server/validation.ts';

function resolveStaticDirs(): { frontendDir: string; assetsDir: string } {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateFrontend = path.resolve(currentDir, 'frontend');
  if (fs.existsSync(candidateFrontend)) {
    return {
      frontendDir: candidateFrontend,
      assetsDir: path.resolve(currentDir, 'src', 'assets'),
    };
  }
  return {
    frontendDir: path.resolve(process.cwd(), 'frontend'),
    assetsDir: path.resolve(process.cwd(), 'src', 'assets'),
  };
}

export function createApp(options?: { dbPath?: string }) {
  const db = initDatabase(options?.dbPath ?? config.dbPath);
  seedDatabaseIfEmpty(db);

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'local-service-finder' });
  });

  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1', createMarketplaceRouter());
  app.use('/api/v1', createCustomerRouter());
  app.use('/api/v1', createProviderRouter());
  app.use('/api/v1', createAdminRouter());

  // 404 for unknown API endpoints
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Requested API endpoint does not exist.',
      },
    });
  });

  const { frontendDir, assetsDir } = resolveStaticDirs();
  if (fs.existsSync(assetsDir)) {
    app.use('/src/assets', express.static(assetsDir, { maxAge: '7d' }));
  }
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir, { extensions: ['html'] }));
  }

  // Fallback to index.html for root
  app.get('/', (_req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details ?? undefined,
        },
      });
      return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body contains malformed JSON.',
        },
      });
      return;
    }

    console.error('[Server Error]', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    });
  });

  return app;
}

const app = createApp();
export default app;

const isDirectRun =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js'));

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Local Service Finder running at http://0.0.0.0:${config.port}`);
  });
}
