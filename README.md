# 🍕 Dfiru POS — MonoRepo

Sistema punto de venta para pizzería. Dos paquetes: **Backend NestJS** y **Frontend Expo (React Native + Web)**.

> **Producción activa.** Dominio protegido con Cloudflare Tunnel.

---

## Estructura

```
MonoRepo-NESTJS-REACT/
├── Backend/          # NestJS · REST + WebSocket · PostgreSQL · Redis
├── Frontend/         # Expo · React Native + Web (Expo Router)
├── docker-compose.yml
├── start-pos.bat     # Levanta todo en Windows con un doble clic
└── .env              # Variables de la raíz (Docker Compose)
```

### Backend — módulos (`Backend/src/`)

| Módulo | Descripción |
|--------|-------------|
| `auth/` | JWT strategy, guards globales, roles, registro de usuarios |
| `ordenes/` | CRUD + Socket.IO Gateway (tiempo real) |
| `ordenes-productos/` | Detalle de productos por orden |
| `facturas-ventas/` | Facturación de ventas, estados, pagos mixtos |
| `facturas-pagos/` | Egresos / gastos operativos con denominaciones |
| `caja-movimientos/` | Arqueo de caja, aperturas, ajustes, historial por denominación |
| `clientes/` | CRUD clientes + historial + direcciones |
| `domiciliarios/` | CRUD repartidores |
| `domicilios/` | Asignación y seguimiento de domicilios |
| `productos/` | Catálogo de productos y variantes, stock de bebidas |
| `pizza-sabores/` | Sabores de pizza y recargos por tamaño |
| `inventario-cajas/` | Stock físico de cajas de embalaje con alertas |
| `inventario-bebidas/` | Ingredientes / bebidas con vínculos a variantes |
| `estadisticas/` | Resúmenes, rankings, ventas por hora/día, métodos de pago |
| `contabilidad/` | Reportes contables cruzados |
| `cierres/` | Cierre de caja diario (manual + cron automático a las 00:05) |
| `empresa/` | Configuración NIT, razón social, tarifas |
| `common/` | Interceptors, Redis, mail service, seeders, transformers |

### Frontend — pantallas (`Frontend/app/(main)/`)

Los archivos `.web.tsx` son **overrides web** del mismo route; `.tsx` es la versión nativa/móvil.

| Pantalla | Descripción |
|----------|-------------|
| `index` | Dashboard principal del día |
| `login` | Autenticación |
| `ordenes` | Lista de órdenes activas (wrapper) |
| `ordenes-todas` | Historial paginado de todas las órdenes |
| `crear-orden` | Flujo de creación de orden |
| `editar-orden` | Edición de orden existente |
| `orden-detalle` | Detalle completo de una orden |
| `facturas` | Historial de facturas de ventas |
| `facturas-dia` | Resumen del día con filtros y exportación |
| `facturas-pagos` | Gastos / egresos + arqueo de caja gastos |
| `balance-dia` | Balance completo del día (ventas, caja, arqueo) |
| `balance-fechas` | Balance por rango de fechas |
| `cierre-caja` | Ejecutar cierre diario + historial de cierres |
| `contabilidad` | Reportes contables |
| `estadisticas` | Estadísticas de ventas, productos top, métodos de pago |
| `estadisticas-domiciliarios` | Rendimiento por repartidor |
| `clientes` | CRM de clientes + historial |
| `domiciliarios` | Gestión de repartidores (wrapper) |
| `mis-domicilios` | Vista del repartidor logueado |
| `asignar-domiciliarios` | Asignación de domicilios a repartidores |
| `monitoreo` | Monitor de órdenes en tiempo real (cocina) |
| `inventario-bebidas` | Stock de gaseosas y jugos con ajustes |
| `inventario-cajas` | Stock de cajas de embalaje |
| `gestion-productos` | CRUD de productos y variantes |
| `gestion-sabores` | CRUD de sabores de pizza |
| `usuarios` | Gestión de usuarios del sistema |
| `registro-usuarios` | Registro de nuevos usuarios |
| `ajustes-negocio` | Configuración de la empresa |

---

## Stack tecnológico

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose (producción)                                    │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐  │
│  │  NestJS    │ │ Postgres │ │  Redis   │ │ Frontend (Nginx) │  │
│  │  :3000     │ │  :5433   │ │ interno  │ │ :8081 · web SPA │  │
│  │ REST + WS  │ │ v16      │ │ v7 · LRU │ │ Expo export     │  │
│  └────────────┘ └──────────┘ └──────────┘ └─────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  cloudflared  (Cloudflare Tunnel → dominio público HTTPS) │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

