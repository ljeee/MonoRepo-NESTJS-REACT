# CLAUDE.md

Guía para agentes de IA trabajando en este repositorio.

## Visión general

**Dfiru POS** — sistema punto de venta para pizzería. Monorepo npm con dos paquetes:

| Paquete | Propósito |
|---------|-----------|
| `Backend/` | NestJS REST API + WebSocket gateway |
| `Frontend/` | Expo (React Native + web en el mismo código) |

El código compartido (tipos, API client, hooks, contextos) vive en `Frontend/src/shared/` — importado vía el path alias `@/src/shared`.

---

## Comandos

### Desde la raíz
```bash
npm run dev              # backend (watch) + frontend web, concurrentemente
npm run db:up            # levanta solo PostgreSQL via Docker Compose
npm run db:down          # baja DB y elimina volúmenes
npm --prefix Backend run start:dev    # backend solo
npm --prefix Frontend run web         # frontend web solo
```

### Backend (`Backend/`)
```bash
npm run start:dev        # modo watch
npm run build            # compila a dist/
npm run lint             # eslint --fix
npm run test             # jest unit tests
npm run test:e2e         # e2e tests (jest-e2e.json)
npm run test -- --testPathPattern=ordenes  # test específico
npm run seed             # seed completo (usuarios + productos + órdenes)
npm run seed:users:prod  # solo usuarios (producción)
```

### Frontend (`Frontend/`)
```bash
npm run web              # expo web dev server
npm run start            # expo dev server (móvil + web)
npm run lint             # expo lint
```

