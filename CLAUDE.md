# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visión general

**Dfiru POS** — sistema punto de venta para pizzería (producción activa, dominio `d-firu.com` tras Cloudflare Tunnel). Cuatro apps:

| App | Stack | Propósito |
|-----|-------|-----------|
| `Backend/` | NestJS + PostgreSQL + Redis | REST API + WebSocket gateway |
| `Frontend/` | Expo 55 · Expo Router (RN + web) | POS principal para el staff |
| `RiderApp/` | Expo 56 (RN puro) | App de domiciliarios (solo lectura de sus entregas) |
| `ClientWeb/` | Vite + React (web puro) | Pedidos de clientes finales: login, crear orden, nosotros |

Workspaces npm: `Frontend`, `Backend`, `RiderApp` (y `Desktop`, declarado pero sin carpeta). **`ClientWeb` NO es workspace** — tiene su propio `node_modules`/lockfile y no importa nada de `Frontend/src/shared`.

El código compartido entre Frontend y RiderApp (tipos, API client, hooks, contextos) vive en `Frontend/src/shared/`, importado vía el alias `@/src/shared`. RiderApp lo resuelve con paths en su `tsconfig.json` (`@/src/shared` → `../Frontend/src/shared`) + `metro.config.js` que observa la raíz del monorepo.

---

## Comandos

### Desde la raíz
```bash
npm run dev              # backend (watch) + frontend web, concurrentemente
npm run db:up            # levanta solo PostgreSQL via Docker Compose
npm run db:down          # baja DB y elimina volúmenes
npm run backend:local    # copia .env.local → .env y arranca backend
npm --prefix Backend run start:dev    # backend solo
npm --prefix Frontend run web         # frontend web solo
```

### Backend (`Backend/`)
```bash
npm run start:dev        # modo watch
npm run build            # compila a dist/
npm run lint             # eslint --fix
npm run test             # jest unit tests (17 suites)
npm run test:e2e         # e2e tests (jest-e2e.json)
npx jest --testPathPatterns=ordenes   # test específico
#   ⚠️ El Jest actual renombró el flag: `npm run test -- --testPathPattern=X` FALLA.
npm run seed             # seed completo (usuarios + productos + órdenes)
npm run seed:users:prod  # solo usuarios (producción)
```

### Frontend (`Frontend/`)
```bash
npm run web              # expo web dev server
npm run start            # expo dev server (móvil + web)
npm run lint             # expo lint
npx tsc --noEmit         # type-check
```

### RiderApp (`RiderApp/`)
```bash
npm run start            # expo dev server
npx tsc --noEmit         # type-check
```
Antes de escribir código en RiderApp, leer los docs de la versión exacta de Expo (v56): ver `RiderApp/AGENTS.md`.

### ClientWeb (`ClientWeb/`)
```bash
npm run dev              # vite dev server (puerto 5173)
npm run build            # tsc -b && vite build
npm run lint             # eslint
```

### Android release local (Frontend)
```bash
cd Frontend/android
# Si el build falla por CMake stale cache:
Remove-Item -Recurse -Force app/.cxx, app/build, build
./gradlew.bat assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

---

## Configuración de entorno

- **Backend (`Backend/.env`)**: copiar de `.env.example`. Críticos: `DATABASE_*`, `REDIS_*` (BullMQ + Socket.io adapter), `JWT_SECRET` (≥32 chars), `CORS_ORIGINS` (separados por coma; incluye `http://localhost:5173` para ClientWeb), `MAIL_*` y `REPORT_EMAIL` para reportes de cierre. Puerto por defecto **3000**.
- **Frontend/RiderApp**: `EXPO_PUBLIC_API_BASE_URL`. Si no está definida, en web el host se deriva de `window.location` (`Frontend/services/api.ts` → `getBaseUrl()`: `pos.d-firu.com` → `api.d-firu.com`).
- **ClientWeb (`.env`)**: `VITE_API_BASE_URL` (fallback `http://localhost:3000`).
- **Docker Compose (`.env` raíz)**: `DB_PASSWORD`, `JWT_SECRET`, `EXPO_PUBLIC_API_BASE_URL`, `CORS_ORIGINS`, `CLOUDFLARE_TUNNEL_TOKEN`.
- **Versiones**: root `overrides.react = 19.2.3`. Frontend usa Expo 55/RN 0.83; RiderApp Expo 56/RN 0.85 — **la versión de RN va atada al SDK de Expo; no unificarlas via overrides**.

