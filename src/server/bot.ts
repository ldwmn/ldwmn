import { Bot, InlineKeyboard } from 'grammy';
import type { Config } from './config.js';

export function buildBot(config: Config) {
  const bot = new Bot(config.botToken);

  // Бот отвечает только разрешённым аккаунтам.
  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (id && config.allowed.has(id)) return next();
    if (ctx.chat?.type === 'private') await ctx.reply('Нет доступа');
  });

  bot.command('start', async (ctx) => {
    if (!config.webappUrl) return ctx.reply('WEBAPP_URL не задан.');
    await ctx.reply('Картотека студии', {
      reply_markup: new InlineKeyboard().webApp('Открыть картотеку', config.webappUrl),
    });
  });

  return bot;
}

export async function setupMenuButton(bot: Bot, webappUrl: string) {
  if (!webappUrl) return;
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: 'Картотека', web_app: { url: webappUrl } },
  });
}
