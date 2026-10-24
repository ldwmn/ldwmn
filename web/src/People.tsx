import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { monthName, ROLE_LABEL, STATUS_LABEL } from './format';
import { Empty, FormPage } from './hooks';
import type { ClientFull, ClientStatus, Direction, Me } from './types';

export function People({ onOpen, onNew }: { onOpen: (id: number) => void; onNew: () => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | ClientStatus>('');
  const [dir, setDir] = useState('');
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [list, setList] = useState<ClientFull[] | null>(null);

  useEffect(() => void api.directions().then(setDirs), []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (dir) p.set('direction', dir);
    const t = setTimeout(() => void api.clients(p.size ? `?${p}` : '').then(setList), 200);
    return () => clearTimeout(t);
  }, [q, status, dir]);

  return (
    <main className="screen">
      <h1>Люди</h1>
      <input className="field" type="search" placeholder="Поиск по имени, заметке, контакту" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as ClientStatus | '')} aria-label="Статус">
          <option value="">Все активные</option>
          <option value="active">Занимаются</option>
          <option value="pause">Пауза</option>
          <option value="left">Не ходят</option>
        </select>
        <select className="field" value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Направление">
          <option value="">Все направления</option>
          {dirs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {list && list.length === 0 && (q || status || dir ? <Empty title="Никого не нашли" hint="Измените поиск или фильтры." /> : <Empty title="Пока никого нет" hint="Добавьте первого человека." />)}
      {list && list.length > 0 && (
        <div className="card">
          {list.map((c) => (
            <button key={c.id} className="row" onClick={() => onOpen(c.id)}>
              <span className="grow">
                <b>{c.name}</b>
                <span className="sub">
                  {c.role ? ROLE_LABEL[c.role] : 'роль не указана'}
                  {c.status === 'pause' && c.return_on ? ` · вернётся ${monthName(c.return_on)}` : ''}
                  {c.status === 'left' ? ' · не ходит' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button className="primary" onClick={onNew}>+ Добавить человека</button>
    </main>
  );
}

type Tag = 'none' | 'attends' | 'wants';

export function PersonEditor({ id, me, onClose }: { id: number | null; me: Me; onClose: () => void }) {
  const [dirs, setDirs] = useState<Direction[]>([]);
  const [f, setF] = useState({ name: '', contact: '', status: 'active' as ClientStatus, role: '' as '' | 'lead' | 'follow', return_on: '', note: '' });
  const [tags, setTags] = useState<Record<number, Tag>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    void api.directions().then(setDirs);
    if (id) {
      void api.client(id).then((c) => {
        setF({ name: c.name, contact: c.contact ?? '', status: c.status, role: c.role ?? '', return_on: c.return_on ?? '', note: c.note ?? '' });
        setTags({ ...Object.fromEntries(c.wants.map((d) => [d, 'wants'])), ...Object.fromEntries(c.attends.map((d) => [d, 'attends'])) });
      });
    }
  }, [id]);

  const save = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const ids = (k: Tag) => Object.entries(tags).filter(([, v]) => v === k).map(([d]) => Number(d));
      await api.saveClient(id, {
        name: f.name,
        contact: f.contact,
        status: f.status,
        role: f.role || null,
        return_on: f.status === 'pause' && f.return_on ? f.return_on : null,
        note: f.note,
        attends: ids('attends'),
        wants: ids('wants'),
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [f, tags, id, onClose]);

  const cycle = (d: number) => setTags((t) => ({ ...t, [d]: ({ none: 'attends', attends: 'wants', wants: 'none' } as const)[t[d] ?? 'none'] }));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <FormPage title={id ? 'Карточка' : 'Новый человек'} onBack={onClose} action="Сохранить" onAction={save} busy={busy}>
      <label className="lbl">Имя<input className="field" value={f.name} onChange={set('name')} /></label>
      <label className="lbl">Контакт<input className="field" placeholder="Телефон или @telegram" value={f.contact} onChange={set('contact')} /></label>
      <label className="lbl">Статус
        <select className="field" value={f.status} onChange={set('status')}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {f.status === 'pause' && (
        <label className="lbl">Вернётся в месяце
          <input className="field" type="month" value={f.return_on} onChange={set('return_on')} />
        </label>
      )}
      <label className="lbl">Роль в паре
        <select className="field" value={f.role} onChange={set('role')}>
          <option value="">не указана</option>
          <option value="lead">Лидер</option>
          <option value="follow">Партнёрша</option>
        </select>
      </label>
      <div className="lbl">Направления <span className="sub">нажмите: занимается → ждёт → нет</span></div>
      <div className="tags">
        {dirs.map((d) => {
          const t = tags[d.id] ?? 'none';
          return (
            <button key={d.id} className={`tag ${t}`} onClick={() => cycle(d.id)}>
              {d.name}{t === 'attends' ? ' · занимается' : t === 'wants' ? ' · ждёт' : ''}
            </button>
          );
        })}
      </div>
      <label className="lbl">Заметка<textarea className="field" rows={3} value={f.note} onChange={set('note')} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {id && me.role === 'owner' && (
        confirmDel ? (
          <div className="card pad">
            <p>Удалить навсегда вместе с оплатами? Чтобы просто скрыть человека, выберите статус «Не ходит».</p>
            <button className="danger" onClick={async () => { await api.deleteClient(id); onClose(); }}>Да, удалить</button>{' '}
            <button className="link" onClick={() => setConfirmDel(false)}>Отмена</button>
          </div>
        ) : (
          <button className="link danger-text" onClick={() => setConfirmDel(true)}>Удалить навсегда</button>
        )
      )}
    </FormPage>
  );
}
