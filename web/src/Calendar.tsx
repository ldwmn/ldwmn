import { useEffect, useState } from 'react';
import { api } from './api';
import { addDays, dayTitle, monthName, shiftMonth, todayStr, WEEKDAYS_SHORT, weekdayOf, weekLabel } from './format';
import type { CalendarMonth, LessonView, WeekView } from './types';

const ROLE_WORD = { lead: 'лидеров', follow: 'партнёрш' } as const;

function LessonCard({ l, open, onToggle, onOpenPerson }: { l: LessonView; open: boolean; onToggle: () => void; onOpenPerson: (id: number) => void }) {
  const debt = l.total - l.paid;
  const forming = l.total === 0 && l.wants > 0;
  const sub = forming
    ? `Группа пока не собрана · ждут ${l.wants}`
    : l.total === 0
      ? 'Пока никто не записан'
      : `Оплатили ${l.paid} из ${l.total}${l.unpaid_names.length ? ` · не оплатили: ${l.unpaid_names.join(', ')}` : ''}`;
  return (
    <div className="lesson">
      <button className="row" aria-expanded={open} onClick={onToggle}>
        <span className="grow">
          <b>{l.direction_name} · {l.start_time}</b>
          <span className="sub">{sub}</span>
        </span>
        {debt > 0 ? <span className="badge bad">{debt} долг</span> : forming ? <span className="badge warn">Набор</span> : l.total > 0 ? <span className="badge ok">все оплатили</span> : null}
      </button>
      {open && (
        <div className="detail">
          <p className="sub">{l.duration_min} мин{l.place ? ` · ${l.place}` : ''}{l.cancelled ? ` · отмен: ${l.cancelled}` : ''}</p>
          {l.balance && (
            <p className={`balance ${l.balance.missing ? 'warn' : 'ok'}`}>
              Лидеров {l.balance.lead}, партнёрш {l.balance.follow}
              {l.balance.missing_role ? ` — не хватает ${l.balance.missing} ${ROLE_WORD[l.balance.missing_role]}` : l.balance.lead ? ' — баланс ровный' : ''}
              {l.balance.unknown ? ` (без роли: ${l.balance.unknown})` : ''}
            </p>
          )}
          {l.people.length === 0 && <p className="sub">Нет записей об оплате за эту неделю.</p>}
          {l.people.map((p) => (
            <button key={p.id} className="person" onClick={() => onOpenPerson(p.id)}>
              <span>{p.name}{p.role ? <span className="sub inl"> · {p.role === 'lead' ? 'лидер' : 'партнёрша'}</span> : null}</span>
              <span className={`badge ${p.state === 'paid' ? 'ok' : p.state === 'unpaid' ? 'bad' : 'warn'}`}>
                {p.state === 'paid' ? 'оплатил' : p.state === 'unpaid' ? 'не оплатил' : 'отмена'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i)).filter((d, i) => i < 35 || d.startsWith(month));
}

export function Calendar({ onOpenPerson, onAddLesson, refreshKey }: { onOpenPerson: (id: number) => void; onAddLesson: (date: string) => void; refreshKey: number }) {
  const today = todayStr();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [cal, setCal] = useState<CalendarMonth | null>(null);
  const [lessons, setLessons] = useState<LessonView[]>([]);
  const [week, setWeek] = useState<WeekView | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => void api.calendar(month).then(setCal), [month, refreshKey]);
  useEffect(() => { if (mode === 'month') void api.day(selected).then((r) => setLessons(r.lessons)); }, [selected, mode, refreshKey]);
  useEffect(() => { if (mode === 'week') void api.weekView(selected).then(setWeek); }, [selected, mode, refreshKey]);

  const card = (l: LessonView) => <LessonCard key={l.key} l={l} open={openKey === l.key} onToggle={() => setOpenKey(openKey === l.key ? null : l.key)} onOpenPerson={onOpenPerson} />;
  const step = (n: number) => {
    if (mode === 'week') { const d = addDays(selected, 7 * n); setSelected(d); setMonth(d.slice(0, 7)); }
    else setMonth(shiftMonth(month, n));
  };
  const title = mode === 'month' ? monthName(month).replace(/^./, (c) => c.toUpperCase()) : week ? weekLabel(week.week_start) : '';

  return (
    <main className="screen">
      <div className="calhead">
        <h1>{title}</h1>
        <div className="calnav">
          <button className="sq" aria-label="Назад" onClick={() => step(-1)}>‹</button>
          <button className="sq" aria-label="Вперёд" onClick={() => step(1)}>›</button>
        </div>
      </div>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === 'month'} onClick={() => setMode('month')}>Месяц</button>
        <button role="tab" aria-selected={mode === 'week'} onClick={() => setMode('week')}>Неделя</button>
      </div>

      {mode === 'month' && (
        <>
          <div className="card pad month">
            <div className="grid7">{WEEKDAYS_SHORT.map((w) => <span key={w} className="wk">{w}</span>)}</div>
            <div className="grid7">
              {monthGrid(month).map((d) => {
                const info = cal?.days[d];
                const cls = ['d', d.startsWith(month) ? '' : 'o', d === today ? 't' : '', d === selected ? 's' : ''].join(' ');
                return (
                  <button key={d} className={cls} aria-label={dayTitle(d)} onClick={() => { setSelected(d); setOpenKey(null); if (!d.startsWith(month)) setMonth(d.slice(0, 7)); }}>
                    {Number(d.slice(8))}
                    {info && <i className={info.unpaid ? 'u' : ''} />}
                  </button>
                );
              })}
            </div>
            <div className="legend">
              <span><i className="dot" />есть занятие</span>
              <span><i className="dot u" />есть неоплаченные</span>
            </div>
          </div>
          <section>
            <h2>{dayTitle(selected)}</h2>
            {lessons.length === 0 ? (
              <div className="empty"><b>В этот день занятий нет</b></div>
            ) : (
              <div className="card">{lessons.map(card)}</div>
            )}
          </section>
        </>
      )}

      {mode === 'week' && week && week.days.map((d) => (
        <section key={d.date}>
          <h2 className={d.date === today ? 'today' : ''}>{dayTitle(d.date)}</h2>
          {d.lessons.length === 0 ? <p className="sub">занятий нет</p> : <div className="card">{d.lessons.map(card)}</div>}
        </section>
      ))}

      <button className="primary" onClick={() => onAddLesson(selected)}>+ Занятие</button>
    </main>
  );
}
