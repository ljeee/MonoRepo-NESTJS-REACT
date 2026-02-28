# POS e Invoicing System with Traefik
This monorepo contains a NestJS backend, an Expo/React web frontend, and a Docker stack with Traefik for unified routing.

## What is here
- POS and invoicing workflow for orders, deliveries, and daily reporting.
- Backend: NestJS + TypeORM + PostgreSQL; optional thermal printing and Telegram notifications.
- Frontend: Expo (web) consuming the API.
- Infra: Docker Compose with Traefik gateway; optional Nginx for the web build.

## Quick start (Docker)
1) Copy environment files if needed:
```
cp Backend/.env.example Backend/.env
```
2) Build and start everything:
```
docker-compose up -d --build
```
3) Main endpoints:
- Frontend: http://localhost:8081 (or http://localhost via Traefik if configured)
- Backend API: http://localhost:3000/api (or http://localhost/api via Traefik)
- Traefik dashboard (optional): http://localhost:8080
- PostgreSQL: localhost:5433

## Quick start (local without Docker)
```
# Backend
cd Backend
npm install
npm run start:dev

# Frontend
cd Frontend
npm install
npm run web
```
The frontend detects the API host from `window.location.hostname` by default.

## Project layout
- Backend/ — NestJS services, DB schemas, seeds, printing/telegram helpers.
- Frontend/ — Expo web app with POS UI components.
- Docs/ — architecture and dependencies (see links below).
- DOCKER_DEPLOYMENT.md — detailed deployment guide with networking, printing, and Telegram setup.
- SISTEMA_PRODUCTOS_PRECIOS.md — full reference for the dynamic products/pricing system (API + frontend usage).

## Docs
- Architecture: Docs/architecture.md
- Dependencies: Docs/dependencias.md
- Deployment details: DOCKER_DEPLOYMENT.md (full) and TRAEFIK_IMPLEMENTATION.md (summary)

## Testing
- Backend: `npm run test` or `npm run test:e2e` inside Backend
- Frontend: add tests as needed (none configured yet)

## CI/CD
CI/CD is not configured yet. Recommended next step: GitHub Actions workflow to build and test Backend and Frontend Docker images on each push to main.

## Notes
- Keep secrets in your own .env files; do not commit credentials.
- Use Docker for the fastest reproduction of the full stack.

## Docker

docker-compose down -v

docker-compose up --build -d

docker exec -it pizzeria-backend npm run seed:users:prod