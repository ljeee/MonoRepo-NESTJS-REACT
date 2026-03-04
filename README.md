# 🍕 POS Pizzería — Monorepo

Sistema punto de venta para pizzería con tres aplicaciones cliente, WebSocket en tiempo real y autenticación JWT.

## Qué contiene

| Carpeta | Tecnología | Descripción |
|---------|-----------|-------------|
| **Backend/** | NestJS + TypeORM + PostgreSQL + Redis | API REST, WebSocket Gateway (Socket.IO), Auth JWT, Swagger |
| **Frontend/** | Expo (React Native Web) + Expo Router | App web/móvil para el personal (cajeros, cocina, repartidores) |
| **Desktop/** | Tauri v2 + React + Vite | App de escritorio para PC de caja con atajos de teclado y notificaciones nativas |
| **Docs/** | Markdown | Arquitectura, roadmaps, guías de despliegue |

## Stack actual

```
┌──────────────────────────────────────────────────────────────┐
│  Docker Compose                                              │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ NestJS     │ │ Postgres │ │  Redis   │ │ Frontend     │  │
│  │ :3000      │ │ :5433    │ │ (interno)│ │ :8081 (Nginx)│  │
│  │ API + WS   │ │          │ │ Pub/Sub  │ │              │  │
│  └────────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────────────┘
  📱 Expo APK / Web   → celulares del personal (LAN)
  🖥️  Tauri .exe       → PC fija de caja (Windows)
```

## Inicio rápido (Docker)

```bash
# 1. Copiar variables de entorno
cp Backend/.env.example Backend/.env
npx -y react-doctor@latest

# 2. Levantar todo
docker-compose up -d --build

# 3. Seed de usuarios (primera vez)
docker exec -it pizzeria-backend npm run seed:users:prod
```

O simplemente ejecutar `start-pos.bat` (Windows).

### Endpoints disponibles

| Servicio | URL |
|----------|-----|
| Backend API | http://localhost:3000 |
| Swagger | http://localhost:3000/swagger |
| Frontend (web) | http://localhost:8081 |
| PostgreSQL | localhost:5433 |
| WebSocket | ws://localhost:3000/ordenes |

## Inicio rápido (desarrollo local)

```bash
# Backend
cd Backend
npm install
npm run start:dev

# Frontend (Expo web)
cd Frontend
npm install
npm run web

# Desktop (Tauri)
cd Desktop
npm install
npm run tauri dev
```

Script combinado desde la raíz:
```bash
npm run dev          # Backend + Frontend en paralelo
npm run dev:docker   # Sube la DB en Docker + Backend local
```

## Estructura del proyecto

```
MonoRepo/
├── Backend/                 # NestJS API
│   └── src/
│       ├── auth/            # JWT strategy, guards, roles, login/register
│       ├── clientes/        # CRUD clientes
│       ├── common/          # Interceptors, Redis module/adapter, seeders
│       ├── domiciliarios/   # Gestión de domiciliarios
│       ├── domicilios/      # Direcciones de envío
│       ├── facturas-pagos/  # Egresos / pagos
│       ├── facturas-ventas/ # Facturación de ventas
│       ├── ordenes/         # CRUD + Socket.IO Gateway (tiempo real)
│       │   └── services/    # FacturaCreation, DomicilioCreation, ProductProcessing
│       ├── ordenes-productos/ # Detalle de productos por orden
│       ├── pizza-sabores/   # Sabores y recargos por tamaño
│       └── productos/       # Catálogo de productos + variantes
├── Frontend/                # Expo (React Native Web)
│   ├── app/                 # 15 pantallas (Expo Router)
│   ├── components/          # UI reutilizable (Navbar accordion, formularios, estados)
│   ├── contexts/            # AuthContext, OrderContext, ToastContext
│   ├── hooks/               # 10+ hooks (WebSocket, CRUD, búsquedas)
│   ├── services/            # Cliente Axios
│   ├── styles/              # Design tokens, tema, responsive
│   └── types/               # Modelos TypeScript
├── Desktop/                 # Tauri v2 (PC de caja)
│   ├── src/
│   │   ├── pages/           # 12 vistas (Login, Ordenes, CrearOrden, Facturas, etc.)
│   │   ├── components/      # Sidebar accordion, formularios de orden
│   │   ├── contexts/        # Auth, Order, Toast
│   │   ├── hooks/           # 14 hooks (incl. keyboard-shortcuts)
│   │   ├── services/        # API + settings (URL backend configurable)
│   │   ├── styles/          # CSS modular (8 archivos)
│   │   └── utils/           # CSV export, impresión, fechas
│   └── src-tauri/           # Rust (Tauri core)
├── Docs/                    # Documentación
├── docker-compose.yml       # DB + Redis + Backend + Frontend
├── start-pos.bat            # Script de arranque Windows
└── package.json             # Scripts raíz (dev, db:up, etc.)
```

## Funcionalidades implementadas

### Backend
- **10 módulos CRUD** con controllers, services, entities y DTOs
- **WebSocket Gateway** (Socket.IO + Redis Adapter) en namespace `/ordenes`
  - Eventos: `orden:nueva`, `orden:actualizada`, `cocina:nueva-orden`, `whatsapp:handoff`
  - Rooms por dispositivo (cajero, cocina, admin, repartidor)
- **Auth JWT** con guards, roles y decorador `@Public()`
- **Swagger** en `/swagger` con Bearer auth
- **Throttling** (100 req/60s via `@nestjs/throttler`)
- **BullMQ** (Redis) para colas de trabajo
- **LoggingInterceptor** global
- **Seeders**: usuarios, productos, órdenes
- **Servicios refactorizados**: FacturaCreationService, DomicilioCreationService, ProductProcessingService

### Frontend (Expo)
- **15 pantallas**: crear orden, órdenes del día, historial, facturas, balances, clientes, domiciliarios, gestión de productos
- **Navbar con acordeón**: 3 secciones (Órdenes, Facturas, Información) con auto-expand
- WebSocket en tiempo real (`use-ordenes-socket`)
- AuthContext con persistencia en AsyncStorage
- Sistema de diseño con tokens, tema y responsive

### Desktop (Tauri)
- **12 vistas**: Login, Órdenes del día, Crear Orden, Todas las Órdenes, Detalle Orden, Facturas, Balance por Fechas, Egresos, Historial, Clientes, Domiciliarios, Catálogo, Ajustes
- **Sidebar con acordeón**: 3 secciones (Órdenes, Facturación, Información) igual que Expo
- **CSS modular**: 8 archivos (base, utilities, buttons, layout, sidebar, ordenes, facturas, components)
- Atajos de teclado: F1 (crear orden), F2 (órdenes), F3 (facturas)
- URL del backend configurable (persistida con Tauri Store)
- Notificaciones nativas de Windows
- Prevención de cierre accidental
- Cards con estado coloreado (verde=pagado, amarillo=pendiente, rojo=cancelado)

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [Docs/architecture.md](Docs/architecture.md) | Arquitectura actual del sistema |
| [Docs/dependencias.md](Docs/dependencias.md) | Stack tecnológico y dependencias |
| [Docs/DOCKER_DEPLOYMENT.md](Docs/DOCKER_DEPLOYMENT.md) | Guía de despliegue Docker |
| [Docs/SISTEMA_PRODUCTOS_PRECIOS.md](Docs/SISTEMA_PRODUCTOS_PRECIOS.md) | Sistema de productos, variantes y precios |
| [Docs/README_FLUJO.md](Docs/README_FLUJO.md) | Flujo de trabajo del sistema |
| [Docs/ROADMAP_MEJORAS.md](Docs/ROADMAP_MEJORAS.md) | Roadmap de mejoras UX + Estadísticas (Expo + Tauri) |
| [Docs/ROADMAP_CONTABILIDAD.md](Docs/ROADMAP_CONTABILIDAD.md) | Roadmap contable (Exports CSV/PDF) |
| [Docs/ROADMAP_N8N.md](Docs/ROADMAP_N8N.md) | Roadmap integración n8n/WhatsApp/Ollama |
| [Docs/REFACTORING.md](Docs/REFACTORING.md) | Plan de refactorización técnica |
| [Docs/VIOLACIONES_BACKEND.md](Docs/VIOLACIONES_BACKEND.md) | Auditoría de código del backend |

## Testing

```bash
# Backend
cd Backend
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run lint          # ESLint

# Frontend
cd Frontend
npm run lint
```

## Docker

```bash
# Levantar todo
docker-compose up -d --build

# Solo la base de datos (desarrollo local)
npm run db:up

# Bajar todo con volúmenes
  docker-compose down -v

# Seed de usuarios en producción
docker exec -it pizzeria-backend npm run seed:users:prod

# Seed completo (dev)
cd Backend && npm run seed
```

## Variables de entorno

Crear `Backend/.env` con:

```env
# Postgres
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=appuser
DATABASE_PASSWORD=tu-contraseña
DATABASE_NAME=appdb

# JWT
JWT_SECRET=min-32-caracteres-aleatorios
JWT_EXPIRES_IN=28800

# CORS
CORS_ORIGINS=http://localhost:8081,http://localhost:5173,http://localhost:1420,tauri://localhost

# Redis (solo en Docker)
REDIS_HOST=redis
REDIS_PORT=6379
```

## Notas

- Mantener secretos en archivos `.env` locales — no commitear credenciales
- El Frontend detecta la API desde `window.location.hostname` por defecto
- El Desktop permite configurar la URL del backend en la pantalla de ajustes
- Para desarrollo local usar `npm run dev` desde la raíz