---

## Arquitectura

### Singleton axios compartido (crítico)

`Frontend/src/shared/services/api.ts` crea el singleton `http` (axios) y `api = createApi(http)`. El `AuthProvider` compartido (`Frontend/src/shared/contexts/AuthContext.tsx`) inyecta el header `Authorization` y monta el interceptor de refresh 401 **sobre ese singleton**. `Frontend/services/api.ts` no crea instancia propia: configura el `baseURL` del singleton (`setApiBaseUrl(http, getBaseUrl())`) y lo re-exporta. **Nunca crear una segunda instancia de axios en el Frontend** — las pantallas quedarían sin token tras el login (bug que ya ocurrió). RiderApp usa el mismo singleton vía `@/src/shared`.

### Shared (`Frontend/src/shared/`)

- **Tipos**: `types/models.ts` — fuente de verdad única del frontend. Deben mantenerse congruentes con las entidades/DTOs del Backend.
- **Barrel** `index.ts`: solo **named exports** (nada de `export *` — rompe tree-shaking). Al añadir símbolos nuevos, exportarlos explícitamente.
- **API client**: factory `createApi(http)` con métodos namespaciados (`api.auth.*`, `api.ordenes.*`, `api.facturas.*`, `api.domicilios.*`, `api.productos.*`, `api.empresa.*`, `api.cierres.*`, etc.). Los métodos ya retornan el `.data` de axios — no acceder a `.data` en las pantallas.
- **Contextos**: `ApiContext` (`useApi()`), `AuthContext` (AsyncStorage + refresh; el Frontend lo consume vía el wrapper `Frontend/contexts/AuthContext.tsx` que añade `useAuthNavigation` con redirects por rol), `OrderContext` (slots del formulario de orden), `OfflineQueueContext`, `ToastContext`.

### Backend (`Backend/src/`)

**Módulos**: `auth · ordenes · ordenes-productos · facturas-ventas · facturas-pagos · caja-movimientos · clientes · domiciliarios · domicilios · productos · pizza-sabores · inventario-cajas · inventario-bebidas · estadisticas · contabilidad · cierres · empresa · common`.

**Auth**: `JwtAuthGuard` + `RolesGuard` + `ContadorGuard` globales via `APP_GUARD` — toda ruta exige JWT salvo `@Public()`. Roles: `admin, cajero, cocina, mesero, domiciliario, cliente, contador`.
- **Contador**: rol de SOLO LECTURA limitado a contabilidad. `ContadorGuard` bloquea todo método ≠ GET y toda ruta fuera de `/contabilidad`, `/estadisticas`, `/facturas-ventas`, `/facturas-pagos`. En el POS solo ve la pantalla Contabilidad (menú exclusivo en `Navbar.tsx` + redirect en `useAuthNavigation`).
- **Staff**: login por username (`POST /auth/login`); `JwtStrategy` valida contra tabla `users` por `sub` (uuid).
- **Clientes finales**: `POST /auth/cliente/login` y `/auth/cliente/registro` (públicos, teléfono + password); el token lleva `sub = teléfono` y rol `cliente`, y `JwtStrategy` lo valida contra la tabla `clientes`. `POST /ordenes` admite rol `cliente` con hardening (fuerza `tipoPedido='domicilio'` y `telefonoCliente` del token).
- `GET /domicilios/me` matchea `telefonoDomiciliarioAsignado = user.username` — los usuarios domiciliarios deben tener `username = teléfono` (así los crea el seed).

**Base de datos**: TypeORM + PostgreSQL, `synchronize: true` en dev, timezone `America/Bogota`. Columnas decimales usan `NumericTransformer` (`common/utils/numeric.transformer.ts`). Fechas por día con `getBogotaDayBoundaries` (`common/utils/date.utils.ts`).

