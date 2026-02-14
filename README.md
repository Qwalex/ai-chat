# AI Chat

Монорепозиторий: бэкенд (NestJS) и фронтенд (Next.js) для чата с ИИ через OpenRouter.

## Структура

- **ai-chat-backend** — NestJS API (OpenRouter, диалоги, блог, загрузка изображений, **авторизация и баланс в токенах**)
- **ai-chat-frontend** — Next.js SPA (чат, страницы моделей, блог, вход/регистрация). Структура кода — **Feature-Sliced Design** (см. ниже).

### Фронтенд (FSD)

В `ai-chat-frontend` используется [Feature-Sliced Design](https://feature-sliced.design/):

- **src/shared** — переиспользуемое: `lib` (constants, slug), `api/base`, `ui/markdown`
- **src/entities** — сущности: model, user, conversation, blog-post (типы + API)
- **src/features** — сценарии: auth (форма, контекст, API), chat (ChatClient, API сообщений/загрузки)
- **src/widgets** — блоки UI: ModelLinksList, BlogFeed
- **src/views** — композиции страниц: home, model, blog-list, blog-post
- **app/** — роуты Next.js (тонкий слой: конфиг сегмента + импорт view)

Алиасы: `@shared/*`, `@entities/*`, `@features/*`, `@widgets/*`, `@views/*`.

### Авторизация и баланс

- **Без входа** доступны только **бесплатные** модели (в списке помечены «бесплатно»).
- **После регистрации** пользователь получает **100 токенов** на баланс и доступ ко всем (платным) моделям.
- За каждый ответ платной модели списываются токены (1 токен ≈ 0.01 USD стоимости запроса к OpenRouter).
- **Пополнение баланса:** `POST /api/admin/top-up` с телом `{ "adminSecret": "<ADMIN_SECRET>", "userId": "<uuid>", "tokens": 100 }`. В `.env` задать `ADMIN_SECRET`. Интеграция оплаты — отдельная задача.

## Запуск

### Docker (рекомендуется)

**Продакшен:**

```bash
# Создайте ai-chat-backend/.env с OPENROUTER_API_KEY и др. (см. ai-chat-backend/.env.example)
# Переменные для compose (PUBLIC_URL, CORS_ORIGIN, NEXT_PUBLIC_API_URL) — в .env.production
docker compose --env-file .env.production up -d --build
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
- `JWT_SECRET` — секрет для JWT (обязательно в проде)
- `DB_PATH` — путь к файлу SQLite (по умолчанию `data.sqlite`)
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
