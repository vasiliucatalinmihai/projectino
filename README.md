# productino

AI-assisted discovery-to-delivery tool for a software outsourcing shop: upload a
client briefing → get a gap analysis, clarifying questions, a product definition,
then tasks and a roadmap.

Monorepo with two apps under `code/`, orchestrated by Docker Compose and the `pd`
helper script (modeled on mind-guard's `mg`).

```
productino/
├── pd                       # docker manager (build/start/stop/logs/enter/exec…)
├── pd_docker_handler.sh      # command implementations sourced by `pd`
├── docker-compose.yml
├── docker/
│   ├── nginx/conf/           # reverse-proxy server blocks (frontend + backend)
│   └── postgres/init/        # runs once to create the `productino` database
├── data/                     # postgres data volume (gitignored)
└── code/
    ├── productino-backend/    # NestJS + Prisma (repository pattern + active-record entities)
    └── productino-frontend/   # Nuxt 3 + Vue 3
```

## Services, domains & ports

An nginx reverse proxy fronts both apps on port 80 by hostname. Add these to your
hosts file (`/etc/hosts`) once:

```
127.0.0.1 dev.production.io dev-api.production.io
```

| Service  | Container          | Via nginx (port 80)         | Direct host port |
|----------|--------------------|-----------------------------|------------------|
| nginx    | productino-nginx   | —                           | 80               |
| frontend | productino-frontend| http://dev.production.io    | 3000             |
| backend  | productino-backend | http://dev-api.production.io| 3001 (debug 9230→9229) |
| postgres | productino-postgres| —                           | 5433             |

Direct ports stay mapped for debugging; the primary entry points are the domains.

- Frontend: **http://dev.production.io**
- Backend API: **http://dev-api.production.io/api**  ·  Swagger: **http://dev-api.production.io/api/docs**
- Postgres: `postgresql://productino:secret@localhost:5433/productino`

The frontend reaches the backend two ways: the **browser** uses `http://dev-api.production.io`
(through nginx), while **SSR** inside the container uses `http://backend:8080` over the docker
network. Both are configured via `NUXT_PUBLIC_API_BASE` / `NUXT_API_BASE_INTERNAL`.

## Quick start

```bash
./pd start          # build images if needed, install deps in-container, start everything
./pd logs all       # tail all logs   (or: ./pd logs backend | nginx | frontend)
./pd status
./pd stop
```

First boot installs node modules inside the containers and the backend runs
`prisma db push` + `yarn seed`, so the initial start takes a few minutes.

## Common tasks

```bash
./pd enter backend                 # shell into the backend container
./pd exec backend yarn prisma:studio
./pd exec backend yarn lint
./pd restart backend
./pd clean-volumes backend         # drop its node_modules volume to reinstall
```

## Backend conventions

A single Nest module (`app.module.ts`) wires everything — no per-feature modules.
Code is grouped by kind in flat folders:

```
src/
├── app.module.ts        # the one module: registers all controllers + providers + middleware
├── main.ts
├── prisma.service.ts    # thin PrismaClient wrapper (a provider in app.module)
├── entities/            # active-record entities (base.entity.ts + per-model)
├── repository/          # generic base repo + concrete repositories
├── services/            # business logic
└── http/                # everything HTTP-facing
    ├── controller/      # controllers
    ├── request/<model>/ # request DTOs  (*.request.ts) — input validation
    ├── response/<model>/# response DTOs (*.response.ts) — output shape, with fromEntity()
    ├── guards/          # auth/authorization guards
    ├── middleware/      # NestMiddleware (wired in app.module configure())
    └── validators/      # custom class-validator constraints
```

- **Generic repository** (`src/repository/prisma.repository.ts`) — `PrismaRepository<T, CreateInput, UpdateInput>`
  with `findMany`/`create`/`update`/`upsert`/`save`/… Concrete repos declare a `model`
  key and an entity class; rows are wrapped into entity instances.
- **Active-record entities** (`src/entities/`) — extend `BaseEntity` (constructor does
  `Object.assign(this, partial)`); domain methods live on the entity and
  `repository.save(entity)` persists the instance.
- **Controllers** take `*.request.ts` DTOs in, hand entities to the service, and map the
  result to `*.response.ts` DTOs via `Response.fromEntity(...)`.
- `Project` is the worked example across all the folders above.

To add a model: edit `prisma/schema.prisma`; add an entity (`entities/`), a repository
(`repository/`), a service (`services/`), request + response DTOs (`http/request/<model>/`,
`http/response/<model>/`) and a controller (`http/controller/`); then register the
controller + repository/service providers in `app.module.ts`.

### Switching from `db push` to migrations

The dev command uses `prisma db push` for zero-friction schema sync. For real history:

```bash
./pd exec backend yarn prisma:migrate --name init
```

then change the compose backend `command` to use `yarn prisma:deploy`.

## Auth & permissions

JWT login with a database-backed permission system. Concerns are split:

- **`AuthMiddleware`** (`http/middleware/`) verifies the `Authorization: Bearer <jwt>`
  and attaches the user (with permissions) to the request. It never rejects.
- **`PermissionsGuard`** (`http/guards/`, registered globally) enforces access from the
  `@RequirePermissions(...)` decorator on each route:
  - no decorator → public
  - `@RequirePermissions()` → any authenticated user
  - `@RequirePermissions(PermissionKey.X)` → must hold permission X (`ADMIN` bypasses all)

Permissions are rows in the `permissions` table (many-to-many with `users`), keyed by
`PermissionKey` (`src/common/permission-key.ts`): `ADMIN`, `VIEW_ONLY`, `RUN_LLM`,
`UPDATE_SETTINGS`. Add a permission by inserting a row (and adding the enum key).

Endpoints: `POST /api/auth/login` → `{ accessToken, user }`; `GET /api/auth/me` (auth only).
Project reads require `VIEW_ONLY`, writes require `ADMIN` (example usage).

Seeded users (created by `yarn seed` on first start):

| Email                      | Password   | Permissions |
|----------------------------|------------|-------------|
| admin@productino.local     | admin123   | ADMIN       |
| viewer@productino.local    | viewer123  | VIEW_ONLY   |

Frontend: `/login` posts credentials, stores the JWT in the `productino_token` cookie,
and `useApi()` attaches it on every call. A global route guard redirects unauthenticated
visitors to `/login`. **Change `JWT_SECRET` and the seeded passwords before any real use.**

## AI features (next)

The discovery pipeline (gap analysis → questions → PRD → tasks) plugs into the backend
as a service using the Anthropic SDK. Set `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` in
`code/productino-backend/.env`.
