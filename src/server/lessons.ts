import type { FastifyInstance, FastifyReply } from 'fastify';
import { addDays, isDate, isMonth, todayMsk, weekStart } from './dates.js';
import type { DB } from './db.js';

type Body = Record<string, unknown>;
const bad = (reply: FastifyReply, msg: string) => reply.code(400).send({ error: msg });
const isTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const text = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const PRACTICE = 'Практика';

interface Occurrence {
  key: string;
  date: string;
  direction_id: number;
  direction_name: string;
  start_time: string;
  duration_min: number;
  place: string | null;
  template_id: number | null;
  lesson_id: number | null;
  note: string | null;
}

type PersonState = 'paid' | 'unpaid' | 'cancel';
interface Person {
  id: number;
  name: string;
  role: 'lead' | 'follow' | null;
  state: PersonState;
  /** есть явная запись об оплате (а не просто отметка «занимается») */
  registered: boolean;
}

/** Занятия за период: недельные шаблоны, развёрнутые по датам, плюс разовые. */
export function occurrences(db: DB, from: string, to: string): Occurrence[] {
  const dirs = db.prepare('SELECT id, name FROM direction').all() as { id: number; name: string }[];
  const dirName = (id: number) => dirs.find((d) => d.id === id)?.name ?? '';
  const out: Occurrence[] = [];

  const templates = db.prepare('SELECT * FROM lesson_template WHERE active = 1').all() as {
    id: number; direction_id: number; weekday: number; start_time: string; duration_min: number; place: string | null;
  }[];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const weekday = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
    for (const t of templates.filter((x) => x.weekday === weekday)) {
      out.push({
        key: `t${t.id}:${d}`, date: d, direction_id: t.direction_id, direction_name: dirName(t.direction_id),
        start_time: t.start_time, duration_min: t.duration_min, place: t.place, template_id: t.id, lesson_id: null, note: null,
      });
    }
  }
  const lessons = db.prepare('SELECT * FROM lesson WHERE date BETWEEN ? AND ?').all(from, to) as {
    id: number; direction_id: number; date: string; start_time: string; duration_min: number; place: string | null; note: string | null;
  }[];
  for (const l of lessons) {
    out.push({
      key: `l${l.id}`, date: l.date, direction_id: l.direction_id, direction_name: dirName(l.direction_id),
      start_time: l.start_time, duration_min: l.duration_min, place: l.place, template_id: null, lesson_id: l.id, note: l.note,
    });
  }
  return out.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
}

/**
 * Оплаты привязываются к занятию динамически: по направлению и неделе
 * (и по дню, если он указан) — поэтому оплата, пришедшая до расписания, находится сама.
 */
export function enrich(db: DB, occs: Occurrence[]) {
  if (!occs.length) return [];
  const weeks = [...new Set(occs.map((o) => weekStart(o.date)))];
  const payments = db
    .prepare(
      `SELECT p.direction_id, p.week_start, p.lesson_date, p.status, c.id AS cid, c.name, c.role
       FROM payment p JOIN client c ON c.id = p.client_id
       WHERE c.status != 'left' AND p.week_start IN (${weeks.map(() => '?').join(',')})`,
    )
    .all(...weeks) as { direction_id: number; week_start: string; lesson_date: string | null; status: string; cid: number; name: string; role: Person['role'] }[];
  const attends = db
    .prepare(`SELECT cd.direction_id, c.id, c.name, c.role FROM client_direction cd JOIN client c ON c.id = cd.client_id WHERE cd.kind = 'attends' AND c.status = 'active'`)
    .all() as { direction_id: number; id: number; name: string; role: Person['role'] }[];
  const wants = db
    .prepare(`SELECT cd.direction_id, COUNT(*) AS n FROM client_direction cd JOIN client c ON c.id = cd.client_id WHERE cd.kind = 'wants' AND c.status != 'left' GROUP BY cd.direction_id`)
    .all() as { direction_id: number; n: number }[];

  // «Занимается, но записи нет» считаем неоплатой только для текущей и будущих недель:
  // про прошедшие недели без записей мы ничего не знаем, красить их незачем.
  const currentWeek = weekStart(todayMsk());

  return occs.map((o) => {
    const people = new Map<number, Person>();
    const implicit = weekStart(o.date) >= currentWeek;
    for (const a of attends.filter((x) => implicit && x.direction_id === o.direction_id)) {
      people.set(a.id, { id: a.id, name: a.name, role: a.role, state: 'unpaid', registered: false });
    }
    const rows = payments.filter((p) => p.direction_id === o.direction_id && p.week_start === weekStart(o.date) && (!p.lesson_date || p.lesson_date === o.date));
    for (const p of rows) {
      const state: PersonState = p.status === 'paid' ? 'paid' : p.status === 'late_cancel' ? 'cancel' : 'unpaid';
      const prev = people.get(p.cid);
      // если у человека несколько записей, «оплачено» важнее остальных
      if (prev?.registered && prev.state === 'paid') continue;
      people.set(p.cid, { id: p.cid, name: p.name, role: p.role, state, registered: true });
    }
    const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const active = list.filter((p) => p.state !== 'cancel');
    const paid = active.filter((p) => p.state === 'paid').length;
    const is_practice = o.direction_name === PRACTICE;

    let balance: null | { lead: number; follow: number; unknown: number; missing_role: 'lead' | 'follow' | null; missing: number } = null;
    if (is_practice) {
      const reg = list.filter((p) => p.registered && p.state !== 'cancel');
      const lead = reg.filter((p) => p.role === 'lead').length;
      const follow = reg.filter((p) => p.role === 'follow').length;
      balance = {
        lead, follow, unknown: reg.filter((p) => !p.role).length,
        missing_role: lead === follow ? null : lead > follow ? 'follow' : 'lead',
        missing: Math.abs(lead - follow),
      };
    }
    return {
      ...o,
      is_practice,
      total: active.length,
      paid,
      unpaid_names: active.filter((p) => p.state === 'unpaid').map((p) => p.name),
      cancelled: list.length - active.length,
      wants: wants.find((w) => w.direction_id === o.direction_id)?.n ?? 0,
      people: list,
      balance,
    };
  });
}