### Android release local
```bash
cd Frontend/android
# Si el build falla por CMake stale cache:
Remove-Item -Recurse -Force app/.cxx, app/build, build
# Build firmado:
./gradlew.bat assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

---

## Configuración de entorno

### Backend (`Backend/.env`)
Copiar de `Backend/.env.example`. Campos críticos:
- `DATABASE_HOST/PORT/USER/PASSWORD/NAME` — PostgreSQL
- `REDIS_HOST/PORT` — Redis para BullMQ y Socket.io adapter
- `JWT_SECRET` — mínimo 32 caracteres
- `CORS_ORIGINS` — orígenes separados por coma
- `MAIL_*` — SMTP para envío de reportes de cierre
- `REPORT_EMAIL` — destinatario de reportes diarios

### Docker Compose (`.env` raíz)
Para el stack completo: `DB_PASSWORD`, `JWT_SECRET`, `EXPO_PUBLIC_API_BASE_URL`, `CORS_ORIGINS`, `CLOUDFLARE_TUNNEL_TOKEN`.

---

## Arquitectura

### Shared (`Frontend/src/shared/`)

**Tipos:** `src/shared/types/models.ts` — fuente de verdad única para todos los tipos del frontend.

**API Client:** factory `createApi(http: AxiosInstance)` que retorna métodos namespaciados:
- `api.auth.*` — login, refresh, register, getUsers
- `api.ordenes.*` — CRUD + completar + cancel
- `api.facturas.*` — facturas de ventas
- `api.pagos.*` — gastos / egresos
- `api.clientes.*` — CRUD + direcciones
- `api.domiciliarios.*` — CRUD repartidores
- `api.domicilios.*` — asignación y seguimiento
- `api.productos.*` — catálogo + variantes + stock bebidas
- `api.pizzaSabores.*` — sabores y recargos
- `api.estadisticas.*` — reportes y rankings
- `api.empresa.*` — config de empresa
- `api.cierres.*` — cierre de caja
- `api.inventarioCajas.*` — stock de cajas físicas
- `api.cajaDenominaciones.*` — arqueo de caja por denominaciones (principal/gastos)
- `api.inventarioBebidas.*` — ingredientes + vínculos a variantes

Instanciado una sola vez en `Frontend/services/api.ts`, inyectado via `<ApiProvider>`.

**Contextos React** (`Frontend/src/shared/contexts/`):
- `ApiContext` — provee instancia `Api` via `useApi()`
- `OrderContext` — estado del formulario de creación de orden (AsyncStorage)
- `OfflineQueueContext` — cola pagos en offline, reintenta al reconectar
- `ToastContext` — notificaciones globales

### Backend (`Backend/src/`)

**Módulos activos:**
```
auth · ordenes · ordenes-productos · facturas-ventas · facturas-pagos
caja-movimientos · clientes · domiciliarios · domicilios · productos
pizza-sabores · inventario-cajas · inventario-bebidas · estadisticas
contabilidad · cierres · empresa · common
```

**Auth:** `JwtAuthGuard` + `RolesGuard` registrados globalmente via `APP_GUARD`. Todas las rutas requieren auth por defecto; usar `@Public()` para optar fuera. Roles: `admin`, `cajero`, `cocina`, `mesero`, `domiciliario`.

**Base de datos:** TypeORM + PostgreSQL. `synchronize: true` en dev. Timezone forzado a `America/Bogota`. Columnas decimales usan `NumericTransformer` (`Backend/src/common/utils/numeric.transformer.ts`).

**Tiempo real:** Un solo `SocketGateway` en el namespace raíz (Socket.io). Redis adapter (`@socket.io/redis-adapter`) para pub/sub multi-instancia. Los servicios inyectan el gateway para emitir eventos en cambios de órdenes/facturas.

**Background jobs:** BullMQ + Redis. Cron `@nestjs/schedule`. Cierre automático a las 00:05 hora Bogotá via `CierresCronService`; también corre al iniciar el servidor para recuperar cierres perdidos.

**Flujo de negocio:**
- `POST /ordenes` → crea orden y `FacturaVenta` automáticamente
- `PATCH /ordenes/:id/completar` → marca orden y factura como pagadas (idempotency key)
- `POST /caja-movimientos/apertura` → abre caja del día con denominaciones contadas
- `POST /caja-movimientos/ajuste` → ingreso / retiro / cambio de billetes
- `POST /cierres` → cierra el día, envía reporte por email

**Caja de gastos:** `cajaOrigen: 'principal' | 'gastos'` — permite separar el flujo de efectivo de ventas del flujo de gastos operativos. Los gastos con `metodo: 'efectivo'` mueven la caja de gastos; `metodo: 'qr'` y `metodo: 'efectivo_no_caja'` no.

### Frontend (`Frontend/`)

**Routing:** Expo Router file-based bajo `Frontend/app/(main)/`. Los archivos `.web.tsx` son overrides web del mismo route. Las pantallas sin override usan el `.tsx` en ambas plataformas.

**Styling:**
- `Frontend/tw/index.tsx` exporta wrappers CSS (`View`, `Text`, `ScrollView`, etc.) que aplican clases Tailwind via `react-native-css`. **Importar siempre de `../../tw` en lugar de `react-native` directamente.**
- CSS custom properties (`--color-pos-bg`, `--color-pos-primary`, etc.) definen el tema oscuro POS.
- Usar NativeWind v5 / Tailwind v4 para clases `className`.

**Componentes UI** (`Frontend/components/ui/`):
- `Button` — variantes: primary/secondary/danger/ghost/outline; tamaños sm/md/lg; soporta icon + iconRight
- `PageHeader` — título + subtítulo + icono + `rightContent` (fijo en la misma fila, sin `w-full` en móvil)
- `PageContainer` — scroll container con `refreshControl`
- `Card`, `Input`, `Badge`, `Icon`, `Toast`, `ConfirmModal`, `SkeletonLoader`
- `BillCounter` — selector de billetes colombianos (denominaciones COP)
- `CajaMovimientosWidget` — historial de movimientos de caja con selector de fecha
- `AjusteCajaModal` — modal para ingresar / retirar / sencillar billetes

**Acceso a la API en pantallas:** usar `useApi()` (de `@/src/shared`) dentro de componentes envueltos por `<ApiProvider>`. El layout raíz (`Frontend/app/_layout.tsx`) monta todos los providers en orden:
```
ApiProvider → AuthProvider → ToastProvider → OfflineQueueProvider → OrderProvider
```

**Breakpoint responsive:** `useBreakpoint()` de `Frontend/styles/responsive.ts` retorna `{ isMobile, isTablet, isDesktop }`. En móvil, los layouts se vuelven columna; en desktop, fila.

**Patrones de pantalla:** todas usan `PageContainer` + `PageHeader` con `rightContent` para el botón de refrescar (icono ghost, no ocupa fila completa). El pull-to-refresh se maneja con `RefreshControl` en el `PageContainer`.

---

## Convenciones de código

- **TypeScript estricto** — no usar `any` salvo donde sea inevitable
- **Hooks personalizados** para lógica de negocio compleja (`use-facturas-pagos-screen.ts`, `use-facturas.ts`, etc.) — mantienen la lógica fuera de los componentes de pantalla
- **`formatCurrency(n)`** de `@/src/shared` para todos los montos — retorna string con puntos de miles (ej: `"15.000"`)
- **`getLocalDateString()`** de `src/shared/utils/dateRange` para la fecha local — evita problemas de timezone UTC vs Bogotá
- Importar componentes UI desde `../../components/ui` (no `@/components`)
- Los métodos del API client ya retornan el `.data` de axios — no acceder a `.data` en los screens
