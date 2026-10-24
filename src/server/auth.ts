import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config, Role } from './config.js';

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * Проверка Telegram WebApp initData: HMAC-SHA256, ключ = HMAC("WebAppData", botToken).
 * Возвращает пользователя или null, если подпись неверна или устарела.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
  now: number = Date.now(),
): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const ageSec = now / 1000 - authDate;
  if (ageSec > maxAgeSec || ageSec < -60) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as TgUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

export interface AuthedUser {
  tgUser: TgUser;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    authed?: AuthedUser;
  }
}

/** preHandler: заголовок `Authorization: tma <initData>`; 401 — подпись, 403 — нет в списке. */
export function requireAuth(config: Config) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization ?? '';
    const initData = header.startsWith('tma ') ? header.slice(4) : '';
    const tgUser = initData
      ? verifyInitData(initData, config.botToken, config.initDataMaxAgeSec)
      : null;
    if (!tgUser) return reply.code(401).send({ error: 'unauthorized' });
    const role = config.allowed.get(tgUser.id);
    if (!role) return reply.code(403).send({ error: 'Нет доступа' });
    req.authed = { tgUser, role };
  };
}
