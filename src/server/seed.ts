import { addDays, todayMsk, weekStart } from './dates.js';
import type { DB } from './db.js';

/** Демо-данные для показа заказчице. Не затирает уже существующих людей. */
export function seedDemo(db: DB, today = todayMsk()) {
  if ((db.prepare('SELECT COUNT(*) AS n FROM client').get() as { n: number }).n > 0) return false;
  const dir = (n: string) => (db.prepare('SELECT id FROM direction WHERE name = ?').get(n) as { id: number }).id;
  const [fs, rumba, tango, begin, practice] = ['Женский стиль', 'Румба', 'Танго', 'Для начинающих', 'Практика'].map(dir);
  const [thisM, nextM] = (() => {
    const [y, m] = today.split('-').map(Number);
    const n = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    return [today.slice(0, 7), n];
  })();

  const addClient = db.prepare('INSERT INTO client (name, contact, status, role, return_on, note) VALUES (?,?,?,?,?,?)');
  const link = db.prepare('INSERT INTO client_direction (client_id, direction_id, kind) VALUES (?,?,?)');
  const pay = db.prepare('INSERT INTO payment (client_id, direction_id, week_start, amount, status, note) VALUES (?,?,?,?,?,?)');

  const tpl = db.prepare('INSERT INTO lesson_template (direction_id, weekday, start_time, duration_min, place, default_price) VALUES (?,?,?,?,?,?)');

  db.transaction(() => {
    tpl.run(tango, 1, '19:00', 90, 'Зал на Тверской', 1500);
    tpl.run(rumba, 1, '20:30', 90, 'Зал на Тверской', 1500);
    tpl.run(fs, 3, '19:00', 60, 'Зал на Тверской', 1500);
    tpl.run(practice, 6, '18:00', 120, 'Зал на Тверской', 500);
    const c = (name: string, role: string | null, status = 'active', returnOn: string | null = null, note: string | null = null, contact: string | null = null) =>
      Number(addClient.run(name, contact, status, role, returnOn, note).lastInsertRowid);
    const dinara = c('Динара Р.', 'follow', 'active', null, null, '@dinara_r');
    const anna = c('Анна К.', 'follow', 'active', null, null, '+7 900 000-00-01');
    const igor = c('Игорь С.', 'lead');
    const oleg = c('Олег М.', 'lead');
    const sveta = c('Света Л.', 'follow');
    const olya = c('Оля В.', 'follow', 'pause', nextM, 'Декрет, вернётся к занятиям');
    const maks = c('Максим Т.', 'lead', 'pause', thisM, 'Уехал в командировку');
    const lena = c('Лена Н.', 'follow', 'active', null, 'Хочет в группу для начинающих');
    c('Пётр Д.', 'lead', 'left');

    for (const [id, d] of [[dinara, tango], [anna, tango], [anna, rumba], [igor, tango], [oleg, tango], [sveta, practice], [igor, practice], [dinara, practice]] as const) link.run(id, d, 'attends');
    for (const [id, d] of [[sveta, tango], [lena, begin], [dinara, fs], [anna, fs], [oleg, rumba]] as const) link.run(id, d, 'wants');

    const ws = weekStart(today);
    const prev = addDays(ws, -7);
    pay.run(anna, tango, ws, 1500, 'paid', null);
    pay.run(igor, tango, ws, 1500, 'paid', null);
    pay.run(oleg, tango, ws, 1500, 'paid', null);
    pay.run(dinara, tango, ws, 1500, 'unpaid', null);
    pay.run(anna, rumba, ws, 1500, 'paid', null);
    pay.run(oleg, practice, ws, 500, 'paid', null);
    pay.run(igor, practice, ws, 500, 'paid', null);
    pay.run(dinara, practice, ws, 500, 'unpaid', null);
    pay.run(sveta, practice, ws, 500, 'late_cancel', 'Отменила в день практики');
    pay.run(dinara, practice, prev, 500, 'unpaid', 'С прошлой недели');
    pay.run(igor, practice, addDays(ws, 7), 500, 'paid', 'Оплатил вперёд, расписания ещё нет');
    void olya; void maks;
  })();
  return true;
}
