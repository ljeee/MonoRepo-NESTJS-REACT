# Architecture (B2 English)

High-level view of the monorepo: a Traefik gateway fronts a NestJS API, PostgreSQL database, and an Expo web client.

## Components
- Traefik (port 80, dashboard 8080) — routes traffic to backend and frontend; labels live in docker-compose.yml.
- Backend (NestJS, port 3000) — REST API, TypeORM, JWT/RBAC, optional ESC/POS printing, Telegram bot callbacks.
- PostgreSQL (port 5433 exposed; 5432 internal) — primary data store with products, variants, orders, invoices, deliveries.
- Frontend (Expo Web, port 8081 or served behind Traefik/Nginx) — POS UI consuming the API.
- Optional Nginx — can serve the built frontend if desired.

## Runtime topology
- External traffic → Traefik → `backend` service (at `/api`) and `frontend` service (root path).
- Backend → PostgreSQL for persistence.
- Backend optional callbacks → USB printer (ESC/POS) and Telegram Bot API.

## Key flows
- Order/Invoice flow: create invoice → create order → if delivery, link client/delivery person → store delivery record.
- Products/Pricing: products with variants (size/flavor) and dynamic prices from DB; legacy payloads still supported.
- Daily views: endpoints for today’s orders, deliveries, invoices, and payments ("dia" and "pendientes").

## Environments and config
- Root/docker: `docker-compose.yml` with Traefik, backend, frontend, db. Uses static IPs inside the Docker network.
- Backend env (Backend/.env): database settings, JWT, optional `PRINTER_ENABLED`, `PRINTER_PATH`, `TELEGRAM_BOT_TOKEN`.
- Frontend env (Frontend/.env): API base URL if you need to override auto-detection.

## Deployment notes
- Preferred: Docker Compose with Traefik for a single entrypoint on port 80.
- Direct access (without Traefik): backend on 3000, frontend on 8081, PostgreSQL on 5433.
- Printing: ensure USB permissions on Linux (`/dev/usb/lp0`) or proper COM port on Windows.
- Telegram: create bot via BotFather, add chat_id mapping in `telegram.service.ts` or store in DB.

## References
- Deployment playbook: DOCKER_DEPLOYMENT.md
- Traefik summary: TRAEFIK_IMPLEMENTATION.md
- Products/Pricing reference: SISTEMA_PRODUCTOS_PRECIOS.md
- Order flow details: Backend/README_FLUJO.md
- Daily endpoints: Backend/README_DIARIOS.md
