# Dependencies (B2 English)

Summary of core technologies used across the monorepo.

## Infrastructure
- Docker & Docker Compose — local and production orchestration.
- Traefik v2 — reverse proxy and gateway on port 80/8080.
- Nginx (optional) — static hosting for built frontend.

## Backend (NestJS)
- NestJS + TypeScript — main framework.
- TypeORM + PostgreSQL — ORM and database.
- JWT + bcrypt — auth and password hashing.
- Swagger — API docs (at `/api` when enabled).
- ESC/POS printing: `escpos`, `escpos-usb` (optional; guarded by `PRINTER_ENABLED`).
- Telegram bot: `node-telegram-bot-api` (optional; uses `TELEGRAM_BOT_TOKEN`).
- Testing: Jest (unit/e2e scripts available in package.json).

## Frontend (Expo Web/React)
- Expo + React/React Native for web target.
- Expo Router (file-based routing under `app/`).
- Styling: Styled Components/StyleSheet equivalents in `styles/` and component-level styles.

## Tooling
- ESLint configs in Backend and Frontend.
- Node/npm for scripts and builds.

## External services
- Telegram Bot API (for delivery notifications).
- USB thermal printer (ESC/POS) when enabled.

## Notes
- Environment files are not committed; copy `.env.example` where available.
- CI/CD not set yet; suggested next step is a GitHub Actions workflow to build/test Docker images for backend and frontend.
