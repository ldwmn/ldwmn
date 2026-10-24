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
Этапы 1–2 из SPEC.md готовы (каркас; люди, направления, оплаты, «Сегодня»). Вкладка «Календарь» — заглушка до этапа 3; референс макета в `docs/design/`.