export function registerLessons(api: FastifyInstance, db: DB) {
  const isOwner = (req: { authed?: { role: string } }) => req.authed?.role === 'owner';
  const lessonsOn = (from: string, to: string) => enrich(db, occurrences(db, from, to));

  api.get('/calendar', async (req, reply) => {
    const month = (req.query as Body).month;
    if (!isMonth(month)) return bad(reply, 'month: ГГГГ-ММ');
    const from = `${month}-01`;
    let to = from;
    for (let d = from; d.startsWith(month); d = addDays(d, 1)) to = d;
    const days: Record<string, { n: number; unpaid: boolean }> = {};
    for (const l of lessonsOn(from, to)) {
      const day = (days[l.date] ??= { n: 0, unpaid: false });
      day.n++;
      if (l.total - l.paid > 0) day.unpaid = true;
    }
    return { month, days };
  });

  api.get('/day', async (req, reply) => {
    const date = (req.query as Body).date;
    if (!isDate(date)) return bad(reply, 'date: ГГГГ-ММ-ДД');
    return { date, lessons: lessonsOn(date, date) };
  });

  api.get('/week', async (req, reply) => {
    const date = (req.query as Body).date;
    if (!isDate(date)) return bad(reply, 'date: ГГГГ-ММ-ДД');
    const ws = weekStart(date);
    const all = lessonsOn(ws, addDays(ws, 6));
    return { week_start: ws, days: Array.from({ length: 7 }, (_, i) => ({ date: addDays(ws, i), lessons: all.filter((l) => l.date === addDays(ws, i)) })) };
  });

  // ---------- расписание ----------
  const TEMPLATE_SELECT = `SELECT t.*, d.name AS direction_name FROM lesson_template t JOIN direction d ON d.id = t.direction_id`;
  api.get('/templates', async () => db.prepare(`${TEMPLATE_SELECT} ORDER BY t.active DESC, t.weekday, t.start_time`).all());

  function lessonFields(b: Body): { error: string } | { f: { direction_id: number; start_time: string; duration_min: number; place: string | null } } {
    const direction_id = Number(b.direction_id);
    if (!db.prepare('SELECT 1 FROM direction WHERE id = ?').get(direction_id)) return { error: 'Укажите направление' };
    if (!isTime(b.start_time)) return { error: 'Время: ЧЧ:ММ' };
    const duration_min = Math.round(Number(b.duration_min ?? 60));
    if (!(duration_min > 0 && duration_min <= 600)) return { error: 'Неверная длительность' };
    return { f: { direction_id, start_time: b.start_time, duration_min, place: text(b.place) } };
  }

  api.post('/templates', async (req, reply) => {
    const b = (req.body ?? {}) as Body;
    const v = lessonFields(b);
    if ('error' in v) return bad(reply, v.error);
    const weekday = Number(b.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return bad(reply, 'Неверный день недели');
    const price = b.default_price == null || b.default_price === '' ? null : Math.round(Number(b.default_price));
    if (price !== null && !(price >= 0)) return bad(reply, 'Неверная цена');
    const info = db
      .prepare('INSERT INTO lesson_template (direction_id, weekday, start_time, duration_min, place, default_price) VALUES (@direction_id,@weekday,@start_time,@duration_min,@place,@price)')
      .run({ ...v.f, weekday, price });
    return reply.code(201).send(db.prepare(`${TEMPLATE_SELECT} WHERE t.id = ?`).get(info.lastInsertRowid));
  });

  api.patch('/templates/:id', async (req, reply) => {
    const id = Number((req.params as Body).id);
    const b = (req.body ?? {}) as Body;
    if (typeof b.active !== 'boolean') return bad(reply, 'active: true/false');
    const res = db.prepare('UPDATE lesson_template SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id);
    if (!res.changes) return reply.code(404).send({ error: 'not found' });
    return db.prepare(`${TEMPLATE_SELECT} WHERE t.id = ?`).get(id);
  });

  api.delete('/templates/:id', async (req, reply) => {
    if (!isOwner(req)) return reply.code(403).send({ error: 'Только владелица' });
    db.prepare('DELETE FROM lesson_template WHERE id = ?').run(Number((req.params as Body).id));
    return reply.code(204).send();
  });

  api.post('/lessons', async (req, reply) => {
    const b = (req.body ?? {}) as Body;
    const v = lessonFields(b);
    if ('error' in v) return bad(reply, v.error);
    if (!isDate(b.date)) return bad(reply, 'Неверная дата');
    const info = db
      .prepare('INSERT INTO lesson (direction_id, date, start_time, duration_min, place, note) VALUES (@direction_id,@date,@start_time,@duration_min,@place,@note)')
      .run({ ...v.f, date: b.date, note: text(b.note, 500) });
    return reply.code(201).send({ id: Number(info.lastInsertRowid) });
  });

  api.delete('/lessons/:id', async (req, reply) => {
    if (!isOwner(req)) return reply.code(403).send({ error: 'Только владелица' });
    db.prepare('DELETE FROM lesson WHERE id = ?').run(Number((req.params as Body).id));
    return reply.code(204).send();
  });
}
