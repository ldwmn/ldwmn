import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { parseAllowed } from './config.js';
import { addDays, thisAndNextMonth, todayMsk, weekStart } from './dates.js';
import { openDb } from './db.js';
import { seedDemo } from './seed.js';

const TOKEN = '123456:TEST';
const config = { botToken: TOKEN, webappUrl: '', port: 0, dbFile: ':memory:', initDataMaxAgeSec: 86400, allowed: parseAllowed('1,2') };

function auth(id: number) {
  const f = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'T' }) };
  const check = Object.entries(f).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const hash = createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex');
  return { authorization: `tma ${new URLSearchParams({ ...f, hash })}` };
}

async function setup() {
  const db = openDb();
  const app = await buildApp(config, db);
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object, as = 1) => {
    const res = await app.inject({ method, url, payload, headers: auth(as) });
    return { status: res.statusCode, body: res.body ? res.json() : null };
  };
  return { db, call };
}

describe('даты', () => {
  it('понедельник недели', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-19'); // суббота
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // воскресенье
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
  it('текущий и следующий месяц через границу года', () => {
    expect(thisAndNextMonth('2026-12-05')).toEqual(['2026-12', '2027-01']);
  });
});

describe('клиенты', () => {
  it('создание, поиск без учёта регистра, теги, мягкое удаление', async () => {
    const { call } = await setup();
    const dirs = (await call('GET', '/api/directions')).body as { id: number; name: string }[];
    expect(dirs.map((d) => d.name)).toContain('Танго');
    const tango = dirs.find((d) => d.name === 'Танго')!.id;

    const created = await call('POST', '/api/clients', { name: 'Динара Р.', role: 'follow', attends: [tango] });
    expect(created.status).toBe(201);
    await call('POST', '/api/clients', { name: 'Игорь', wants: [tango] });

    expect((await call('GET', '/api/clients?q=дИн')).body).toHaveLength(1);
    expect((await call('GET', `/api/clients?direction=${tango}`)).body).toHaveLength(2);

    await call('PATCH', `/api/clients/${created.body.id}`, { status: 'left' });
    expect((await call('GET', '/api/clients')).body).toHaveLength(1);
    expect((await call('GET', '/api/clients?status=left')).body).toHaveLength(1);
  });
  it('валидация и возврат на «занимается» сбрасывает месяц', async () => {
    const { call } = await setup();
    expect((await call('POST', '/api/clients', { name: ' ' })).status).toBe(400);
    const c = await call('POST', '/api/clients', { name: 'Оля', status: 'pause', return_on: '2026-12' });
    expect(c.body.return_on).toBe('2026-12');
    expect((await call('PATCH', `/api/clients/${c.body.id}`, { return_on: '12.2026' })).status).toBe(400);
    expect((await call('PATCH', `/api/clients/${c.body.id}`, { status: 'active' })).body.return_on).toBeNull();
  });
  it('физическое удаление — только владелица', async () => {
    const { call } = await setup();
    const c = await call('POST', '/api/clients', { name: 'Тест' });
    expect((await call('DELETE', `/api/clients/${c.body.id}`, undefined, 2)).status).toBe(403);
    expect((await call('DELETE', `/api/clients/${c.body.id}`)).status).toBe(204);
  });
});

describe('оплаты', () => {
  it('создаёт человека «на лету», нормализует неделю, считает сводку', async () => {
    const { call } = await setup();
    const tango = ((await call('GET', '/api/directions')).body as { id: number; name: string }[]).find((d) => d.name === 'Танго')!.id;
    const p1 = await call('POST', '/api/payments', { client_name: 'Динара', direction_id: tango, week_start: '2026-10-24', amount: 1500, status: 'paid' });
    expect(p1.status).toBe(201);
    expect(p1.body.week_start).toBe('2026-10-19');
    // то же имя в другом регистре — тот же человек
    await call('POST', '/api/payments', { client_name: 'динара', direction_id: tango, week_start: '2026-10-24', amount: 1500, status: 'unpaid' });
    await call('POST', '/api/payments', { client_name: 'Света', direction_id: tango, week_start: '2026-10-21', amount: 500, status: 'late_cancel' });
    expect((await call('GET', '/api/clients')).body).toHaveLength(2);

    const week = (await call('GET', '/api/payments?week=2026-10-22')).body;
    expect(week.summary).toEqual({ paid: 1, unpaid: 1, late_cancel: 1, sum: 1500 });
    expect((await call('GET', '/api/payments?week=2026-10-30')).body.payments).toHaveLength(0);
  });
  it('«Оплатил» одним PATCH, просрочка отмечается', async () => {
    const { call } = await setup();
    const tango = ((await call('GET', '/api/directions')).body as { id: number }[])[2].id;
    const old = await call('POST', '/api/payments', { client_name: 'А', direction_id: tango, week_start: '2020-01-06', amount: 100, status: 'unpaid' });
    const future = await call('POST', '/api/payments', { client_name: 'Б', direction_id: tango, week_start: addDays(todayMsk(), 14), amount: 100, status: 'unpaid' });
    const unpaid = (await call('GET', '/api/payments/unpaid')).body as { id: number; overdue: boolean }[];
    expect(unpaid.find((u) => u.id === old.body.id)!.overdue).toBe(true);
    expect(unpaid.find((u) => u.id === future.body.id)!.overdue).toBe(false);
    expect((await call('PATCH', `/api/payments/${old.body.id}`, { status: 'paid' })).body.status).toBe('paid');
    expect((await call('GET', '/api/payments/unpaid')).body).toHaveLength(1);
  });
});

describe('«Сегодня» и направления на демо-данных', () => {
  it('пауза с месяцем возвращения попадает в «Написать»; видно, кто занимается и ждёт', async () => {
    const { db, call } = await setup();
    expect(seedDemo(db)).toBe(true);
    expect(seedDemo(db)).toBe(false);
    const today = (await call('GET', '/api/today')).body;
    expect(today.write_to.map((c: { name: string }) => c.name).sort()).toEqual(['Максим Т.', 'Оля В.']);
    expect(today.unpaid.some((u: { overdue: boolean }) => u.overdue)).toBe(true);
    const overview = (await call('GET', '/api/directions/overview')).body as { name: string; attends: unknown[]; wants: unknown[] }[];
    const tango = overview.find((d) => d.name === 'Танго')!;
    expect(tango.attends.length).toBe(4);
    expect(tango.wants.length).toBe(1);
  });
});
