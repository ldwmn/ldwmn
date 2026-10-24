import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyInitData } from './auth.js';
import { parseAllowed } from './config.js';

const TOKEN = '123456:TEST';

function sign(fields: Record<string, string>, token = TOKEN) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const NOW = 1_800_000_000_000;
const fresh = () => ({
  auth_date: String(NOW / 1000 - 10),
  user: JSON.stringify({ id: 42, first_name: 'Анна' }),
});

describe('verifyInitData', () => {
  it('принимает корректную подпись', () => {
    expect(verifyInitData(sign(fresh()), TOKEN, 86400, NOW)?.id).toBe(42);
  });
  it('отклоняет чужой токен', () => {
    expect(verifyInitData(sign(fresh(), 'other:TOKEN'), TOKEN, 86400, NOW)).toBeNull();
  });
  it('отклоняет подменённые данные', () => {
    const tampered = sign(fresh()).replace('42', '43');
    expect(verifyInitData(tampered, TOKEN, 86400, NOW)).toBeNull();
  });
  it('отклоняет устаревшую подпись', () => {
    const old = { ...fresh(), auth_date: String(NOW / 1000 - 100_000) };
    expect(verifyInitData(sign(old), TOKEN, 86400, NOW)).toBeNull();
  });
  it('отклоняет отсутствие hash и мусор', () => {
    expect(verifyInitData('', TOKEN, 86400, NOW)).toBeNull();
    expect(verifyInitData('user=%7B%7D', TOKEN, 86400, NOW)).toBeNull();
  });
});

describe('parseAllowed', () => {
  it('первый ID — owner, остальные — assistant, мусор отбрасывается', () => {
    const m = parseAllowed('10, 20,abc,,30');
    expect([...m]).toEqual([[10, 'owner'], [20, 'assistant'], [30, 'assistant']]);
  });
});
