import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError } from './api';
import { Dances } from './Dances';
import { Nav, type Tab } from './Nav';
import { PaymentForm, Payments } from './Payments';
import { People, PersonEditor } from './People';
import { Today } from './Today';
import { tg } from './telegram';
import type { Me } from './types';
import './styles.css';

type Overlay = { kind: 'person'; id: number | null } | { kind: 'payment'; week: string } | null;

function Shell({ me }: { me: Me }) {
  const [tab, setTab] = useState<Tab>('today');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [version, setVersion] = useState(0); // меняется после сохранения, чтобы экраны перезагрузили данные
  const close = useCallback(() => { setOverlay(null); setVersion((v) => v + 1); }, []);
  const person = (id: number | null) => setOverlay({ kind: 'person', id });
  const pay = (week?: string) => setOverlay({ kind: 'payment', week: week ?? new Date().toISOString().slice(0, 10) });

  if (overlay?.kind === 'person') return <div className="shell"><PersonEditor id={overlay.id} me={me} onClose={close} /></div>;
  if (overlay?.kind === 'payment') return <div className="shell"><PaymentForm week={overlay.week} onClose={close} /></div>;

  return (
    <div className="shell">
      {tab === 'today' && <Today key={version} onOpenPerson={person} onPay={() => pay()} />}
      {tab === 'calendar' && <main className="screen"><h1>Календарь</h1><div className="empty"><b>Скоро</b><div>Календарь занятий появится на следующем этапе.</div></div></main>}
      {tab === 'people' && <People key={version} onOpen={person} onNew={() => person(null)} />}
      {tab === 'payments' && <Payments me={me} refreshKey={version} onAdd={pay} />}
      {tab === 'dances' && <Dances key={version} onOpenPerson={person} />}
      <Nav tab={tab} onChange={setTab} />
    </div>
  );
}

type State = { kind: 'loading' } | { kind: 'ok'; me: Me } | { kind: 'denied' } | { kind: 'error' };

function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    document.documentElement.dataset.theme = tg?.colorScheme === 'dark' ? 'dark' : 'light';
    tg?.ready();
    tg?.expand();
    api.me()
      .then((me) => setState({ kind: 'ok', me }))
      .catch((e) => setState({ kind: e instanceof ApiError && e.status === 403 ? 'denied' : 'error' }));
  }, []);

  if (state.kind === 'loading') return <p className="msg">Загрузка…</p>;
  if (state.kind === 'denied') return <p className="msg">Нет доступа</p>;
  if (state.kind === 'error') return <p className="msg">Откройте приложение из Telegram</p>;
  return <Shell me={state.me} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
