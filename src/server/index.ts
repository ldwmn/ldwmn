import { buildApp } from './app.js';
import { buildBot, setupMenuButton } from './bot.js';
import { loadConfig } from './config.js';
import { openDb } from './db.js';

const config = loadConfig();
const app = await buildApp(config, openDb(config.dbFile));
const bot = buildBot(config);

await app.listen({ port: config.port, host: '0.0.0.0' });
await setupMenuButton(bot, config.webappUrl);
bot.start({ onStart: (me) => app.log.info(`bot @${me.username} started`) });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await bot.stop();
    await app.close();
    process.exit(0);
  });
}
