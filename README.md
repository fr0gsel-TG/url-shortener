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

## Архитектурные решения и компромиссы

Несколько мест, где решение неочевидно и принято осознанно, а не по умолчанию:

**Почему `clicks` пишется в PostgreSQL при каждом переходе, даже при cache HIT.**
Redis экономит только чтение `original_url`, но не запись счётчика — это
может показаться половинчатым кешированием. Это прямое следствие ТЗ:
диаграмма "Повторный переход" явно требует `PostgreSQL → clicks + 1` даже
после `Redis HIT`. Альтернатива — буферизовать `clicks` в Redis (`INCR` +
периодический flush в БД) — рассматривалась и сознательно не реализована:
она разошлась бы с явной диаграммой из ТЗ и добавила бы риск потери части
счётчика при падении процесса между `INCR` и flush, что для MVP тестового
задания того не стоит.

**Почему `GET /api/stats/:shortCode` не использует кеш.**
Чтобы `clicks` в статистике всегда был актуальным. Если бы статистика
читалась из Redis, значение `clicks` могло бы быть протухшим все то время,
пока жив TTL, — а он специально выставлен достаточно большим (1 час).

**Почему `GET /:shortCode` и `GET /api/stats/:shortCode` возвращают 404, а не
400, для структурно некорректного shortCode** (например, `/favicon.ico`,
`/robots.txt`, которые браузер запрашивает сам).
Формат проверяется (`middleware/shortCodeFormat.ts`) до похода в Redis/PostgreSQL
— это чистая оптимизация, а не валидация пользовательского ввода в духе
`POST /api/shorten`. Код ответа остаётся 404, потому что с точки зрения
клиента "такой код структурно невозможен" неотличимо от "такого кода нет в
базе" — в обоих случаях смысл ответа один: "ссылки не существует", и ТЗ
явно ожидает именно 404 для любого несуществующего shortCode.

**Что произойдёт, если запись удалили из PostgreSQL напрямую, а Redis ещё
хранит закешированное значение.** `incrementClicks` возвращает, была ли
реально найдена и обновлена строка (`UPDATE ... RETURNING`-семантика через
`rowCount`). Если строки уже нет — протухший ключ удаляется из Redis, и
клиенту возвращается 404 вместо редиректа на данные, которых по факту
больше нет.

**Почему `config/env.ts` не завершает процесс сам.** Раньше при невалидном
`.env` модуль конфигурации сразу вызывал `process.exit(1)` — работало, но
делало модуль невозможным для unit-тестирования (импорт с "плохим" env
убивал тестовый воркер) и пряталo решение "что делать при ошибке" внутри
случайного модуля. Теперь `loadEnv()` — обычная функция, которая бросает
`Error`; `env` по-прежнему вычисляется один раз при первом импорте модуля
(перетаскивать его через dependency injection во все потребители было бы
избыточным рефакторингом для проекта такого размера), но сама валидация
теперь проверяема в изоляции (`tests/env.test.ts`).

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

Два уровня тестов — намеренно разделены, у каждого своя цель.

### Unit/API-тесты (мокают repository/cache, Docker не нужен)

```bash
cd backend
npm install
npm test
```

Мокают слои repository/cache (`jest.mock`), поэтому **не требуют** поднятых
PostgreSQL/Redis — быстрые, подходят для CI без Docker. Важная оговорка:
такие тесты доказывают, что вызван нужный метод с нужными аргументами, но
**не** доказывают, что реальный SQL/TTL в Redis действительно работают —
для этого ниже есть отдельный интеграционный набор.

Покрытие включает:

- `POST /api/shorten`: валидный URL → 201, невалидный → 400, длина/алфавит `shortCode`;
- `GET /:shortCode`: редирект существующего кода, 404 для несуществующего, инкремент `clicks`, 404 сразу (без похода в Redis/PostgreSQL) для структурно некорректного shortCode;
- Redis: cache MISS → обращение к PostgreSQL → `SET` с TTL; cache HIT → **без** обращения к PostgreSQL за `original_url`; протухший кеш (запись удалена из БД) → инвалидация ключа + 404;
- `GET /api/stats/:shortCode`: корректная статистика / 404 / 404 для структурно некорректного кода;
- обработка коллизий `shortCode`, включая гонку запросов (`unique_violation`);
- защита от циклических редиректов на самого себя;
- `loadEnv()`: бросает описательную ошибку при невалидном `.env`, не убивая процесс (см. ниже).

### Интеграционный тест (реальные PostgreSQL + Redis через Testcontainers)

```bash
cd backend
npm install
npm run test:integration   # требует запущенный Docker
```

Testcontainers поднимает настоящие одноразовые контейнеры `postgres:16-alpine`
и `redis:7-alpine` (те же образы, что уже используются в `docker-compose.yml`,
так что если вы уже запускали `docker compose up`, образы, скорее всего, уже
локально закешированы и тест стартует быстро). Тест реально:

- применяет миграцию (`init.sql`) к чистой БД;
- создаёт короткую ссылку через настоящий сервисный слой;
- проверяет TTL ключа в Redis напрямую командой `TTL` (а не через мок);
- дважды резолвит ссылку (гарантированный MISS, затем настоящий HIT) и
  проверяет, что `clicks` в реальной PostgreSQL стало равно 2.

Не включён в обычный `npm test`, чтобы не требовать Docker там, где его может
не быть (например, в части CI-раннеров).
