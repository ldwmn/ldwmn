const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
export const dayMonth = (d: string) => `${Number(d.slice(8))} ${MONTHS_GEN[Number(d.slice(5, 7)) - 1]}`;
export const weekLabel = (ws: string) => {
  const end = new Date(`${ws}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${dayMonth(ws)} – ${dayMonth(end.toISOString().slice(0, 10))}`;
};
export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const rub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;
export const ROLE_LABEL = { lead: 'лидер', follow: 'партнёрша' } as const;
export const STATUS_LABEL = { active: 'Занимается', pause: 'Пауза', left: 'Не ходит' } as const;
export const PAY_LABEL = { paid: 'Оплачено', unpaid: 'Не оплачено', late_cancel: 'Отмена' } as const;
export const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
export const weekdayOf = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
export const dayTitle = (d: string) => `${WEEKDAYS[weekdayOf(d)]}, ${dayMonth(d)}`;
export const shiftMonth = (ym: string, n: number) => {
  const t = (Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5)) - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const todayStr = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
