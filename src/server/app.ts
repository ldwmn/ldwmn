import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { requireAuth } from './auth.js';
import { registerApi } from './api.js';
import { registerLessons } from './lessons.js';
import type { Config } from './config.js';
import type { DB } from './db.js';

export const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

export async function buildApp(config: Config, db: DB) {
  const app = Fastify({ logger: { redact: ['req.headers.authorization'] } });
  const auth = requireAuth(config);

  app.get('/health', async () => ({ ok: true }));

  // Все эндпоинты /api/* проверяют подпись initData и список разрешённых ID.
  app.register(async (api) => {
    api.addHook('preHandler', auth);
    api.get('/me', async (req) => {
      const { tgUser, role } = req.authed!;
      return {
        id: tgUser.id,
        name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
        role,
      };
    });
    registerApi(api, db);
    registerLessons(api, db);
  }, { prefix: '/api' });

  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
  }
  return app;
}