**Tiempo real**: `OrdenesGateway`/`EstadisticasGateway` comparten namespace `/ordenes` (Socket.IO). La conexión exige un JWT válido en `handshake.auth.token` (verificado con `JwtService.verify`, `OrdenesGateway.handleConnection`) — sin token válido el socket se desconecta; antes solo confiaba en un string `dispositivo` sin validar identidad. El hook cliente `useOrdenesSocket(baseUrl, dispositivo, onRefresh, token)` (`Frontend/src/shared/hooks/use-ordenes-socket.ts`) no conecta si falta `token`. Se usa en `OrdersOfDayPending`, `facturas-dia.tsx` y `balance-dia.tsx` para autorefrescar con el evento `stats:update`. Hay también un `SocketGateway` inerte en `common/gateways/` (namespace raíz, solo loggea, sin emits/listens — no confundir con el de órdenes).

**Ubicación del domiciliario**: RiderApp reporta su posición GPS cada 20s (tracking estilo WhatsApp, con `distanceInterval: 50m` como trigger complementario) en segundo plano — funciona con pantalla bloqueada y `killServiceOnDestroy: false` mantiene el servicio incluso si el usuario mata la app desde recientes. Usa `expo-location` background + foreground service (Android) + `pausesUpdatesAutomatically: false` (iOS). Reporta a `PATCH /domiciliarios/me/ubicacion` (`Role.Domiciliario`, matchea por `user.username` = teléfono). Se guarda en `Domiciliarios.ultimaLatitud/ultimaLongitud/ultimaUbicacionFecha`. El POS (`asignar-domiciliarios.tsx`, sección "Asignados Hoy") muestra "hace Xm" + botón que abre esa posición en Google Maps — sin librería de mapas embebida, solo REST + polling (ya existente cada 30s en esa pantalla).

**RiderApp — estructura**: `App.tsx` es solo el shell (`ErrorBoundary → SafeAreaProvider → ToastProvider → AuthProvider → Main`). Las pantallas viven en `src/screens/` (`LoginScreen`, `DeliveriesScreen`, `SettingsScreen`), los componentes en `src/components/` (`ui.tsx` con `Card/Pill/ChipButton/ActionButton/InfoRow`, `TabBar.tsx`, `ErrorBoundary.tsx`) y los tokens de diseño en `src/lib/theme.ts`. Navegación por **pestañas propias** (Entregas · Ajustes) — sin `react-navigation`/`expo-router`: son solo dos destinos y cada dependencia nativa extra es superficie de crash. Ambas pantallas quedan montadas y se oculta la inactiva con `display:'none'` para no re-pedir domicilios al cambiar de pestaña. Íconos con `@expo/vector-icons` (viene con `expo`, resuelto desde la raíz del workspace por `metro.config.js`).

**RiderApp — estabilidad y ubicación** (`src/lib/location.ts`): reglas que ya costaron bugs en producción —
1. NUNCA llamar `Location.startLocationUpdatesAsync` con `foregroundService` sin `ACCESS_BACKGROUND_LOCATION` concedido: en Android 14 lanza un `SecurityException` **fatal**. `ensureTracking()` verifica permisos antes y retorna un código de resultado en vez de lanzar.
2. El tracking **NO puede vivir en el `useEffect` de una pantalla**. Estuvo dentro de `DashboardScreen` y, como abrir Ajustes desmontaba esa pantalla, el cleanup apagaba el GPS: la pantalla que existe para arreglar permisos era la que rompía el rastreo. Ahora `useLocationTracking(!!user)` se monta en `Main`, colgado de la **sesión**; solo se detiene al cerrar sesión.
3. Re-verificación en `AppState === 'active'` (con `ask:false` para no acosar con pop-ups): revive el servicio si el SO lo mató y recoge el permiso "Permitir todo el tiempo" que el usuario acaba de conceder en Ajustes del sistema — antes había que reiniciar la app para que surtiera efecto.
`ensureTracking` es idempotente (chequea `hasStartedLocationUpdatesAsync` antes de arrancar). La `SettingsScreen` muestra el estado real del servicio y permisos, y reintenta con `ask:true`. Todo el flujo está blindado con try/catch y la app envuelta en un `ErrorBoundary` propio (RN puro, no usa `@/src/shared/tw`). La background task se registra en `src/tasks/locationTask.ts`, importada en `index.js` **antes** de `App` (modo headless de Android).

