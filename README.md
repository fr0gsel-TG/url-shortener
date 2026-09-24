# URL Shortener

MVP сервиса сокращения ссылок с базовой аналитикой переходов и кешированием
горячих ссылок в Redis.

Позволяет:

- сократить длинный URL до короткого кода из 6 символов;
- перейти по короткой ссылке и попасть на оригинальный URL;
- посмотреть статистику по короткой ссылке (оригинальный URL, число переходов, дата создания).

## Технологии

**Backend:** Node.js, Express, TypeScript (strict), PostgreSQL (`pg`), Redis (`redis` v4),
Zod (валидация), Winston + Morgan (логирование), Jest + Supertest (тесты).

**Frontend:** React + TypeScript, Vite, чистый CSS (без UI-фреймворков).

**Инфраструктура:** Docker, Docker Compose.

## Архитектура

```
project-root/
├── backend/
│   ├── src/
│   │   ├── controllers/   # HTTP request/response, без бизнес-логики
│   │   ├── services/      # бизнес-логика: shortCode, кеш, редирект, статистика
│   │   ├── repositories/  # SQL-запросы к PostgreSQL
│   │   ├── routes/        # маршруты Express
│   │   ├── middleware/    # валидация, логирование, обработка ошибок
│   │   ├── cache/         # инкапсуляция Redis
│   │   ├── database/      # пул подключений + миграция схемы
│   │   ├── config/        # валидация переменных окружения (Zod)
│   │   ├── types/         # DTO и доменные типы
│   │   ├── utils/         # логгер, кастомные ошибки, валидационные схемы
│   │   ├── app.ts         # сборка Express-приложения
│   │   └── server.ts      # точка входа: ожидание БД/Redis, graceful shutdown
│   └── tests/              # Jest + Supertest
├── frontend/
│   └── src/
│       ├── api/            # клиент для backend API
│       ├── components/     # ShortenForm (Блок 1), StatsLookup (Блок 2)
│       └── App.tsx
├── docker-compose.yml
├── .env.example
└── README.md
```

Поток запроса: `Route → Controller → Service → Repository / Cache → PostgreSQL / Redis`.

## Как работает Redis-кеширование

Кешируется **только** пара `shortCode → originalUrl`, TTL = 1 час
(`CACHE_TTL_SECONDS`, по умолчанию 3600).

**Первый переход по shortCode:**

```
Request → Redis MISS → PostgreSQL SELECT original_url
         → Redis SET (TTL 1h) → PostgreSQL clicks + 1 → redirect
```

**Повторный переход:**

```
Request → Redis HIT → originalUrl берётся из Redis (SELECT original_url НЕ выполняется)
         → PostgreSQL clicks + 1 → redirect
```

Счётчик `clicks` в кеше не хранится и увеличивается в PostgreSQL при **каждом**
переходе — и при MISS, и при HIT, — поэтому статистика (`GET /api/stats/:shortCode`,
читает напрямую из PostgreSQL, без кеша) всегда отражает актуальное значение.

В логах явно видно `CACHE HIT: <code>` / `CACHE MISS: <code>` — это можно
проверить командой `docker compose logs -f backend` или при локальном запуске.

## Генерация shortCode и защита от коллизий

1. Генерируется случайный код длиной 6 символов (`A-Za-z0-9`) через
   `crypto.randomBytes`.
2. Проверяется существование кода в БД (`SELECT EXISTS ...`).
3. Если код занят — генерация повторяется (до 5 попыток), с логированием коллизии.
4. Если между проверкой и вставкой произошла гонка запросов, `UNIQUE` constraint
   на `short_code` защищает от дубликата на уровне БД: ошибка `23505` (unique_violation)
   ловится и также приводит к повторной генерации.
5. Если после 5 попыток уникальный код получить не удалось — возвращается `500`.

## Обработка ошибок

Единый формат ответа об ошибке: `{ "message": "..." }`.

| Ситуация                                   | Код |
| ------------------------------------------- | --- |
| Невалидный `originalUrl`                    | 400 |
| `originalUrl` указывает на этот же сервис   | 400 |
| shortCode не найден (редирект/статистика)   | 404 |
| Не удалось сгенерировать уникальный shortCode | 500 |
| Непредвиденная ошибка (БД, Redis и т.д.)    | 500 |

Stack trace клиенту никогда не отдаётся; полная информация об ошибке логируется
на сервере через Winston.

## Защита от циклических редиректов

Если пользователь пытается сократить URL, указывающий на сам сервис
(совпадает host с `BASE_URL`), запрос отклоняется с `400`, чтобы не создавать
потенциальный цикл `short → short → short → ...`.

## Установка и запуск

### Вариант А — Docker Compose (рекомендуется)