📱 APK firmado  →  Android (personal en LAN o remoto vía Tunnel)
🌐 Web SPA      →  Navegador (misma app, overrides .web.tsx)
```

**Backend:** NestJS · TypeORM · PostgreSQL 16 · Redis 7 · Socket.IO · BullMQ · Nodemailer · Swagger  
**Frontend:** Expo SDK · Expo Router (file-based) · NativeWind v5 · Tailwind CSS v4 · React Native Reanimated · Axios

---

## Inicio rápido

### Docker (recomendado para producción)

```bash
# 1. Variables de entorno
cp .env.example .env        # editar con tus valores

# 2. Levantar todo
docker compose up -d --build

# 3. Seed inicial de usuarios (primera vez)
docker exec -it pizzeria-backend npm run seed:users:prod
```

En Windows: doble clic en **`start-pos.bat`**

### Desarrollo local

```bash
# Desde la raíz — backend + frontend web en paralelo
npm run dev

# Solo levantar la base de datos (Docker) + backend local
npm run db:up
npm --prefix Backend run start:dev

# Solo frontend web
npm --prefix Frontend run web
```

### Build Android (APK release local)

```bash
cd Frontend/android
# Limpiar caché CMake si hay problemas de codegen
Remove-Item -Recurse -Force app/.cxx, app/build, build

# Build firmado
./gradlew.bat assembleRelease
# → Frontend/android/app/build/outputs/apk/release/app-release.apk
```

La firma usa `Frontend/android/app/release.keystore` configurado en `gradle.properties`.

### Build EAS (nube)

```bash
cd Frontend
npx eas-cli@latest build -p android --profile preview   # APK
npx eas-cli@latest build -p android --profile production # AAB Play Store
```

---

## Endpoints

| Servicio | URL |
|----------|-----|
| Backend API | http://localhost:3000 |
| Swagger | http://localhost:3000/swagger |
| Frontend web | http://localhost:8081 |
| PostgreSQL | localhost:5433 |
| WebSocket | ws://localhost:3000 |

---

## Variables de entorno

### Raíz (`.env`) — usado por Docker Compose

```env
DB_PASSWORD=tu-contraseña-postgres
JWT_SECRET=min-32-caracteres-aleatorios
JWT_EXPIRES_IN=28800
CORS_ORIGINS=http://localhost:8081,https://tu-dominio.com
EXPO_PUBLIC_API_BASE_URL=https://tu-api.com
CLOUDFLARE_TUNNEL_TOKEN=tu-token

# Email (reportes de cierre)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=correo@gmail.com
MAIL_PASS=app-password
REPORT_EMAIL=destino@gmail.com
```

### Backend local (`Backend/.env`)

```env
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=appuser
DATABASE_PASSWORD=tu-contraseña
DATABASE_NAME=appdb
JWT_SECRET=min-32-caracteres
JWT_EXPIRES_IN=28800
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Frontend (`Frontend/.env`)

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Comandos útiles

```bash
# Backend
cd Backend
npm run start:dev       # modo watch
npm run test            # unit tests
npm run test:e2e        # e2e tests
npm run seed            # seed completo (dev)
npm run seed:users:prod # solo usuarios (prod)

# Frontend
cd Frontend
npm run web             # Expo web dev server
npm run start           # Expo dev server (móvil + web)
npm run lint

# Docker
docker compose up -d --build          # levantar todo
docker compose down                    # bajar
docker compose down -v                 # bajar + borrar volúmenes
docker exec -it pizzeria-backend bash  # shell del backend

# DB directa (ejemplo: insertar cajas iniciales)
docker exec pizzeria-db psql -U appuser -d appdb -c \
  "INSERT INTO inventario_cajas (nombre, cantidad, \"alertaMinimo\") \
   VALUES ('Caja Pequeña',0,10),('Caja Mediana',0,10),('Caja Grande',0,10);"
```

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| `admin` | Todo el sistema |
| `cajero` | Órdenes, facturas, caja, balance |
| `cocina` | Monitor de órdenes |
| `mesero` | Crear/ver órdenes |
| `domiciliario` | Sus domicilios asignados |

---

## Notas

- Mantener secrets en `.env` local — **nunca commitear credenciales**
- El frontend detecta la API desde `EXPO_PUBLIC_API_BASE_URL`; si no está definida, usa `window.location.hostname`
- `synchronize: true` en TypeORM solo en dev — en prod usar migraciones
- El cron de cierre de caja corre a las **00:05 hora Bogotá** y también al iniciar el servidor (para no perder cierres por reinicios)