**Background jobs**: BullMQ + Redis; cron `@nestjs/schedule`. Cierre automático a las 00:05 Bogotá (`CierresCronService`), también al arrancar para recuperar cierres perdidos.

### Flujo de negocio

- `POST /ordenes` → crea orden y `FacturaVenta` automáticamente. Contrato de items (referencia: `Frontend/components/orderForm/CreateOrderForm.tsx`): `{ tipo: productoNombre, varianteId (requerido), cantidad, sabor1..3?, base? }`. ClientWeb replica este contrato en `ClientWeb/src/lib/types.ts`.
- `PATCH /ordenes/:id/completar` → marca orden y factura pagadas (idempotency key).
- **Métodos de pago**: `'efectivo' | 'transferencia' (UI: "QR/Trans") | 'efectivo_transferencia' (UI: "Mixto")`. El desglose mixto vive en `pagoEfectivo`/`pagoTransferencia` de la factura.
- **Abonos** (`PATCH /facturas-ventas/:id/abono`): `AbonoDto { monto, metodo?: 'efectivo'|'transferencia', denominaciones?, cambioDenominaciones? }`. Acumula `montoPagado` y el desglose por método; al saldarse deriva `metodo` final (mixta si hubo ambos). Solo los abonos en efectivo generan movimiento de caja. El monto que envía el modal es **neto** (recibido − cambio).
- **Filtros por método**: helper compartido `matchesMetodoFilter` (`Frontend/components/ui/MethodFilterChips.tsx`) — "Efectivo" y "QR" incluyen facturas mixtas cuya componente sea > 0; "Mixto" es bucket propio. El `findAll` del backend aplica la misma semántica server-side (usado por balance-fechas).
- **Caja de gastos**: `cajaOrigen: 'principal' | 'gastos'`. Gastos con `metodo: 'efectivo'` mueven la caja de gastos; `'qr'` y `'efectivo_no_caja'` no.
- **Cajas de embalaje** (`inventario-cajas`): el `nombre` de una caja es texto libre que el admin escribe (sin enum). El descuento automático al crear una orden (`OrdenesService.necesitaCaja` → solo `'domicilio'`/`'llevar'`, nunca `'mesa'`) clasifica el producto en una categoría (`pequena|mediana|grande|calzone`, `InventarioCajasService.resolverCategoriaCaja`) y busca cualquier caja cuyo `nombre` **contenga** la palabra clave de esa categoría (tolerante a mayúsculas/tildes/plural) — **no** compara igualdad exacta, precisamente para evitar bugs de redacción ("Caja pequeña" vs "Caja Pizza Pequeña" vs "Cajas Pequeñas" deben calzar igual).
- **Inventario unificado** (`Frontend/app/(main)/inventario.tsx`): Cajas y Bebidas viven en **una sola pantalla** con pestañas (Cajas · Bebidas · Movimientos) — reemplazó a `inventario-cajas.tsx` + `inventario-bebidas*.tsx` (borradas). Un único helper `clasificar(cantidad, alerta)` deriva el estado `ok|bajo|critico` que alimenta píldora, color del número y medidor. El medidor se llena contra un `nivelObjetivo` real (columna nueva) y dibuja la alerta como marca; si no hay objetivo, estima uno y lo rotula `~`. Cajas usan `alertaMinimo`+`nivelObjetivo`; las bebidas guardan su config **en la variante** (`categoriaBebida`, `alertaBebida`, `nivelObjetivoBebida` — columnas nuevas en `producto_variantes`) vía `PATCH /productos/variantes/:id/config-bebida`. Bebidas se agrupan por `categoriaBebida ?? (derivada del nombre) ?? 'otra'`; una variante se rastrea si tiene `categoriaBebida` o su producto matchea `BEBIDA_NAME_RE`. Ambas pestañas comparten el mismo control: stepper −/+ y campo "¿cuántas llegaron?". `api.inventarioCajas.configurar(id, {alertaMinimo?, nivelObjetivo?})` reemplazó a `configurarAlerta` y ahora retorna el estado completo de la caja.
- **Precio manual por ítem** (Crear Orden): `CreateOrdenItemDto.precioUnitario?` opcional; cuando llega, `product-processing.service` lo usa tal cual y **NO** aplica recargos por sabor/base. El controller lo **descarta para el rol `cliente`** (no puede fijarse su propio precio). En el front vive como `OrderCartItem.precioOverride`; el carrito permite editarlo inline y restaurarlo.
- **Cotización copiable**: el `CartPanel` (Crear Orden) tiene "Copiar cotización" — arma el carrito actual como texto WhatsApp (`expo-clipboard`) con precio efectivo, para mandarle la cuenta al cliente antes de crear la orden.
- **Teléfonos colombianos** (`Frontend/src/shared/utils/phone.ts`): se guardan **siempre** en local de 10 dígitos. `normalizePhone` quita el `+57`/espacios al pegar (clave: `GET /domicilios/me` matchea `telefonoDomiciliarioAsignado` = `username`); `toDialablePhone`/`toWhatsappPhone` reañaden el indicativo solo para marcar/WhatsApp. RiderApp muestra el teléfono normalizado y tiene botón **Llamar**.

