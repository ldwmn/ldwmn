import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { addDays, dayMonth, PAY_LABEL, rub, weekLabel } from './format';
import { Empty, FormPage, haptic } from './hooks';
import type { ClientFull, Direction, Me, PayStatus, WeekPayments } from './types';

function monday(d: Date) {
  const x = new Date(d.getTime() + 3 * 3600_000); // Москва
  const iso = x.toISOString().slice(0, 10);
  return addDays(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
}

export function Payments({ me, onAdd, refreshKey }: { me: Me; onAdd: (week: string) => void; refreshKey: number }) {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [data, setData] = useState<WeekPayments | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const load = useCallback(() => void api.week(week).then(setData), [week]);
  useEffect(load, [load, refreshKey]);

  const setStatus = async (id: number, status: PayStatus) => {
    await api.setPayment(id, { status });
    haptic(status === 'paid' ? 'success' : 'warning');
    load();
  };
  const s = data?.summary;

  return (
    <main className="screen">
      <h1>Оплаты</h1>
      <div className="weeknav">
        <button className="sq" aria-label="Предыдущая неделя" onClick={() => setWeek(addDays(week, -7))}>‹</button>
        <b>{weekLabel(week)}</b>
        <button className="sq" aria-label="Следующая неделя" onClick={() => setWeek(addDays(week, 7))}>›</button>
      </div>
      {s && (
        <div className="summary">
          <div><b>{s.paid}</b><span>оплатили</span></div>
          <div><b>{s.unpaid}</b><span>ждём</span></div>
          <div><b>{s.late_cancel}</b><span>отмены</span></div>
          <div><b>{rub(s.sum)}</b><span>сумма</span></div>
        </div>
      )}
      {data && data.payments.length === 0 && <Empty title="За эту неделю оплат нет" hint="Нажмите «Записать оплату», даже если расписания ещё нет." />}
      {data && data.payments.length > 0 && (
        <div className="card">
          {data.payments.map((p) => (
            <div key={p.id}>
              <button className="row" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <span className="grow">
                  <b>{p.client_name}</b>
                  <span className="sub">{p.direction_name}{p.lesson_date ? ` · ${dayMonth(p.lesson_date)}` : ''} · {rub(p.amount)}{p.note ? ` · ${p.note}` : ''}</span>
                </span>
                <span className={`badge ${p.status === 'paid' ? 'ok' : p.status === 'unpaid' ? 'bad' : 'warn'}`}>{PAY_LABEL[p.status]}</span>
              </button>
              {openId === p.id && (
                <div className="actions">
                  {p.status !== 'paid' && <button className="chip" onClick={() => setStatus(p.id, 'paid')}>Оплатил</button>}
                  {p.status !== 'unpaid' && <button className="chip" onClick={() => setStatus(p.id, 'unpaid')}>Не оплачено</button>}
                  {p.status !== 'late_cancel' && <button className="chip" onClick={() => setStatus(p.id, 'late_cancel')}>Отмена в последний момент</button>}
                  {me.role === 'owner' && (confirmDel === p.id
                    ? <button className="chip danger" onClick={async () => { await api.deletePayment(p.id); setConfirmDel(null); load(); }}>Точно удалить</button>
                    : <button className="chip" onClick={() => setConfirmDel(p.id)}>Удалить</button>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="primary" onClick={() => onAdd(week)}>+ Записать оплату</button>
    </main>
  );
}

export function PaymentForm({ week, onClose }: { week: string; onClose: () => void }) {
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [people, setPeople] = useState<ClientFull[]>([]);
  const [f, setF] = useState({ name: '', direction: '', week, day: '', amount: '', status: 'paid' as PayStatus, note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.directions().then((d) => { setDirs(d); setF((x) => ({ ...x, direction: x.direction || String(d[0]?.id ?? '') })); });
    void api.clients().then(setPeople);
  }, []);

  const isNew = f.name.trim() !== '' && !people.some((p) => p.name.toLowerCase() === f.name.trim().toLowerCase());
  const save = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await api.addPayment({
        client_name: f.name,
        direction_id: Number(f.direction),
        week_start: f.week,
        lesson_date: f.day || undefined,
        amount: Number(f.amount || 0),
        status: f.status,
        note: f.note,
      });
      haptic();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [f, onClose]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <FormPage title="Новая оплата" onBack={onClose} action="Записать" onAction={save} busy={busy}>
      <label className="lbl">Кто
        <input className="field" list="people" value={f.name} onChange={set('name')} placeholder="Начните вводить имя" />
        <datalist id="people">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
      </label>
      {isNew && <p className="sub">Такого человека нет — он будет добавлен в список.</p>}
      <label className="lbl">Направление
        <select className="field" value={f.direction} onChange={set('direction')}>{dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </label>
      <label className="lbl">Неделя (любой день недели)<input className="field" type="date" value={f.week} onChange={set('week')} /></label>
      <label className="lbl">Конкретный день <span className="sub">необязательно</span><input className="field" type="date" value={f.day} onChange={set('day')} /></label>
      <label className="lbl">Сумма, ₽<input className="field" type="number" inputMode="numeric" min="0" value={f.amount} onChange={set('amount')} /></label>
      <label className="lbl">Статус
        <select className="field" value={f.status} onChange={set('status')}>
          {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="lbl">Заметка<input className="field" value={f.note} onChange={set('note')} /></label>
      {error && <p className="error" role="alert">{error}</p>}
    </FormPage>
  );
}
