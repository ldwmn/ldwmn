# Картотека студии

Telegram Mini App + бот для небольшой танцевальной студии: люди, направления, оплаты, расписание и календарь.
Требования — в [SPEC.md](SPEC.md).

## Локальный запуск для проверки в Telegram

Нужны Node 22+ и git.

### 1. Подготовка (один раз)
1. В [@BotFather](https://t.me/BotFather) создайте бота и получите токен (`/newbot`).
2. Узнайте свой Telegram ID, например у бота [@userinfobot](https://t.me/userinfobot).

### 2. Установка
```bash
npm install
cp .env.example .env
```
Заполните в `.env`:
- `BOT_TOKEN` — токен бота;
- `ALLOWED_TG_IDS` — Telegram ID через запятую; первый — владелица, остальные — помощники;
- `WEBAPP_URL` — публичный HTTPS-адрес (заполняется на шаге 4).

```bash
npm run build
npm run seed   # демо-данные; работает только в пустую базу
```

### 3. HTTPS-адрес
Telegram открывает Mini App только по HTTPS, поэтому локальный сервер нужно открыть туннелем:
```bash
cloudflared tunnel --url http://localhost:3000   # или: ngrok http 3000
```
Скопируйте напечатанный адрес вида `https://….trycloudflare.com`.

### 4. Запуск
Впишите адрес в `WEBAPP_URL` и запустите:
```bash
npm start
```
Напишите боту `/start` и нажмите «Открыть картотеку».

Адрес туннеля меняется при каждом его перезапуске: обновите `WEBAPP_URL` и перезапустите `npm start`
(кнопка меню бота обновляется при старте).

Чтобы начать с чистой базы, удалите папку `data/` и заново выполните `npm run seed` (или не выполняйте).

## Разработка
- `npm run dev` — сервер и бот с автоперезапуском; `npm run dev:web` — Mini App через Vite
- `npm test`, `npm run typecheck`, `npm run build`

## Развёртывание на сервере
`docker compose up -d --build` — приложение и Caddy с автоматическим HTTPS. Перед этим укажите свой домен в `Caddyfile`
и заполните `.env`. База лежит в `./data`; резервное копирование запланировано на этап 7.

## Безопасность
Токен бота и `.env` не попадают в репозиторий. Доступ к API и боту только у Telegram ID из `ALLOWED_TG_IDS`.
