import { useEffect, type ReactNode } from 'react';
import { tg } from './telegram';

/** Главное действие экрана: MainButton в Telegram, обычная кнопка в браузере. */
export function useMainButton(text: string, onClick: () => void, enabled = true) {
  useEffect(() => {
    const b = tg?.MainButton;
    if (!b) return;
    b.setText(text);
    enabled ? b.enable() : b.disable();
    b.show();
    b.onClick(onClick);
    return () => {
      b.offClick(onClick);
      b.hide();
    };
  }, [text, onClick, enabled]);
}

export function useBack(onBack: () => void) {
  useEffect(() => {
    const b = tg?.BackButton;
    if (!b) return;
    b.show();
    b.onClick(onBack);
    return () => {
      b.offClick(onBack);
      b.hide();
    };
  }, [onBack]);
}

/** Страница-форма: заголовок, «назад», главная кнопка. */
export function FormPage(props: { title: string; onBack: () => void; action: string; onAction: () => void; busy?: boolean; children: ReactNode }) {
  useBack(props.onBack);
  useMainButton(props.action, props.onAction, !props.busy);
  return (
    <main className="screen">
      {!tg && (
        <button className="link" onClick={props.onBack}>
          ← Назад
        </button>
      )}
      <h1>{props.title}</h1>
      {props.children}
      {!tg && (
        <button className="primary" disabled={props.busy} onClick={props.onAction}>
          {props.action}
        </button>
      )}
    </main>
  );
}

export const haptic = (t: 'success' | 'warning' | 'error' = 'success') => tg?.HapticFeedback?.notificationOccurred(t);

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {hint && <div>{hint}</div>}
    </div>
  );
}
