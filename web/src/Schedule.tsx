import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { WEEKDAYS, rub } from './format';
import { FormPage } from './hooks';
import type { Direction, Me, Template } from './types';

export function LessonForm({ date, onClose }: { date: string; onClose: () => void }) {
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [f, setF] = useState({ kind: 'weekly', direction: '', weekday: String((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7), date, time: '19:00', duration: '60', place: '', price: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => void api.directions().then((d) => { setDirs(d); setF((x) => ({ ...x, direction: x.direction || String(d[0]?.id ?? '') })); }), []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const base = { direction_id: Number(f.direction), start_time: f.time, duration_min: Number(f.duration), place: f.place };
      if (f.kind === 'weekly') await api.addTemplate({ ...base, weekday: Number(f.weekday), default_price: f.price || null });
      else await api.addLesson({ ...base, date: f.date });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [f, onClose]);

  return (
    <FormPage title="Новое занятие" onBack={onClose} action="Добавить" onAction={save} busy={busy}>
      <label className="lbl">Как часто
        <select className="field" value={f.kind} onChange={set('kind')}>
          <option value="weekly">Каждую неделю</option>
          <option value="once">Один раз (практика, мастер-класс)</option>
        </select>
      </label>
      <label className="lbl">Направление
        <select className="field" value={f.direction} onChange={set('direction')}>{dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      </label>
      {f.kind === 'weekly' ? (
        <label className="lbl">День недели
          <select className="field" value={f.weekday} onChange={set('weekday')}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select>
        </label>
      ) : (
        <label className="lbl">Дата<input className="field" type="date" value={f.date} onChange={set('date')} /></label>
      )}
      <label className="lbl">Время начала<input className="field" type="time" value={f.time} onChange={set('time')} /></label>
      <label className="lbl">Длительность, мин<input className="field" type="number" inputMode="numeric" value={f.duration} onChange={set('duration')} /></label>
      <label className="lbl">Место <span className="sub">необязательно</span><input className="field" value={f.place} onChange={set('place')} /></label>
      {f.kind === 'weekly' && (
        <label className="lbl">Цена по умолчанию, ₽ <span className="sub">необязательно</span><input className="field" type="number" inputMode="numeric" value={f.price} onChange={set('price')} /></label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </FormPage>
  );
}

export function ScheduleList({ me, onAdd, refreshKey }: { me: Me; onAdd: () => void; refreshKey: number }) {
  const [list, setList] = useState<Template[] | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const load = useCallback(() => void api.templates().then(setList), []);
  useEffect(load, [load, refreshKey]);

  return (
    <section>
      <h2>Расписание</h2>
      {list && list.length === 0 && <div className="empty"><b>Расписание пустое</b><div>Добавьте первое занятие — оно появится в календаре.</div></div>}
      {list && list.length > 0 && (
        <div className="card">
          {list.map((t) => (
            <div key={t.id} className={t.active ? '' : 'off'}>
              <div className="row">
                <span className="grow">
                  <b>{t.direction_name}</b>
                  <span className="sub">{WEEKDAYS[t.weekday]}, {t.start_time} · {t.duration_min} мин{t.place ? ` · ${t.place}` : ''}{t.default_price != null ? ` · ${rub(t.default_price)}` : ''}</span>
                </span>
                <button className="chip" onClick={async () => { await api.setTemplateActive(t.id, !t.active); load(); }}>{t.active ? 'Выключить' : 'Включить'}</button>
              </div>
              {me.role === 'owner' && !t.active && (
                <div className="actions">
                  {confirmId === t.id
                    ? <button className="chip danger" onClick={async () => { await api.deleteTemplate(t.id); setConfirmId(null); load(); }}>Точно удалить</button>
                    : <button className="chip" onClick={() => setConfirmId(t.id)}>Удалить навсегда</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button className="link" onClick={onAdd}>+ Добавить занятие</button>
    </section>
  );
}
