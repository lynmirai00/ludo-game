import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { createApiRouter } from './routes/api.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(env = process.env) {
  return {
    // The token issuer must match exactly, so drop any trailing slash.
    zitadelUrl: (env.ZITADEL_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    clientId: env.CLIENT_ID || null,
    port: Number(env.PORT) || 3000,
  };
}

export function createApp(config) {
  const app = express();

  app.use('/api', createApiRouter(config));
  app.use('/shared', express.static(path.join(rootDir, 'shared')));
  app.use(express.static(path.join(rootDir, 'public')));

  // Last-resort error handler: never leak details, only a stable code.
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await import('dotenv/config');
  const config = loadConfig();
  if (!config.clientId) {
    // Phase 1: login is not wired up yet, so only warn. Phase 3 turns this into a hard exit.
    console.warn('Warning: CLIENT_ID is not set in .env. Login will not work until it is configured.');
  }
  createApp(config).listen(config.port, () => {
    console.log(`Ludo is running at http://localhost:${config.port}`);
  });
}
