export type Role = 'owner' | 'assistant';

export interface Config {
  botToken: string;
  webappUrl: string;
  port: number;
  dbFile: string;
  initDataMaxAgeSec: number;
  /** Telegram ID -> роль. Первый ID в списке — owner. */
  allowed: Map<number, Role>;
}

export function parseAllowed(raw: string | undefined): Map<number, Role> {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return new Map(ids.map((id, i) => [id, i === 0 ? 'owner' : 'assistant'] as const));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const botToken = env.BOT_TOKEN;
  if (!botToken) throw new Error('BOT_TOKEN не задан');
  const allowed = parseAllowed(env.ALLOWED_TG_IDS);
  if (allowed.size === 0) throw new Error('ALLOWED_TG_IDS пуст: некому давать доступ');
  return {
    botToken,
    webappUrl: env.WEBAPP_URL ?? '',
    port: Number(env.PORT ?? 3000),
    dbFile: env.DB_FILE ?? 'data/studio.db',
    initDataMaxAgeSec: Number(env.INITDATA_MAX_AGE_SEC ?? 86400),
    allowed,
  };
}
