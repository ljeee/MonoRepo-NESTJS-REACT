# 🍕 POS Pizzería — Monorepo

Sistema punto de venta para pizzería con tres aplicaciones cliente, WebSocket en tiempo real y autenticación JWT.

## 🚀 Estado del Proyecto
El sistema se encuentra actualmente en **Producción**.
- **Dominio**: Gestionado y protegido vía **Cloudflare**.


## Qué contiene

| Carpeta | Tecnología | Descripción |
|---------|-----------|-------------|
| **Backend/** | NestJS + TypeORM + PostgreSQL + Redis | API REST, WebSocket Gateway (Socket.IO), Auth JWT, Swagger |
| **Frontend/** | Expo (React Native Web) + Expo Router + **NativeWind v5** | App web/móvil para el personal (cajeros, cocina, repartidores) |
| **Desktop/** | Tauri v2 + React + Vite | App de escritorio para PC de caja con atajos de teclado y notificaciones nativas |
| **packages/shared/** | TypeScript | Lógica de negocio comentada, tipos y servicios compartidos |
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
│       ├── auth/            # JWT strategy, guards, roles
│       ├── cierres/         # Gestión de cierres de caja [NEW]
│       ├── clientes/        # CRUD clientes
│       ├── common/          # Interceptors, Redis, seeders
│       ├── contabilidad/    # Gestión contable y reportes [NEW]
│       ├── domiciliarios/   # Gestión de domiciliarios
│       ├── domicilios/      # Direcciones de envío
│       ├── empresa/         # Información del negocio [NEW]
│       ├── estadisticas/    # Reportes y visualización [NEW]
│       ├── facturas-pagos/  # Egresos / pagos
│       ├── facturas-ventas/ # Facturación de ventas
│       ├── ordenes/         # CRUD + Socket.IO Gateway
│       ├── ordenes-productos/ # Detalle de productos
│       ├── pizza-sabores/   # Sabores y recargos
│       └── productos/       # Catálogo de productos
├── Frontend/                # Expo (React Native Web)
│   ├── app/                 # Expo Router Hierarchy
│   │   ├── (app)/           # 24+ pantallas internas (Personal)
│   │   └── (web)/           # Vistas públicas/clientes
│   ├── components/          # UI reutilizable
│   ├── constants/           # Design tokens y estados [NEW]
│   ├── contexts/            # Auth, Order, Toast
│   ├── hooks/               # Hooks de negocio y Socket
│   ├── services/            # API Clients
│   ├── src/                 # Configuración principal
│   └── styles/              # Global CSS (web/native)
├── Desktop/                 # Tauri v2 (PC de caja)
│   ├── src/                 # React Frontend (Vite)
│   │   ├── pages/           # 16 vistas principales
│   │   ├── components/      # UI y Sidebar acordeón
│   │   ├── hooks/           # Shortcuts y lógica UI
│   │   └── services/        # Configuración y API
│   └── src-tauri/           # Rust Core (Lógica nativa)
├── packages/shared/         # Lógica compartida, tipos y utilidades
├── Docs/                    # Documentación extendida
├── docker-compose.yml       # Orquestación de servicios
└── package.json             # Scripts globales
```

## Funcionalidades implementadas

### Backend
- **15 módulos CRUD** con controller-service-entity pattern
- **WebSocket Gateway** con Redis Adapter
- **Auth JWT** robusto y Roles
- **Módulos contables**: Cierres de caja, egresos, ventas
- **Módulos de información**: Gestión de empresa, estadísticas
- **BullMQ** para procesos en segundo plano
- **Seeders** automatizados

### Frontend (Expo)
- **24+ pantallas**: Flujo completo de orden, gestión de clientes, productos y finanzas
- **Styling moderno**: Implementado con **NativeWind v5** y **Tailwind CSS v4** para un diseño consistente y rápido
- **Responsive nativo**: Optimizado para tablets y móviles
- **Tiempo real**: WebSocket integrado para notificaciones de órdenes
- **Gestión financiera**: Cierres de caja y balances diarios

### Desktop (Tauri)
- **16 vistas**: Dashboard, gestión total y ajustes locales
- **Nativo**: Atajos de teclado (F1-F3), notificaciones de Windows
- **UX Premium**: Sidebar con acordeón inteligente y cards de estado
- **Configuración local**: Persistencia de URL de API vía Tauri Store

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [Docs/architecture.md](Docs/architecture.md) | Arquitectura actual del sistema |
| [Docs/Roadmap.md](Docs/Roadmap.md) | Roadmap general de la aplicación |
| [Docs/dependencias.md](Docs/dependencias.md) | Stack tecnológico y dependencias |

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