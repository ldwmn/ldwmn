import type { ReactNode } from 'react';

export type Tab = 'today' | 'calendar' | 'people' | 'payments' | 'dances';

const icon = (d: ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Сегодня', icon: icon(<path d="M4 12l8-8 8 8M6 10v10h12V10" />) },
  { id: 'calendar', label: 'Календарь', icon: icon(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  { id: 'people', label: 'Люди', icon: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3.5 3.5 0 010 5M18 14.5c1.8.8 3 2.6 3 5.5" /></>) },
  { id: 'payments', label: 'Оплаты', icon: icon(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>) },
  { id: 'dances', label: 'Танцы', icon: icon(<><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>) },
];

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <button key={t.id} aria-current={t.id === tab ? 'page' : undefined} onClick={() => onChange(t.id)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>
  );
}
