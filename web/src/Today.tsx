import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { dayMonth, monthName, rub } from './format';
import { haptic } from './hooks';
import type { Today as TodayData } from './types';

export function Today({ onOpenPerson, onPay }: { onOpenPerson: (id: number) => void; onPay: () => void }) {
  const [data, setData] = useState<TodayData | null>(null);
  const load = useCallback(() => void api.today().then(setData), []);
  useEffect(load, [load]);
  if (!data) return <main className="screen"><p className="muted">Загрузка…</p></main>;

  const markPaid = async (id: number) => {
    await api.setPayment(id, { status: 'paid' });
    haptic();
    load();
  };
  const nothing = !data.write_to.length && !data.unpaid.length && !data.waiting.length;

  return (
    <main className="screen">
      <h1>Сегодня, {dayMonth(data.date)}</h1>
      {nothing && <div className="empty"><b>На сегодня дел нет</b><div>Добавьте людей и оплаты, чтобы здесь появились напоминания.</div></div>}

      {data.write_to.length > 0 && (
        <section>
          <h2>Кому написать</h2>
          <div className="card">
            {data.write_to.map((c) => (
              <button key={c.id} className="row" onClick={() => onOpenPerson(c.id)}>
                <span className="grow">
                  <b>{c.name}</b>
                  <span className="sub">вернётся: {monthName(c.return_on)}{c.note ? ` · ${c.note}` : ''}</span>
                </span>
                {c.contact && <span className="sub">{c.contact}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {data.unpaid.length > 0 && (
        <section>
          <h2>Не оплатили</h2>
          <div className="card">
            {data.unpaid.map((p) => (
              <div key={p.id} className="row">
                <span className="grow">
                  <b>{p.client_name}</b>
                  <span className="sub">{p.direction_name} · {rub(p.amount)} · неделя с {dayMonth(p.week_start)}</span>
                </span>
                {p.overdue && <span className="badge bad">просрочено</span>}
                <button className="chip" onClick={() => markPaid(p.id)}>Оплатил</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.waiting.length > 0 && (
        <section>
          <h2>Ждут занятий</h2>
          <div className="card">
            {data.waiting.map((w) => (
              <div key={w.id} className="row"><span className="grow"><b>{w.name}</b></span><span className="badge warn">{w.count}</span></div>
            ))}
          </div>
        </section>
      )}
      <button className="link" onClick={onPay}>+ Записать оплату</button>
    </main>
  );
}
