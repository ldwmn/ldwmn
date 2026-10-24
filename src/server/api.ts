import type { FastifyInstance, FastifyReply } from 'fastify';
import { addDays, isDate, isMonth, thisAndNextMonth, todayMsk, weekStart } from './dates.js';
import type { DB } from './db.js';

const STATUSES = ['active', 'pause', 'left'];
const ROLES = ['lead', 'follow'];
const PAY_STATUSES = ['paid', 'unpaid', 'late_cancel'];

type Body = Record<string, unknown>;
const bad = (reply: FastifyReply, msg: string) => reply.code(400).send({ error: msg });
const text = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

interface ClientRow {
  id: number;
  name: string;
  contact: string | null;
  status: string;
  role: string | null;
  return_on: string | null;
  note: string | null;
}

export function registerApi(api: FastifyInstance, db: DB) {
  const isOwner = (req: { authed?: { role: string } }) => req.authed?.role === 'owner';

  // ---------- клиенты ----------
  function withDirections(rows: ClientRow[]) {
    const links = db.prepare('SELECT client_id, direction_id, kind FROM client_direction').all() as {
      client_id: number;
      direction_id: number;
      kind: 'attends' | 'wants';
    }[];
    return rows.map((c) => ({
      ...c,
      attends: links.filter((l) => l.client_id === c.id && l.kind === 'attends').map((l) => l.direction_id),
      wants: links.filter((l) => l.client_id === c.id && l.kind === 'wants').map((l) => l.direction_id),
    }));
  }

  function getClient(id: number) {
    const row = db.prepare('SELECT * FROM client WHERE id = ?').get(id) as ClientRow | undefined;
    return row ? withDirections([row])[0] : undefined;
  }

  api.get('/clients', async (req) => {
    const { q, status, direction } = req.query as Record<string, string | undefined>;
    let rows = db.prepare('SELECT * FROM client ORDER BY name COLLATE NOCASE').all() as ClientRow[];
    rows = rows.filter((c) => (status && status !== 'all' ? c.status === status : c.status !== 'left'));
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((c) =>
        [c.name, c.note, c.contact].some((f) => f?.toLowerCase().includes(needle)),
      );
    }
    let result = withDirections(rows);
    if (direction) {
      const d = Number(direction);
      result = result.filter((c) => c.attends.includes(d) || c.wants.includes(d));
    }
    return result;
  });

  api.get('/clients/:id', async (req, reply) => {
    const c = getClient(Number((req.params as Body).id));
    return c ?? reply.code(404).send({ error: 'not found' });
  });

  function validateClient(b: Body, partial: boolean): { error: string } | { fields: Record<string, unknown> } {
    const f: Record<string, unknown> = {};
    if (!partial || 'name' in b) {
      const name = text(b.name, 100);
      if (!name) return { error: 'Укажите имя' };
      f.name = name;
    }
    if ('contact' in b) f.contact = text(b.contact, 100);
    if ('note' in b) f.note = text(b.note, 1000);
    if ('status' in b) {
      if (!STATUSES.includes(b.status as string)) return { error: 'Неверный статус' };
      f.status = b.status;
    }
    if ('role' in b) {
      if (b.role !== null && !ROLES.includes(b.role as string)) return { error: 'Неверная роль' };
      f.role = b.role;
    }
    if ('return_on' in b) {
      if (b.return_on !== null && !isMonth(b.return_on)) return { error: 'Месяц возвращения: ГГГГ-ММ' };
      f.return_on = b.return_on;
    }
    return { fields: f };
  }

  function setDirections(clientId: number, b: Body) {
    const attends = Array.isArray(b.attends) ? (b.attends as number[]) : null;
    const wants = Array.isArray(b.wants) ? (b.wants as number[]) : null;
    if (!attends && !wants) return;
    db.transaction(() => {
      db.prepare('DELETE FROM client_direction WHERE client_id = ?').run(clientId);
      const ins = db.prepare('INSERT OR REPLACE INTO client_direction (client_id, direction_id, kind) VALUES (?,?,?)');
      for (const d of wants ?? []) ins.run(clientId, d, 'wants');
      for (const d of attends ?? []) ins.run(clientId, d, 'attends');
    })();
  }

  api.post('/clients', async (req, reply) => {
    const b = (req.body ?? {}) as Body;
    const v = validateClient(b, false);
    if ('error' in v) return bad(reply, v.error);
    const f = { status: 'active', contact: null, note: null, role: null, return_on: null, ...v.fields };
    const info = db
      .prepare('INSERT INTO client (name, contact, status, role, return_on, note) VALUES (@name,@contact,@status,@role,@return_on,@note)')
      .run(f);
    setDirections(Number(info.lastInsertRowid), b);
    return reply.code(201).send(getClient(Number(info.lastInsertRowid)));
  });

  api.patch('/clients/:id', async (req, reply) => {
    const id = Number((req.params as Body).id);
    if (!getClient(id)) return reply.code(404).send({ error: 'not found' });
    const b = (req.body ?? {}) as Body;
    const v = validateClient(b, true);
    if ('error' in v) return bad(reply, v.error);
    const f = v.fields;
    if (f.status === 'active') f.return_on = null;
    const cols = Object.keys(f);
    if (cols.length) {
      db.prepare(`UPDATE client SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...f, id });
    }
    setDirections(id, b);
    return getClient(id);
  });

  // Физическое удаление — только владелица; «мягкое» делается через status = left.
  api.delete('/clients/:id', async (req, reply) => {
    if (!isOwner(req)) return reply.code(403).send({ error: 'Только владелица' });
    db.prepare('DELETE FROM client WHERE id = ?').run(Number((req.params as Body).id));
    return reply.code(204).send();
  });

  // ---------- направления ----------
  api.get('/directions', async () => db.prepare('SELECT id, name FROM direction ORDER BY sort, id').all());

  api.post('/directions', async (req, reply) => {
    const name = text((req.body as Body)?.name, 60);
    if (!name) return bad(reply, 'Укажите название');
    try {
      const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM direction').get() as { n: number }).n;
      const info = db.prepare('INSERT INTO direction (name, sort) VALUES (?, ?)').run(name, sort);
      return reply.code(201).send({ id: Number(info.lastInsertRowid), name });
    } catch {
      return bad(reply, 'Такое направление уже есть');
    }
  });

  api.get('/directions/overview', async () => {
    const dirs = db.prepare('SELECT id, name FROM direction ORDER BY sort, id').all() as { id: number; name: string }[];
    const links = db
      .prepare(
        `SELECT cd.direction_id, cd.kind, c.id, c.name FROM client_direction cd
         JOIN client c ON c.id = cd.client_id WHERE c.status != 'left' ORDER BY c.name COLLATE NOCASE`,
      )
      .all() as { direction_id: number; kind: string; id: number; name: string }[];
    return dirs.map((d) => ({
      ...d,
      attends: links.filter((l) => l.direction_id === d.id && l.kind === 'attends').map(({ id, name }) => ({ id, name })),
      wants: links.filter((l) => l.direction_id === d.id && l.kind === 'wants').map(({ id, name }) => ({ id, name })),
    }));
  });

  // ---------- оплаты ----------
  const PAY_SELECT = `SELECT p.id, p.client_id, c.name AS client_name, p.direction_id, d.name AS direction_name,
      p.week_start, p.lesson_date, p.amount, p.status, p.note
    FROM payment p JOIN client c ON c.id = p.client_id JOIN direction d ON d.id = p.direction_id`;

  api.get('/payments', async (req, reply) => {
    const week = (req.query as Body).week;
    if (!isDate(week)) return bad(reply, 'week: ГГГГ-ММ-ДД');
    const ws = weekStart(week);
    const rows = db.prepare(`${PAY_SELECT} WHERE p.week_start = ? ORDER BY d.sort, c.name COLLATE NOCASE`).all(ws) as {
      status: string;
      amount: number;
    }[];
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      week_start: ws,
      summary: {
        paid: count('paid'),
        unpaid: count('unpaid'),
        late_cancel: count('late_cancel'),
        sum: rows.filter((r) => r.status === 'paid').reduce((a, r) => a + r.amount, 0),
      },
      payments: rows,
    };
  });

  function unpaidList() {
    const today = todayMsk();
    const rows = db
      .prepare(`${PAY_SELECT} WHERE p.status = 'unpaid' AND c.status != 'left' ORDER BY p.week_start, c.name COLLATE NOCASE`)
      .all() as { week_start: string; lesson_date: string | null }[];
    return rows.map((r) => ({ ...r, overdue: (r.lesson_date ?? addDays(r.week_start, 6)) < today }));
  }

  api.get('/payments/unpaid', async () => unpaidList());

  api.post('/payments', async (req, reply) => {
    const b = (req.body ?? {}) as Body;
    let clientId = Number(b.client_id);
    if (!clientId) {
      const name = text(b.client_name, 100);
      if (!name) return bad(reply, 'Укажите человека');
      const found = (db.prepare('SELECT id, name FROM client').all() as { id: number; name: string }[]).find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      clientId = found
        ? found.id
        : Number(db.prepare("INSERT INTO client (name, status) VALUES (?, 'active')").run(name).lastInsertRowid);
    } else if (!getClient(clientId)) return bad(reply, 'Человек не найден');
    const directionId = Number(b.direction_id);
    if (!db.prepare('SELECT 1 FROM direction WHERE id = ?').get(directionId)) return bad(reply, 'Укажите направление');
    const status = (b.status as string) ?? 'paid';
    if (!PAY_STATUSES.includes(status)) return bad(reply, 'Неверный статус');
    const date = b.lesson_date ?? b.week_start ?? todayMsk();
    if (!isDate(date)) return bad(reply, 'Неверная дата');
    const amount = Math.round(Number(b.amount ?? 0));
    if (!Number.isFinite(amount) || amount < 0) return bad(reply, 'Неверная сумма');
    const info = db
      .prepare('INSERT INTO payment (client_id, direction_id, week_start, lesson_date, amount, status, note) VALUES (?,?,?,?,?,?,?)')
      .run(clientId, directionId, weekStart(date), b.lesson_date && isDate(b.lesson_date) ? b.lesson_date : null, amount, status, text(b.note));
    return reply.code(201).send(db.prepare(`${PAY_SELECT} WHERE p.id = ?`).get(info.lastInsertRowid));
  });

  api.patch('/payments/:id', async (req, reply) => {
    const id = Number((req.params as Body).id);
    const b = (req.body ?? {}) as Body;
    const f: Record<string, unknown> = {};
    if ('status' in b) {
      if (!PAY_STATUSES.includes(b.status as string)) return bad(reply, 'Неверный статус');
      f.status = b.status;
    }
    if ('amount' in b) {
      const amount = Math.round(Number(b.amount));
      if (!Number.isFinite(amount) || amount < 0) return bad(reply, 'Неверная сумма');
      f.amount = amount;
    }
    if ('note' in b) f.note = text(b.note);
    const cols = Object.keys(f);
    if (!cols.length) return bad(reply, 'Нечего менять');
    const res = db.prepare(`UPDATE payment SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...f, id });
    if (!res.changes) return reply.code(404).send({ error: 'not found' });
    return db.prepare(`${PAY_SELECT} WHERE p.id = ?`).get(id);
  });

  api.delete('/payments/:id', async (req, reply) => {
    if (!isOwner(req)) return reply.code(403).send({ error: 'Только владелица' });
    db.prepare('DELETE FROM payment WHERE id = ?').run(Number((req.params as Body).id));
    return reply.code(204).send();
  });

  // ---------- «Сегодня» ----------
  api.get('/today', async () => {
    const today = todayMsk();
    const months = thisAndNextMonth(today);
    const writeTo = db
      .prepare("SELECT id, name, contact, return_on, note FROM client WHERE status = 'pause' AND return_on IN (?, ?) ORDER BY return_on, name COLLATE NOCASE")
      .all(...months);
    const waiting = db
      .prepare(
        `SELECT d.id, d.name, COUNT(c.id) AS count FROM direction d
         JOIN client_direction cd ON cd.direction_id = d.id AND cd.kind = 'wants'
         JOIN client c ON c.id = cd.client_id AND c.status != 'left'
         GROUP BY d.id ORDER BY d.sort`,
      )
      .all();
    return { date: today, week_start: weekStart(today), write_to: writeTo, unpaid: unpaidList(), waiting };
  });
}
