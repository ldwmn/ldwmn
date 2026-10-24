# Картотека студии

Требования см. в SPEC.md.

## Команды
- `npm run dev` — сервер + бот (tsx watch); `npm run dev:web` — Mini App (Vite)
- `npm run seed` — загрузить демо-данные (только в пустую базу)
- `npm test` — Vitest; `npm run typecheck`; `npm run build` — сборка сервера и Mini App

## Структура
- `src/server` — Fastify API, проверка `initData`, бот (grammY)
- `web` — Mini App (Vite + React)

## Статус
Этапы 1–3 из SPEC.md готовы (каркас; люди, направления, оплаты, «Сегодня»; занятия, календарь месяц/неделя, баланс практики). Оплаты привязываются к занятиям динамически (направление + неделя [+ день]), см. `src/server/lessons.ts`. Макет календаря — в `docs/design/`.
