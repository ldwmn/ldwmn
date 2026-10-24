const TZ = 'Europe/Moscow';

/** Сегодняшняя дата в Москве, YYYY-MM-DD. */
export function todayMsk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
}

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

/** Понедельник недели, в которую попадает дата. */
export function weekStart(d: string): string {
  const dow = (toUtc(d).getUTCDay() + 6) % 7; // пн = 0
  return addDays(d, -dow);
}

export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());

export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Месяц (YYYY-MM) текущей даты и следующий за ним. */
export function thisAndNextMonth(today: string): [string, string] {
  const [y, m] = today.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [today.slice(0, 7), next];
}
