# AI Chat

Монорепозиторий: бэкенд (NestJS) и фронтенд (Next.js) для чата с ИИ через OpenRouter.

## Структура

- **ai-chat-backend** — NestJS API (OpenRouter, диалоги, блог, загрузка изображений)
- **ai-chat-frontend** — Next.js SPA (чат, страницы моделей, блог)

## Запуск

### Docker (рекомендуется)

**Продакшен:**

```bash
# Создайте ai-chat-backend/.env с OPENROUTER_API_KEY и др. (см. ai-chat-backend/.env.example)
# Опционально: .env в корне с NEXT_PUBLIC_API_URL, PUBLIC_URL, CORS_ORIGIN
docker compose up -d --build
```

- Фронтенд: http://localhost:3000  
- Бэкенд API: http://localhost:3001  

**Разработка (hot reload):**

```bash
docker compose -f docker-compose.dev.yml up
```

Код монтируется в контейнеры, бэкенд и фронт перезапускаются при изменениях.

### Локально без Docker

**Бэкенд:**

```bash
cd ai-chat-backend
cp .env.example .env
# Заполните OPENROUTER_API_KEY в .env
npm install
npm run start:dev
```

По умолчанию: http://localhost:3001

**Фронтенд:**

```bash
cd ai-chat-frontend
cp .env.example .env.local
# При необходимости задайте NEXT_PUBLIC_API_URL (по умолчанию http://localhost:3001)
npm install
npm run dev
```

По умолчанию: http://localhost:3000

Сначала запустите бэкенд, затем фронтенд.

## Переменные окружения

### Бэкенд (ai-chat-backend/.env)

- `OPENROUTER_API_KEY` — ключ OpenRouter (обязательно)
- `PORT` — порт (по умолчанию 3001)
- `PUBLIC_URL` — базовый URL приложения (для ссылок на загрузки)
- `CORS_ORIGIN` — разрешённый origin фронтенда (по умолчанию http://localhost:3000)
- Остальные — см. `ai-chat-backend/.env.example`

### Фронтенд (для Docker prod)

- `NEXT_PUBLIC_API_URL` — URL бэкенда, с которого браузер ходит в API (при сборке образа). Например `http://localhost:3001` или `https://api.example.com`.

---

## Продакшен (qwaiz.ru / api.qwaiz.ru)

Фронт: **https://qwaiz.ru**, API: **https://api.qwaiz.ru**.

Перед сборкой создайте в корне репозитория файл **.env** (можно от копии `.env.example`):

```env
NEXT_PUBLIC_API_URL=https://api.qwaiz.ru
PUBLIC_URL=https://api.qwaiz.ru
CORS_ORIGIN=https://qwaiz.ru
```

- **NEXT_PUBLIC_API_URL** — подставляется в фронт при `docker compose build`; запросы из браузера идут на этот адрес.
- **PUBLIC_URL** — бэкенд отдаёт по нему ссылки на загруженные картинки.
- **CORS_ORIGIN** — бэкенд принимает запросы только с этого origin (ваш фронт).

Прокси (nginx/traefik) должен направлять:
- `https://qwaiz.ru` → контейнер `frontend:3000`
- `https://api.qwaiz.ru` → контейнер `backend:3001`
