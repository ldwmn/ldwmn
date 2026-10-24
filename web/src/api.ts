import { tg } from './telegram';

export interface Me {
  id: number;
  name: string;
  role: 'owner' | 'assistant';
}

export class ApiError extends Error {
  constructor(public status: number) {
    super(String(status));
  }
}

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `tma ${tg?.initData ?? ''}` },
  });
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}
