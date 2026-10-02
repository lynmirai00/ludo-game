import { Router } from 'express';

// All /api/* endpoints. Responses never contain translated text: errors carry a
// stable `code` that the browser maps to `errors.<CODE>`.
export function createApiRouter(config) {
  const router = Router();

  router.get('/config', (req, res) => {
    res.json({ zitadelUrl: config.zitadelUrl, clientId: config.clientId });
  });

  router.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND' } });
  });

  return router;
}