### Frontend (`Frontend/`)

**Routing**: Expo Router file-based bajo `app/(main)/`. Los `.web.tsx` son overrides web del mismo route.

**Listas — regla clave**: en pantallas **nativas** usar `FlashList` v2 (`@shopify/flash-list` — ya **no existe** `estimatedItemSize`). En pantallas **web** usar `ScrollView` de `../../tw` con `className` — los componentes raw de RN (FlatList/FlashList) no reciben altura de la cadena flex vía className en web y colapsan invisibles (patrón documentado en `facturas.tsx` y `usuarios.web.tsx`). Items de lista siempre extraídos y envueltos en `React.memo`, con callbacks estabilizados en `useCallback` en el padre.

**Styling**: `Frontend/tw/index.tsx` exporta wrappers (`View`, `Text`, `ScrollView`, `Pressable`…) que aplican Tailwind via `react-native-css` — **importar de `../../tw`, no de `react-native`** (salvo estilos StyleSheet puros). NativeWind v5 / Tailwind v4; CSS vars (`--color-pos-bg`, `--color-pos-primary`) definen el tema oscuro POS. Estilos estáticos de items de lista en `StyleSheet.create`; dinámicos merged (`[styles.x, { width }]`).

**Componentes UI** (`Frontend/components/ui/`): `Button`, `PageHeader` (+`rightContent`), `PageContainer` (con `refreshControl`), `Card`, `Input`, `Badge`, `Icon`, `ConfirmModal`, `BillCounter` (denominaciones COP), `MethodFilterChips`, `CajaMovimientosWidget`, `AjusteCajaModal`. `PaymentSelectionModal` (en `components/orders/`) maneja cobro completo y abonos (`mode='partial'`).

**Patrones**: `useApi()` dentro de `<ApiProvider>`; providers montados en `app/_layout.tsx` en orden `ApiProvider → AuthProvider → ToastProvider → OfflineQueueProvider → OrderProvider`. `useBreakpoint()` de `styles/responsive.ts` para layouts responsive. Formatters `Intl` hoisted a module level (no recrearlos por render).

### ClientWeb (`ClientWeb/src/`)

Standalone: `lib/api.ts` (axios + Bearer de localStorage + refresh en 401), `lib/types.ts` (tipos espejo de los DTOs del backend — mantener congruentes), `context/AuthContext.tsx` (login/registro de cliente por teléfono), rutas react-router: `/` (pedido con catálogo real + carrito, requiere login), `/login`, `/nosotros` (consume `GET /empresa`, público — marca "Dfiru Pizzería").

---

## Convenciones de código

- **TypeScript estricto** — no usar `any` salvo donde sea inevitable.
- **Hooks personalizados** para lógica de pantalla compleja (`use-facturas.ts`, `use-facturas-pagos-screen.ts`…) — la lógica fuera de los componentes.
- **`formatCurrency(n)`** de `@/src/shared` para montos (retorna `"15.000"`).
- **`getLocalDateString()`** de `src/shared/utils/dateRange` para la fecha local — evita desfases UTC vs Bogotá.
- Importar componentes UI desde `../../components/ui` (no `@/components`).
