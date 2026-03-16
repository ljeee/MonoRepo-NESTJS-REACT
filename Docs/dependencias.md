# Dependencias del Proyecto

Resumen de tecnologías usadas en el monorepo.

## Infraestructura
- Docker & Docker Compose — orquestación local y producción.
- PostgreSQL 16 (Alpine) — base de datos.
- Redis 7 (Alpine) — Pub/Sub para Socket.IO, colas BullMQ.
- Cloudflare — hosting estático del frontend en producción.

## Backend (NestJS)
- **NestJS 11** + TypeScript — framework principal.
- **TypeORM** + PostgreSQL — ORM y base de datos.
- **Socket.IO** + `@socket.io/redis-adapter` — WebSocket en tiempo real con Redis adapter.
- **JWT** (passport-jwt) + bcrypt — autenticación y hashing.
- **Swagger** (`@nestjs/swagger`) — documentación API en `/swagger`.
- **Throttler** (`@nestjs/throttler`) — rate limiting (100 req/60s).
- **BullMQ** (`@nestjs/bullmq`) — colas de trabajo con Redis.
- **ioredis** — cliente Redis.
- **class-validator** + **class-transformer** — validación de DTOs.
- Testing: Jest (unit/e2e).

## Frontend (Expo)
- **Expo SDK 54** + React 19 + React Native 0.81.
- **Expo Router** — enrutamiento basado en archivos.
- **NativeWind v5** + **Tailwind CSS v4** — sistema de diseño y utilidades CSS.
- **Axios** — cliente HTTP.
- **socket.io-client** — WebSocket en tiempo real.
- **AsyncStorage** — persistencia local (tokens, estado).
- **clsx** + **tailwind-merge** — manejo de clases CSS.

## Desktop (Tauri v2)
- **Tauri v2** (Rust) — framework de aplicación de escritorio.
- **React 19** + **Vite 7** — frontend web.
- **Tailwind CSS** — utilidades CSS para el frontend.
- **React Router v6** — navegación.
- **Radix UI** — componentes (Dialog, Select, Toast).
- **Lucide React** — iconos.
- **Axios** + **socket.io-client** — comunicación con backend.
- Plugins Tauri: notification, opener, store.

## Herramientas
- ESLint + Prettier en Backend y Frontend.
- Node.js / npm para scripts y builds.
- concurrently — ejecutar Backend + Frontend en paralelo.
- **react-doctor** — diagnóstico y salud del proyecto React.

## Notas
- Los archivos de entorno no se commitean; copiar `.env.example` donde exista.
- CI/CD no configurado aún.
