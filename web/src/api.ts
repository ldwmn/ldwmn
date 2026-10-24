import { tg } from './telegram';
import type { ClientFull, Direction, DirectionOverview, Me, PaymentRow, Today, WeekPayments } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { Authorization: `tma ${tg?.initData ?? ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? String(res.status);
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  me: () => call<Me>('GET', '/me'),
  today: () => call<Today>('GET', '/today'),
  clients: (qs = '') => call<ClientFull[]>('GET', `/clients${qs}`),
  client: (id: number) => call<ClientFull>('GET', `/clients/${id}`),
  saveClient: (id: number | null, body: unknown) =>
    id ? call<ClientFull>('PATCH', `/clients/${id}`, body) : call<ClientFull>('POST', '/clients', body),
  deleteClient: (id: number) => call<void>('DELETE', `/clients/${id}`),
  directions: () => call<Direction[]>('GET', '/directions'),
  overview: () => call<DirectionOverview[]>('GET', '/directions/overview'),
  addDirection: (name: string) => call<Direction>('POST', '/directions', { name }),
  week: (week: string) => call<WeekPayments>('GET', `/payments?week=${week}`),
  addPayment: (body: unknown) => call<PaymentRow>('POST', '/payments', body),
  setPayment: (id: number, body: unknown) => call<PaymentRow>('PATCH', `/payments/${id}`, body),
  deletePayment: (id: number) => call<void>('DELETE', `/payments/${id}`),
};
