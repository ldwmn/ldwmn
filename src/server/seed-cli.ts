import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { seedDemo } from './seed.js';

const { dbFile } = loadConfig({ BOT_TOKEN: 'x', ALLOWED_TG_IDS: '1', ...process.env });
console.log(seedDemo(openDb(dbFile)) ? 'Демо-данные загружены' : 'В базе уже есть люди, ничего не изменено');
