# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dfiru POS** — a point-of-sale system for a pizza restaurant. npm workspaces monorepo with three packages:

| Package | Purpose |
|---|---|
| `Backend/` | NestJS REST API + WebSocket server |
| `Frontend/` | Expo app (React Native + web) |
| `packages/shared/` | Shared TypeScript types, API client, and React hooks |

## Commands

### From repo root
```bash
npm run dev              # backend (watch) + frontend web, concurrently
npm run db:up            # start only PostgreSQL via Docker Compose
npm run db:down          # stop DB and remove volumes
npm run backend:local    # copy .env.local → .env then start backend
npm run backend:docker   # copy .env.docker → .env then start backend
npm run frontend:web     # expo web only
```

### Backend (run inside `Backend/` or from root with `--prefix Backend`)
```bash
npm run start:dev        # watch mode
npm run build            # compile to dist/
npm run lint             # eslint --fix
npm run test             # jest unit tests
npm run test:e2e         # e2e tests (jest-e2e.json)
npm run test -- --testPathPattern=ordenes  # single test file
npm run seed             # seed users + productos + orders
```

### Frontend (run inside `Frontend/`)
```bash
npm run web              # expo web dev server
npm run start            # expo dev server (mobile + web)
npm run lint             # expo lint
```

## Environment Setup

Copy `Backend/.env.example` to `Backend/.env` and fill in:
- `DATABASE_HOST/PORT/USER/PASSWORD/NAME` — PostgreSQL connection
- `REDIS_HOST/PORT` — Redis for BullMQ and Socket.io adapter
- `JWT_SECRET` — minimum 32 characters
- `CORS_ORIGINS` — comma-separated allowed origins

For full Docker stack: set `DB_PASSWORD`, `JWT_SECRET`, `EXPO_PUBLIC_API_BASE_URL`, `CORS_ORIGINS` in a root `.env`, then `docker compose up`.

## Architecture

### Shared Package (`packages/shared/`)
All type definitions live in `src/types/models.ts` and are the single source of truth for both backend and frontend. The API client is a factory (`createApi(http)`) that wraps axios and returns namespaced methods (`api.ordenes.*`, `api.facturas.*`, etc.). The frontend instantiates this once in `Frontend/services/api.ts` and injects it via `<ApiProvider>`.

React contexts in `packages/shared/src/contexts/`:
- `ApiContext` — provides the `Api` instance to all screens via `useApi()`
- `OrderContext` — order creation form state with AsyncStorage persistence
- `OfflineQueueContext` — queues payment completions when offline, retries on reconnect
- `ToastContext` — global toast notifications

### Backend (`Backend/src/`)
Standard NestJS module structure. Each domain has its own folder: `auth/`, `ordenes/`, `facturas-ventas/`, `facturas-pagos/`, `clientes/`, `domiciliarios/`, `domicilios/`, `productos/`, `pizza-sabores/`, `cierres/`, `empresa/`, `estadisticas/`, `inventario-cajas/`.

**Auth flow**: `JwtAuthGuard` and `RolesGuard` are registered globally via `APP_GUARD`. All routes require authentication by default; use `@Public()` decorator to opt out. Roles: `admin`, `cocina`, `mesero`, `domiciliario`, `cajero`.

**Database**: TypeORM with PostgreSQL. `synchronize: true` in dev (auto-applies entity changes). Timezone forced to `America/Bogota`. Entities use a custom `NumericTransformer` for decimal columns (`Backend/src/common/utils/numeric.transformer.ts`).

**Real-time**: Single `SocketGateway` at the root namespace using Socket.io. Redis adapter (`@socket.io/redis-adapter`) enables multi-instance pub/sub. Services inject the gateway to emit events on order/factura changes.

**Background jobs**: BullMQ queues backed by Redis. Scheduled tasks via `@nestjs/schedule`. A daily cron at `00:05` auto-generates the cash closure (`CierresCronService`) and also runs on server startup to catch missed closures from restarts.

**Business flow**: Creating an order (`POST /ordenes`) auto-creates a `FacturaVenta`. Completing an order (`PATCH /ordenes/:id/completar`) marks both the order and invoice as paid. Idempotency key on completar prevents double-charges on retry.

### Frontend (`Frontend/`)
Expo Router file-based routing under `Frontend/app/(main)/`. Files ending in `.web.tsx` are web-specific overrides for the same route.

**CSS / styling**: `Frontend/src/tw/index.tsx` exports CSS-enabled wrappers (`View`, `Text`, `ScrollView`, etc.) that apply Tailwind classes via `react-native-css`'s `useCssElement`. Always import these wrappers from `@/src/tw` (or `../../tw`) instead of React Native directly. CSS custom properties (e.g., `--color-pos-bg`) define the dark POS theme.

**UI components**: `Frontend/components/ui/` — reusable primitives (Button, Card, Input, Badge, Icon, Toast, PageContainer, etc.). Domain components live alongside their screens in `Frontend/components/`.

**API access in screens**: use `useApi()` hook (from `@monorepo/shared`) inside components wrapped by `<ApiProvider>`. The root layout (`Frontend/app/_layout.tsx`) wires up all providers: `ApiProvider → AuthProvider → ToastProvider → OfflineQueueProvider → OrderProvider`.
