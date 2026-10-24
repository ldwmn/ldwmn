import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { parseAllowed } from './config.js';
import { openDb } from './db.js';

const TOKEN = '123456:TEST';
const config = { botToken: TOKEN, webappUrl: '', port: 0, dbFile: ':memory:', initDataMaxAgeSec: 86400, allowed: parseAllowed('1,2') };

function auth(id: number) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'T' }) };
  const check = Object.entries(f).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex');
  return { authorization: `tma ${new URLSearchParams({ ...f, hash })}` };
}

async function setup() {
  const app = await buildApp(config, openDb());
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object, as = 1) => {
    const res = await app.inject({ method, url, payload, headers: auth(as) });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };
  const dirs = ((await call('GET', '/api/directions')).body as { id: number; name: string }[]);
  const dir = (n: string) => dirs.find((d) => d.name === n)!.id;
  return { call, dir };
}

// 2026-10-26 — понедельник; 2026-10-27 — вторник
describe('расписание', () => {
  it('шаблон разворачивается по датам, разовое занятие добавляется, валидация', async () => {
    const { call, dir } = await setup();
    expect((await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '25:00' })).status).toBe(400);
    expect((await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '19:00', duration_min: 90 })).status).toBe(201);
    await call('POST', '/api/lessons', { direction_id: dir('Практика'), date: '2026-11-01', start_time: '18:00' });

    const cal = (await call('GET', '/api/calendar?month=2026-10')).body;
    expect(Object.keys(cal.days)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
    expect(Object.keys((await call('GET', '/api/calendar?month=2026-11')).body.days)).toContain('2026-11-01');
    expect((await call('GET', '/api/day?date=2026-10-27')).body.lessons[0]).toMatchObject({ direction_name: 'Танго', start_time: '19:00' });
  });
  it('выключенный шаблон пропадает; удалять шаблон может только владелица', async () => {
    const { call, dir } = await setup();
    const t = (await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '19:00' })).body;
    await call('PATCH', `/api/templates/${t.id}`, { active: false });
    expect((await call('GET', '/api/day?date=2026-10-27')).body.lessons).toHaveLength(0);
    expect((await call('DELETE', `/api/templates/${t.id}`, undefined, 2)).status).toBe(403);
  });
});

describe('оплаты и занятия', () => {
  it('«занимается» без записи — неоплата только для текущей и будущих недель', async () => {
    const { call, dir } = await setup();
    const c = (await call('POST', '/api/clients', { name: 'Анна', attends: [dir('Танго')] })).body;
    expect(c.id).toBeTruthy();
    await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '19:00' });
    expect((await call('GET', '/api/day?date=2020-01-07')).body.lessons[0].total).toBe(0);
    expect((await call('GET', '/api/day?date=2099-01-06')).body.lessons[0]).toMatchObject({ total: 1, paid: 0 });
  });
  it('оплата, записанная до появления расписания, привязывается к занятию после его создания', async () => {
    const { call, dir } = await setup();
    await call('POST', '/api/payments', { client_name: 'Анна', direction_id: dir('Танго'), week_start: '2026-10-26', amount: 1500, status: 'paid' });
    await call('POST', '/api/payments', { client_name: 'Динара', direction_id: dir('Танго'), week_start: '2026-10-26', amount: 1500, status: 'unpaid' });
    expect((await call('GET', '/api/day?date=2026-10-27')).body.lessons).toHaveLength(0);

    await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '19:00' });
    const lesson = (await call('GET', '/api/day?date=2026-10-27')).body.lessons[0];
    expect(lesson).toMatchObject({ paid: 1, total: 2, unpaid_names: ['Динара'] });
    const month = (await call('GET', '/api/calendar?month=2026-10')).body;
    expect(month.days['2026-10-27']).toEqual({ n: 1, unpaid: true });
  });
  it('оплата на конкретный день не попадает на другое занятие той же недели', async () => {
    const { call, dir } = await setup();
    await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 1, start_time: '19:00' });
    await call('POST', '/api/templates', { direction_id: dir('Танго'), weekday: 3, start_time: '19:00' });
    await call('POST', '/api/payments', { client_name: 'Анна', direction_id: dir('Танго'), lesson_date: '2026-10-27', amount: 700, status: 'paid' });
    const week = (await call('GET', '/api/week?date=2026-10-28')).body;
    expect(week.week_start).toBe('2026-10-26');
    expect(week.days[1].lessons[0].paid).toBe(1);
    expect(week.days[3].lessons[0].total).toBe(0);
  });
  it('баланс практики: считает лидеров и партнёрш, отмены не считаются', async () => {
    const { call, dir } = await setup();
    await call('POST', '/api/templates', { direction_id: dir('Практика'), weekday: 6, start_time: '18:00' });
    const reg = async (name: string, role: string, status = 'paid') => {
      const c = (await call('POST', '/api/clients', { name, role })).body;
      await call('POST', '/api/payments', { client_id: c.id, direction_id: dir('Практика'), week_start: '2026-10-26', amount: 500, status });
    };
    await reg('Игорь', 'lead'); await reg('Олег', 'lead'); await reg('Макс', 'lead');
    await reg('Анна', 'follow'); await reg('Света', 'follow', 'late_cancel');
    const p = (await call('GET', '/api/day?date=2026-11-01')).body.lessons[0];
    expect(p.balance).toEqual({ lead: 3, follow: 1, unknown: 0, missing_role: 'follow', missing: 2 });
    expect(p.cancelled).toBe(1);
  });
});