Требуется Docker и Docker Compose.

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd url-shortener
cp .env.example .env
docker compose up --build
```

После старта:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Backend дожидается готовности PostgreSQL и Redis перед стартом (retry-цикл),
а `docker-compose.yml` дополнительно использует healthcheck и `depends_on` с
условием `service_healthy`, поэтому ручных дополнительных действий не требуется.

### Вариант Б — локальный запуск без Docker

Понадобятся локально установленные и запущенные PostgreSQL и Redis.

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd url-shortener
```

**Backend:**

```bash
cd backend
npm install
cp .env.example .env   # затем поправьте DATABASE_URL/REDIS_URL под вашу БД
npm run dev
```

Backend поднимется на `http://localhost:3000` и сам применит SQL-миграцию
(`src/database/init.sql`) при старте.

**Frontend** (в отдельном терминале):

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend поднимется на `http://localhost:5173`.

**PostgreSQL/Redis локально**, например через Docker без остальных сервисов:

```bash
docker run -d --name pg -e POSTGRES_USER=shortener -e POSTGRES_PASSWORD=shortener \
  -e POSTGRES_DB=url_shortener -p 5432:5432 postgres:16-alpine

docker run -d --name redis -p 6379:6379 redis:7-alpine
```

## Переменные окружения

Полный список — в [`.env.example`](.env.example) в корне репозитория
(есть также `backend/.env.example` и `frontend/.env.example` с релевантным
подмножеством).

| Переменная           | Где используется | Описание                                             | По умолчанию                     |
| --------------------- | ----------------- | ----------------------------------------------------- | --------------------------------- |
| `PORT`                | backend           | Порт HTTP-сервера                                     | `3000`                            |
| `DATABASE_URL`        | backend           | Строка подключения к PostgreSQL                       | —                                  |
| `REDIS_URL`           | backend           | Строка подключения к Redis                             | —                                  |
| `BASE_URL`             | backend           | Публичный URL сервиса (используется в `shortUrl` и защите от циклов) | `http://localhost:3000`          |
| `CORS_ORIGIN`          | backend           | Разрешённый origin для CORS (адрес frontend)           | `http://localhost:5173`          |
| `CACHE_TTL_SECONDS`    | backend           | TTL кеша Redis в секундах                              | `3600`                            |
| `NODE_ENV`             | backend           | `development` \| `production` \| `test`               | `development`                     |
| `POSTGRES_USER`        | docker-compose    | Пользователь PostgreSQL (для контейнера)               | `shortener`                       |
| `POSTGRES_PASSWORD`    | docker-compose    | Пароль PostgreSQL (для контейнера)                     | `shortener`                       |
| `POSTGRES_DB`          | docker-compose    | Имя БД PostgreSQL (для контейнера)                     | `url_shortener`                   |
| `VITE_API_URL`         | frontend          | Базовый URL backend API                                | `http://localhost:3000`          |

## API

### `POST /api/shorten`

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://example.com/some/very/long/url"}'
```

Ответ `201`:

```json
{
  "shortCode": "a7Kx21",
  "shortUrl": "http://localhost:3000/a7Kx21"
}
```

Ответ `400` (невалидный URL):

```json
{ "message": "originalUrl должен быть корректным http или https URL" }
```

### `GET /:shortCode`

```bash
curl -i http://localhost:3000/a7Kx21
```

Редирект `302` на оригинальный URL, либо `404`, если код не найден.

### `GET /api/stats/:shortCode`

```bash
curl http://localhost:3000/api/stats/a7Kx21
```

Ответ `200`:

```json
{
  "originalUrl": "https://example.com/some/very/long/url",
  "shortCode": "a7Kx21",
  "clicks": 15,
  "createdAt": "2026-09-23T10:00:00.000Z"
}
```

Ответ `404`, если код не найден.

### `GET /health`

Служебный эндпоинт для healthcheck (Docker), возвращает `{"status":"ok"}`.

## Тесты

```bash
cd backend
npm install
npm test
```

Тесты используют Jest + Supertest и мокируют слои repository/cache
(`jest.mock`), поэтому **не требуют** поднятых PostgreSQL/Redis — это
сознательное упрощение тестового окружения, при этом вся бизнес-логика
(генерация shortCode, коллизии, cache-aside стратегия, инкремент clicks,
коды ответов) покрыта тестами по-настоящему, без моков самой логики.

Покрытие включает:

- `POST /api/shorten`: валидный URL → 201, невалидный → 400, длина/алфавит `shortCode`;
- `GET /:shortCode`: редирект существующего кода, 404 для несуществующего, инкремент `clicks`;
- Redis: cache MISS → обращение к PostgreSQL → `SET` с TTL; cache HIT → **без** обращения к PostgreSQL за `original_url`;
- `GET /api/stats/:shortCode`: корректная статистика / 404;
- обработка коллизий `shortCode`, включая гонку запросов (`unique_violation`);
- защита от циклических редиректов на самого себя.
