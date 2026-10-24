import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { parseAllowed } from './config.js';
import { openDb } from './db.js';

const TOKEN = '123456:TEST';
const config = {
  botToken: TOKEN,
  webappUrl: '',
  port: 0,
  dbFile: ':memory:',
  initDataMaxAgeSec: 86400,
  allowed: parseAllowed('42,7'),
};

function initDataFor(id: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: 'Тест' }),
  };
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('API', () => {
  it('без подписи — 401', async () => {
    const app = await buildApp(config, openDb());
    expect((await app.inject('/api/me')).statusCode).toBe(401);
  });
  it('подпись верна, но ID не в списке — 403', async () => {
    const app = await buildApp(config, openDb());
    const res = await app.inject({ url: '/api/me', headers: { authorization: `tma ${initDataFor(99)}` } });
    expect(res.statusCode).toBe(403);
  });
  it('разрешённый ID получает роль', async () => {
    const app = await buildApp(config, openDb());
    const res = await app.inject({ url: '/api/me', headers: { authorization: `tma ${initDataFor(7)}` } });
    expect(res.json()).toMatchObject({ id: 7, role: 'assistant' });
  });
});
