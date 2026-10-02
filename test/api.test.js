import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, loadConfig } from '../src/server.js';

describe('server', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp(loadConfig({ ZITADEL_URL: 'http://zitadel.test/', CLIENT_ID: 'test-client' }));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  test('GET /api/config returns the ZITADEL URL (no trailing slash) and client ID', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { zitadelUrl: 'http://zitadel.test', clientId: 'test-client' });
  });

  test('unknown /api routes return a JSON error code, never text', async () => {
    const res = await fetch(`${baseUrl}/api/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: { code: 'NOT_FOUND' } });
  });

  test('serves the page and the browser modules', async () => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="lang-select"/);

    const i18n = await fetch(`${baseUrl}/js/i18n.js`);
    assert.equal(i18n.status, 200);
    assert.match(i18n.headers.get('content-type'), /javascript/);
  });

  test('a missing CLIENT_ID is reported as null', () => {
    assert.equal(loadConfig({}).clientId, null);
    assert.equal(loadConfig({}).zitadelUrl, 'http://localhost:8080');
  });
});
