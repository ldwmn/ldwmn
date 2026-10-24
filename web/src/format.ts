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
