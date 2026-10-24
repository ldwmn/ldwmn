import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

export const DEFAULT_DIRECTIONS = ['Женский стиль', 'Румба', 'Танго', 'Для начинающих', 'Практика'];

const MIGRATIONS: string[] = [
  `
  CREATE TABLE client (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pause','left')),
    role TEXT CHECK (role IN ('lead','follow')),
    return_on TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE direction (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE client_direction (
    client_id INTEGER NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    direction_id INTEGER NOT NULL REFERENCES direction(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('attends','wants')),
    PRIMARY KEY (client_id, direction_id)
  );
  CREATE TABLE lesson_template (
    id INTEGER PRIMARY KEY,
    direction_id INTEGER NOT NULL REFERENCES direction(id),
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    place TEXT,
    default_price INTEGER,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE lesson (
    id INTEGER PRIMARY KEY,
    direction_id INTEGER NOT NULL REFERENCES direction(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    place TEXT,
    template_id INTEGER REFERENCES lesson_template(id),
    note TEXT
  );
  CREATE TABLE payment (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    direction_id INTEGER NOT NULL REFERENCES direction(id),
    lesson_id INTEGER REFERENCES lesson(id) ON DELETE SET NULL,
    week_start TEXT NOT NULL,
    lesson_date TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('paid','unpaid','late_cancel')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX payment_week ON payment(week_start);
  CREATE INDEX payment_status ON payment(status);
  CREATE TABLE reminder_log (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, ref_id)
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
];

export function migrate(db: DB) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
  const insert = db.prepare('INSERT OR IGNORE INTO direction (name, sort) VALUES (?, ?)');
  DEFAULT_DIRECTIONS.forEach((n, i) => insert.run(n, i));
}

export function openDb(file = ':memory:'): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
