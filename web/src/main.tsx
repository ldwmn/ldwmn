import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, ApiError, type Me } from './api';
import { Nav, TABS, type Tab } from './Nav';
import { tg } from './telegram';
import './styles.css';

type State = { kind: 'loading' } | { kind: 'ok'; me: Me } | { kind: 'denied' } | { kind: 'error' };

function Shell({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>('today');
  const title = TABS.find((t) => t.id === tab)!.label;
  return (
    <div className="shell">
      <main className="screen">
        <h1>{title}</h1>
        <p className="empty">Здравствуйте, {name || 'гость'}! Этот раздел появится на следующих этапах.</p>
      </main>
      <Nav tab={tab} onChange={setTab} />
    </div>
  );
}

function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    document.documentElement.dataset.theme = tg?.colorScheme === 'dark' ? 'dark' : 'light';
    tg?.ready();
    tg?.expand();
    api<Me>('/me')
      .then((me) => setState({ kind: 'ok', me }))
      .catch((e) => setState({ kind: e instanceof ApiError && e.status === 403 ? 'denied' : 'error' }));
  }, []);

  if (state.kind === 'loading') return <p className="msg">Загрузка…</p>;
  if (state.kind === 'denied') return <p className="msg">Нет доступа</p>;
  if (state.kind === 'error') return <p className="msg">Откройте приложение из Telegram</p>;
  return <Shell name={state.me.name} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
