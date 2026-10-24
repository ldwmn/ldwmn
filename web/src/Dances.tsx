import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { ScheduleList } from './Schedule';
import type { DirectionOverview, Me } from './types';

export function Dances({ me, onOpenPerson, onAddLesson, refreshKey }: { me: Me; onOpenPerson: (id: number) => void; onAddLesson: () => void; refreshKey: number }) {
  const [list, setList] = useState<DirectionOverview[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => void api.overview().then(setList), []);
  useEffect(load, [load]);

  const add = async () => {
    setError('');
    try {
      await api.addDirection(name);
      setName('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const names = (arr: { id: number; name: string }[]) =>
    arr.length ? arr.map((p, i) => (
      <span key={p.id}><button className="inline" onClick={() => onOpenPerson(p.id)}>{p.name}</button>{i < arr.length - 1 ? ', ' : ''}</span>
    )) : <span className="muted">никого</span>;

  return (
    <main className="screen">
      <h1>Танцы</h1>
      <ScheduleList me={me} onAdd={onAddLesson} refreshKey={refreshKey} />
      <h2>Направления</h2>
      {list?.map((d) => (
        <section key={d.id} className="card pad">
          <h2 className="plain">{d.name}</h2>
          <p><b>Занимаются: {d.attends.length}</b><br />{names(d.attends)}</p>
          <p><b>Ждут: {d.wants.length}</b><br />{names(d.wants)}</p>
        </section>
      ))}
      <div className="inline-form">
        <input className="field" placeholder="Новое направление" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!name.trim()} onClick={add}>Добавить</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
