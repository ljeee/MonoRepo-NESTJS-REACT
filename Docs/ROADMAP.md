# 🍕 POS Pizzería — Plan Definitivo de Implementación
### Versión final al 2026-02-27 · Basado en el código real del proyecto

> **Este documento es la referencia única.** Consolida todo lo discutido en los caps 21-26.
> Cada tarea tiene: qué hay que hacer, cuánto tarda, qué tanto cuesta en esfuerzo, y por qué ese orden.

---

## 📊 Estado actual del proyecto (punto de partida)

```
✅ YA EXISTE Y FUNCIONA              ❌ FALTA              ⚠️ EXISTE PERO NECESITA AJUSTE
──────────────────────────────────────────────────────────────────────────
✅ NestJS backend (Puerto 3000)      ❌ Redis              ⚠️ Traefik en docker-compose (eliminar)
✅ PostgreSQL (Docker, 5433)         ❌ Socket.IO           ⚠️ Guards JWT comentados en auth.module.ts
✅ Expo APK (funciona en LAN)        ❌ Ollama              ⚠️ CORS_ORIGINS vacío en docker-compose
✅ Sistema de órdenes completo       ❌ Tauri Desktop       ⚠️ .env.example sin JWT_SECRET ni REDIS_*
✅ Pizza sabores + recargos en DB    ❌ n8n workflow IA
✅ Auth JWT módulo listo             ❌ Evolution QR
✅ LoggingInterceptor                ❌ start-pos.bat
✅ Swagger en /swagger               ❌ WhatsApp handoff
✅ OrderContext (AsyncStorage)       ❌ AuthContext + login.tsx
✅ ToastContext                      ❌ use-ordenes-socket.ts
✅ Sistema de diseño (tokens)        ❌ OrdenesGateway (Socket.IO)
✅ seed-users.ts (admin/cocina/mesero)
✅ seed-productos.ts
✅ seed-menu.sql montado en Docker
```

---

## 🏗️ Arquitectura final (inmutable — no cambiar a mitad del camino)

```
╔══════════════════════════════════════════════════════════════════╗
║         SISTEMA POS — RED LOCAL DEL NEGOCIO (WiFi/LAN)          ║
╠══════════════════════════════════════════════════════════════════╣
║  PC SERVIDOR (siempre encendida — trastienda o cuarto técnico)   ║
║                                                                  ║
║  docker-compose levanta TODO esto:                               ║
║  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  ║
║  │ NestJS :3000 │ │ PG :5432 │ │Redis:6379│ │  Ollama :11434 │  ║
║  │  API + WS    │ │ (interno)│ │ Pub/Sub  │ │  LLM local     │  ║
║  └──────────────┘ └──────────┘ └──────────┘ └────────────────┘  ║
║  ┌──────────────┐ ┌──────────────────────────────────────────┐   ║
║  │  n8n  :5678  │ │  Evolution API  :8080  (ngrok apunta aquí)│  ║
║  │  Automatiz.  │ │  Puente WhatsApp                         │   ║
║  └──────────────┘ └──────────────────────────────────────────┘   ║
╠══════════════════════════════════════════════════════════════════╣
║  PERSONAL DEL NEGOCIO → Se conectan al servidor por WiFi         ║
║  📱 Expo APK      → celulares del personal (cajeros, cocina)     ║
║  🖥️  Tauri .exe   → PC fija de caja (opcional pero recomendado) ║
╠══════════════════════════════════════════════════════════════════╣
║  CLIENTES DEL NEGOCIO → Solo interactúan por WhatsApp            ║
║  🌐 ngrok → mi-pizzeria.ngrok-free.app → :8080 (Evolution)      ║
║  WhatsApp → bot IA (Ollama) → orden automática ó handoff humano  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Reglas de oro que no cambian
1. Los clientes **solo usan WhatsApp**. Nunca acceden a la app
2. El personal usa **APK en celular** o **Tauri en PC fija**
3. **No se necesita dominio comprado** — ngrok gratis es permanente
4. **No se necesita FastAPI** — n8n + Ollama es suficiente para siempre
5. **No se necesita la API oficial de Meta** — Evolution API es gratis y funciona

---

## 📋 Las 8 Fases — Vista general

| # | Fase | Complejidad | Tiempo real | Impacto | Dependencias |
|---|------|:-----------:|:-----------:|:-------:|:-------------|
| **1** | Infraestructura: Redis + docker-compose | 🟡 Media | 4-6 h | 🔴 Crítico | Ninguna |
| **2** | Backend: Socket.IO Gateway + Redis adapter | 🟡 Media | 4-8 h | 🔴 Crítico | Fase 1 |
| **3** | Frontend Expo: Hook WS + tiempo real | 🟢 Baja | 3-5 h | 🔴 Crítico | Fase 2 |
| **4** | Recargos pizza server-side | 🟢 Baja | 2-3 h | 🟡 Importante | Fase 2 |
| **5** | Autenticación JWT activa | 🔴 Alta | 1-2 días | 🟡 Importante | Fases 3+4 |
| **6** | ngrok + script arranque | 🟢 Baja | 2-4 h | 🟡 Importante | Fase 1 |
| **7** | WhatsApp: Evolution + n8n + Ollama | 🔴 Alta | 3-5 días | 🟢 Diferenciador | Fase 6 |
| **8** | Tauri Desktop (PC de caja) | 🟡 Media | 2-3 días | 🟢 Opcional | Fases 2+3 |

**Total estimado: 3-4 semanas de trabajo efectivo (no días corridos)**

> ⚠️ **Expectativa realista:** Los estimados son para alguien que entiende el proyecto.
> Multiplica x1.5 si estás aprendiendo en el proceso. La Fase 7 (WhatsApp+IA) es la
> más incierta porque depende de pruebas reales con el número de WhatsApp.

---

## FASE 1 — Infraestructura: Redis + docker-compose limpio
### ⏱️ Tiempo: 4-6 horas · 🎯 Complejidad: Media · 🔴 CRÍTICO (todo depende de esto)

> **Por qué primero:** Sin Redis no hay Socket.IO multi-instancia. Sin docker-compose
> limpio (sin Traefik) hay confusión en las rutas. Esta fase es el cimiento.

### Lo que cambia

| Archivo | Cambio |
|---|---|
| `docker-compose.yml` | Eliminar Traefik, agregar Redis. Los servicios de WPP (n8n, Evolution, Ollama) se agregan recién en la Fase 7 |
| `.env` / `.env.example` | Agregar variables Redis, JWT, CORS. Las vars de WPP van en Fase 7 |
| `Backend/package.json` | Instalar socket.io, redis, bullmq, throttler |

> ⚠️ **No agregar n8n / Evolution API / Ollama al compose todavía.** Esos servicios pesan varios GB en disco y RAM. Se añaden solo cuando vayas a la Fase 7. El compose de Fases 1–6 solo necesita: `db`, `redis`, `backend`, `frontend`.

### docker-compose.yml definitivo

```yaml
name: pos-pizzeria

services:
  # ── Base de datos ──────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    container_name: pizzeria-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5433:5432"          # Puerto externo diferente para no pisar Postgres local
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./Backend/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
      - ./Backend/seed-menu.sql:/docker-entrypoint-initdb.d/02-seed-menu.sql:ro  # Ya existe — no borrar
    networks: [pizzeria-network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis ──────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: pizzeria-redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    networks: [pizzeria-network]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s; timeout: 5s; retries: 5

  # ── Backend NestJS ─────────────────────────────────────────────
  backend:
    build: { context: ./Backend, dockerfile: Dockerfile }
    container_name: pizzeria-backend
    restart: unless-stopped
    ports:
      - "3000:3000"          # Accesible en toda la LAN
    environment:
      DATABASE_HOST: db
      DATABASE_PORT: 5432
      DATABASE_USER: appuser
      DATABASE_PASSWORD: ${DB_PASSWORD}
      DATABASE_NAME: appdb
      NODE_ENV: production
      PORT: 3000
      HOST: 0.0.0.0
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-28800}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      CORS_ORIGINS: ${CORS_ORIGINS}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks: [pizzeria-network]

  # ── Frontend (Expo Web / Nginx) ────────────────────────────────
  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile
    container_name: pizzeria-frontend
    restart: unless-stopped
    ports:
      - "8081:8081"
    depends_on:
      - backend
    networks: [pizzeria-network]

  # ── FASE 7 — Descomentar cuando vayas a implementar WhatsApp ──
  # n8n:
  #   image: n8nio/n8n:latest
  #   container_name: pizzeria-n8n
  #   ports: ["5678:5678"]
  #   environment:
  #     WEBHOOK_URL: ${N8N_WEBHOOK_URL}
  #     N8N_BASIC_AUTH_ACTIVE: "true"
  #     N8N_BASIC_AUTH_USER: ${N8N_USER:-admin}
  #     N8N_BASIC_AUTH_PASSWORD: ${N8N_PASSWORD}
  #     GENERIC_TIMEZONE: America/Bogota
  #   volumes: [n8n_data:/home/node/.n8n]
  #   networks: [pizzeria-network]
  #
  # evolution-api:
  #   image: atendai/evolution-api:v2.2.3
  #   container_name: pizzeria-evolution
  #   ports: ["8080:8080"]   # ngrok apunta a este puerto
  #   environment:
  #     SERVER_URL: ${EVOLUTION_SERVER_URL}
  #     AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
  #     DATABASE_ENABLED: "true"
  #     DATABASE_PROVIDER: postgresql
  #     DATABASE_CONNECTION_URI: postgresql://appuser:${DB_PASSWORD}@db:5432/evolution
  #   depends_on:
  #     db: { condition: service_healthy }
  #   networks: [pizzeria-network]
  #
  # ollama:
  #   image: ollama/ollama:latest
  #   container_name: pizzeria-ollama
  #   ports: ["11434:11434"]
  #   volumes: [ollama_data:/root/.ollama]
  #   # GPU NVIDIA → agregar bloque deploy.resources.reservations.devices
  #   networks: [pizzeria-network]

networks:
  pizzeria-network:
    driver: bridge

volumes:
  pgdata:
    name: pizzeria-pgdata
  redis_data:
  # n8n_data:      # Descomentar en Fase 7
  # ollama_data:   # Descomentar en Fase 7
```

### Variables de entorno `.env` (Fases 1–6)

Agregar estas líneas al archivo `.env` en la raíz del proyecto (no al `Backend/.env`):

```env
# ── Postgres ─────────────────────────────────────────────────
DB_PASSWORD=apppass     # Cambiar en producción

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET=cambia-esto-por-minimo-32-caracteres-aleatorios
JWT_EXPIRES_IN=28800    # 8 horas en segundos

# ── CORS (ajustar con la IP real del servidor en LAN) ────────
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,tauri://localhost
# Ejemplo LAN: CORS_ORIGINS=http://192.168.1.10:8081,http://localhost:8081
```

> Las variables de n8n, Evolution API y Ollama se agregan en la **Fase 7**.

### Instalar dependencias del Backend

```bash
cd Backend

# Socket.IO
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Redis (ioredis v5+ incluye sus propios @types — no instalar @types/ioredis por separado)
npm install @socket.io/redis-adapter ioredis

# Rate limiting
npm install @nestjs/throttler

# Queues (para tareas async: recibos, notificaciones)
npm install @nestjs/bullmq bullmq
```

### Instalar dependencias del Frontend

```bash
cd Frontend

# socket.io-client — fijar versión 4.x para compatibilidad con Expo/React Native
npm install socket.io-client@4
```

> ⚠️ **Expo + socket.io-client:** siempre usar `transports: ['websocket']` al crear
> el socket (no `polling`). El polling usa `XMLHttpRequest` que puede fallar en RN.

### El modelo Ollama se descarga en la Fase 7, no aquí.

### Verificación Fase 1 ✅

```bash
docker-compose ps                           # db, redis, backend, frontend: Up (healthy)
docker exec pizzeria-redis redis-cli ping   # → PONG
curl http://localhost:3000/ordenes/dia      # → JSON de órdenes (backend vivo)
open http://localhost:8081                  # → App Expo carga (frontend vivo)
```

---

## FASE 2 — Backend: Socket.IO Gateway + Redis Adapter
### ⏱️ Tiempo: 4-8 horas · 🎯 Complejidad: Media · 🔴 CRÍTICO

> **Por qué:** Sin esto los dispositivos no reciben eventos en tiempo real.
> El Gateway ya está diseñado en la Fase 2 del cap 26 — es copiar y conectar.

### Archivos a crear/modificar

| Archivo | Acción | Dificultad |
|---|---|:-:|
| `Backend/src/common/redis/redis.module.ts` | Crear | 🟢 Fácil |
| `Backend/src/main.ts` | Modificar (Redis adapter) | 🟡 Media |
| `Backend/src/ordenes/ordenes.gateway.ts` | Crear | 🟡 Media |
| `Backend/src/ordenes/ordenes.module.ts` | Modificar | 🟢 Fácil |
| `Backend/src/ordenes/ordenes.service.ts` | Modificar (inyectar gateway) | 🟡 Media |
| `Backend/src/app.module.ts` | Modificar (Redis, Throttler, BullMQ) | 🟡 Media |
| `Backend/src/whatsapp/whatsapp.controller.ts` | Crear (handoff endpoint) | 🟢 Fácil |

### Eventos WebSocket del sistema

```
Servidor → Clientes (broadcast):
  orden:nueva          → Todos los dispositivos (nueva orden creada)
  orden:actualizada    → Todos (cambio de estado)
  whatsapp:handoff     → Personal (cliente WPP necesita atención humana)
  cocina:nueva-orden   → Solo room 'cocina' (vista simplificada para cocineros)

Rooms por dispositivo (el cliente se une al conectar):
  auth: { dispositivo: 'cajero' | 'cocina' | 'admin' | 'repartidor' }
```

### Verificación Fase 2 ✅

```bash
# Instalar wscat (cliente WebSocket de terminal)
npm install -g wscat

# Conectar al gateway
wscat -c "ws://localhost:3000/ordenes" --subprotocol '{"dispositivo":"cajero"}'

# En otra terminal: crear una orden
curl -X POST http://localhost:3000/ordenes -H "Content-Type: application/json" \
  -d '{"tipoPedido":"local","metodoPago":"efectivo","productos":[...]}'

# → En wscat debe aparecer: { "event": "orden:nueva", "data": {...} }
```

---

## FASE 3 — Frontend Expo: WebSocket en tiempo real
### ⏱️ Tiempo: 3-5 horas · 🎯 Complejidad: Baja · 🔴 CRÍTICO

> **Por qué:** La app ya funciona con polling manual. Esto la hace reactiva.
> El hook `useOrdenesSocket` ya está diseñado — es integrarlo en `OrdersOfDayPending`.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `Frontend/hooks/use-ordenes-socket.ts` | Crear |
| `Frontend/components/orders/OrdersOfDayPending.tsx` | Modificar (agregar hook) |

### Comportamiento esperado después de esta fase

- Cajero crea orden → **sin refrescar**, todos los dispositivos la ven
- Cocina marca "listo" → el estado cambia en tiempo real en la pantalla del cajero
- Punto verde/rojo en la app indica si el WebSocket está activo o no

### Verificación Fase 3 ✅

```
1. Abrir la app en 2 celulares/navegadores en la misma red
2. Crear una orden desde el Cajero (Celular A)
3. El Celular B debe mostrar la nueva orden SIN tocar refrescar
4. Indicador de conexión WS debe estar verde en ambos
```

---

## FASE 4 — Recargos pizza server-side
### ⏱️ Tiempo: 2-3 horas · 🎯 Complejidad: Baja · 🟡 IMPORTANTE

> **Por qué:** Hoy los recargos se calculan en el frontend (no confiable).
> El backend tiene la tabla `PizzaSabores` con los recargos pero no los aplica al crear orden.
> **No bloquea nada más** — se puede hacer en cualquier momento después de la Fase 2.

### Lo que cambia

- `Backend/src/pizza-sabores/pizza-sabores.module.ts` → exportar `PizzaSaboresService`
- `Backend/src/ordenes/ordenes.module.ts` → importar `PizzaSaboresModule`
- `Backend/src/ordenes/ordenes.service.ts` → inyectar servicio + método `calcularRecargoSabores()`

> Los campos de recargo en la entidad se llaman `recargoPequena`, `recargoMediana`, `recargoGrande`
> (revisar `Backend/src/pizza-sabores/esquemas/pizza-sabores.entity.ts` para los nombres exactos).

### Verificación Fase 4 ✅

```bash
# Crear orden con sabor Quesuda talla mediana (recargo +$3.000)
curl -X POST http://localhost:3000/ordenes \
  -H "Content-Type: application/json" \
  -d '{"tipoPedido":"local","productos":[{"sabor1":"quesuda","tamano":"mediana",...}]}'
# El campo "total" en la respuesta debe incluir el recargo
```

---

## FASE 5 — Autenticación JWT activa
### ⏱️ Tiempo: 1-2 días · 🎯 Complejidad: Alta · 🟡 IMPORTANTE

> **Por qué es alta complejidad:** Activar los Guards afecta TODOS los endpoints.
> Hay que asegurarse de que todos los públicos tengan `@Public()` antes de activar.
> **No hacer esto hasta que las Fases 1-4 estén funcionando y probadas.**

### Pasos (en orden — no saltarse ninguno)

```
1. Revisar TODOS los controllers y marcar con @Public() los que
   deben ser accesibles sin login:
   - OrdenesController (ya tiene @Public() en clase — verificar)
   - ProductosController.findAll()
   - PizzaSaboresController.findAll()
   - WhatsappController.handoff() (n8n llama a este sin token)

2. Descomentar guards en Backend/src/auth/auth.module.ts líneas 33-34:
   { provide: APP_GUARD, useClass: JwtAuthGuard }
   { provide: APP_GUARD, useClass: RolesGuard }

3. Crear Frontend/contexts/AuthContext.tsx
   Crear Frontend/app/login.tsx

4. Actualizar Frontend/app/_layout.tsx para envolver en <AuthProvider>

5. PROBAR: intentar llamar a un endpoint sin token → 401
             con token válido → respuesta normal
```

> 💡 **Usuarios de prueba ya existen** — `seed-users.ts` en `Backend/src/common/seeders/`
> crea al iniciar: `admin / Admin123!`, `cocina / Cocina123!`, `mesero / Mesero123!`
> Ejecutar `npm run seed:users` si la tabla `users` está vacía.

### Expectativa realista

La parte más probable de fallar es olvidar un endpoint con `@Public()` y que
algo deje de funcionar. **Tener wscat y Postman listos para diagnosticar.**

### Verificación Fase 5 ✅

```
□ Login con credenciales incorrectas → 401 Unauthorized
□ Login correcto → access_token en la respuesta
□ GET /ordenes sin token → 401
□ GET /ordenes con token → array de órdenes
□ GET /productos sin token → 200 (es público)
□ La app Expo redirige a login cuando no hay sesión
□ La app redirige a login si el token expira (8 horas)
```

---

## FASE 6 — ngrok + Script de arranque
### ⏱️ Tiempo: 2-4 horas · 🎯 Complejidad: Baja · 🟡 IMPORTANTE

> Solo se necesita para el WhatsApp. Se puede hacer en paralelo con la Fase 5.

### Pasos

```bash
# 1. Crear cuenta en ngrok.com (gratis)
# 2. Instalar
choco install ngrok

# 3. Autenticar
ngrok config add-authtoken TU_TOKEN_DE_NGROK

# 4. Crear dominio estático en: dashboard.ngrok.com/domains
#    → Ejemplo resultado: mi-pizzeria.ngrok-free.app
#    → Este dominio es TUYO para siempre mientras tengas la cuenta activa

# 5. Probar
ngrok http --domain=mi-pizzeria.ngrok-free.app 8080
# En otra terminal: curl https://mi-pizzeria.ngrok-free.app
# → Debe responder como el backend (Evolution API en :8080)
```

### `start-pos.bat` — Script de arranque Windows

```batch
@echo off
title POS Pizzería
color 0A
echo ╔══════════════════════════════╗
echo ║   POS PIZZERÍA — INICIANDO   ║
echo ╚══════════════════════════════╝
echo.
echo [1/3] Iniciando Docker...
docker-compose up -d
if %errorlevel% neq 0 (
  echo ERROR: ¿Está Docker Desktop abierto?
  pause & exit /b 1
)
echo [2/3] Esperando servicios (20 seg)...
timeout /t 20 /nobreak >nul
echo [3/3] Iniciando ngrok (WhatsApp)...
start "ngrok" /min ngrok http --domain=mi-pizzeria.ngrok-free.app 8080
echo.
echo ═══════════════════════════════════════════
echo   SISTEMA LISTO ✓
echo   Backend:   http://localhost:3000
echo   n8n:       http://localhost:5678
echo   Evolution: http://localhost:8080
echo   Swagger:   http://localhost:3000/swagger
echo   Ollama:    http://localhost:11434
echo   WPP:       https://mi-pizzeria.ngrok-free.app
echo   LAN:       http://192.168.1.X:3000
echo ═══════════════════════════════════════════
pause
```

---

## FASE 7 — WhatsApp: Evolution API + n8n + Ollama
### ⏱️ Tiempo: 3-5 días · 🎯 Complejidad: Alta · 🟢 DIFERENCIADOR

> Esta es la fase más compleja y la que más tiempo toma **en la práctica**.
> Los estimados incluyen el tiempo de pruebas reales con el número de WhatsApp.

### ¿Qué es Evolution API? (resumen)

```
Tu número de WhatsApp  →  [Evolution API Docker :8080]
                                    ↓ Webhook POST
                               [n8n :5678]
                                    ↓ HTTP Request
                          [Ollama :11434 / LLM local]
                                    ↓ JSON estructurado
                         [NestJS :3000 / crear orden]
                                    ↓ Socket.IO
                       [APK/Tauri — aparece al instante]
```

Evolution API actúa como "WhatsApp Web en código": vinculas tu número
escaneando un QR (una sola vez) y desde ahí puede recibir y enviar mensajes.

> ⚠️ No es la API oficial de Meta. Para un negocio pequeño el riesgo es mínimo.
> Si el volumen escala mucho (>500 mensajes/día), evaluar la API oficial de Meta.

### 7A — Setup Evolution API (una sola vez)

```bash
# 1. Con docker-compose up corriendo, crear instancia
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: TU_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "pizzeria-bot", "integration": "WHATSAPP-BAILEYS"}'

# 2. Abrir http://localhost:8080 en el navegador
#    → Ir a la instancia → conectar → escanear QR con WhatsApp del negocio

# 3. Verificar conexión
curl http://localhost:8080/instance/connectionState/pizzeria-bot \
  -H "apikey: TU_EVOLUTION_API_KEY"
# → { "state": "open" } ✅

# 4. Registrar webhook → n8n (red Docker interna, sin ngrok)
curl -X POST http://localhost:8080/webhook/set/pizzeria-bot \
  -H "apikey: TU_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://n8n:5678/webhook/pizzeria-bot",
    "events": ["MESSAGES_UPSERT"]
  }'
```

### 7B — Workflow n8n (5 nodos + lógica IA + handoff)

```
Flujo completo:

Nodo 1: Webhook (POST /pizzeria-bot)
   ↓
Nodo 2: IF → fromMe == false AND mensaje no vacío
   ↓ (TRUE)
Nodo 3A: HTTP Request → POST http://ollama:11434/api/chat
   modelo: llama3.2:3b · temperature: 0.1 · stream: false
   system: [prompt del menú con esquema JSON]
   user: {{ $json.data.message.conversation }}
   ↓
Nodo 3B: Code → parsear JSON de Ollama → CreateOrdenesDto
   ├── JSON válido + pedido claro → { orden, confirmacion }
   └── Error / no entendido    → { handoff: true, mensajeCliente, alertaPersonal }
   ↓
Nodo 3C: IF → ¿handoff == true?
   ├── TRUE → Nodo 3D: POST http://backend:3000/whatsapp/handoff
   │         → Nodo 3E: sendText WPP (mensajeCliente)
   └── FALSE → Nodo 4: POST http://backend:3000/ordenes
              → Nodo 5: sendText WPP (confirmacion con total)
```

### 7C — Modelo de IA local: Ollama

#### ¿Por qué Ollama en lugar de OpenAI?

| | Ollama (local) | OpenAI |
|---|---|---|
| Costo | **Gratis** | ~$0.001 por pedido |
| Privacidad | Los mensajes no salen de la máquina | Se envían a servidores externos |
| Internet | Solo ngrok lo necesita | Depende de internet para cada pedido |
| Filtros | Ninguno | Puede rechazar contenido |
| Velocidad | 1-3 seg en CPU | <1 seg pero depende de red |

#### Modelos recomendados

| Modelo | RAM necesaria | Para cuándo |
|---|---|---|
| `llama3.2:1b` | ~1.5 GB | PC muy limitada (solo 4 GB RAM total) |
| **`llama3.2:3b`** ✅ | ~3 GB | **Recomendado — balance ideal** |
| `qwen2.5:7b` | ~6 GB | PC con 16 GB RAM, mejor comprensión |

#### Prompt del sistema para el bot

```
Eres el asistente de una pizzería. Tu única función es extraer información
de pedidos de WhatsApp y devolver JSON válido. NUNCA respondas en texto libre.
Siempre responde SOLO con el JSON, sin explicaciones ni markdown.

MENÚ DISPONIBLE:
- Pizzas: pequeña ($18.000), mediana ($25.000), grande ($35.000)
  Sabores: hawaiana, pepperoni, quesuda (+$3.000), vegetariana, bbq, napolitana
- Bebidas: gaseosa 1.5L ($5.000), agua ($2.000)
- Combos: combo familiar (pizza grande + gaseosa: $38.000)

Esquema OBLIGATORIO:
{
  "tipoPedido": "local" | "domicilio",
  "productos": [{ "nombre": "...", "tamano": "pequeña|mediana|grande|null",
                  "sabor": "...|null", "cantidad": N, "notas": "...|null" }],
  "direccion": "...|null",
  "metodoPago": "efectivo|transferencia",
  "confianza": 0.0-1.0
}

Si no puedes entender el pedido, devuelve: { "error": "descripción" }
```

### 7D — Handoff a humano real

Cuando Ollama no entiende el pedido:

```
📱 Cliente: "un lombriz con extra queso"   ← pedido incomprensible
         ↓
  Ollama devuelve: { "error": "producto no reconocido" }
         ↓
📱 Cliente recibe:
   "👋 Hola! Tu pedido requiere atención personalizada.
    Un asesor te escribe en seguida 😊 Gracias por tu paciencia!"
         ↓
🔔 Alerta en app del personal (Socket.IO evento 'whatsapp:handoff'):
   "📱 Juan (WPP) necesita atención: 'un lombriz con extra queso'"
         ↓
👨‍💼 El cajero/admin responde desde su WhatsApp directamente
```

**¿Por qué es mejor que un fallback con orden vacía?**
- El cliente sabe que un humano lo atiende → mejor experiencia
- El personal tiene el mensaje original → contexto completo
- No se crean órdenes basura en la base de datos

> 📄 **Código completo del workflow, nodo Code y endpoint NestJS:**
> `26-plan-refinado-final/REfinadoplan.md` — Fases 7D y 7F

### Verificación Fase 7 ✅

```
□ docker exec pizzeria-ollama ollama list  → ve llama3.2:3b
□ curl http://localhost:11434/api/tags     → JSON con modelos
□ Enviar "pizza local" al número          → respuesta automática del bot
□ Enviar "una lombriz" al número          → handoff (alerta en app del personal)
□ Enviar "pizza grande pepperoni domicilio calle 15" → confirmación con precio y tiempo
□ Orden aparece en APK/Tauri sin refrescar
```

---

## FASE 8 — Tauri Desktop (PC de caja)
### ⏱️ Tiempo: 2-3 días · 🎯 Complejidad: Media · 🟢 OPCIONAL pero recomendado

> **¿Por qué Tauri y no solo abrir Chrome?**
> - Autoarranque con Windows (no hay que abrir el browser manualmente)
> - Sin barra de URL visible (modo kiosko profesional)
> - Notificaciones nativas de Windows (toast cuando llega una orden)
> - Preparado para integrar impresora térmica ESC/POS en el futuro
> - El instalador pesa ~5 MB vs ~150 MB de Electron

### Crear el proyecto

```bash
# En la raíz del MonoRepo (junto a Backend/ y Frontend/)
mkdir Desktop && cd Desktop
npm create tauri-app@latest . -- --template react-ts --identifier com.pizzeria.pos --manager npm
npm install
npm install socket.io-client axios
npm install @tauri-apps/plugin-notification @tauri-apps/plugin-store
```

### Comandos Rust clave (`Desktop/src-tauri/src/lib.rs`)

| Comando | Qué hace |
|---|---|
| `get_config()` | Devuelve la URL del backend (configurable) |
| `imprimir_recibo(orden_id, total)` | Stub → futuro: ESC/POS por USB |
| `notificar_nueva_orden(orden_id, tipo)` | Toast de Windows al llegar orden |

### Integración con el mismo WebSocket

El frontend de Tauri conecta al **mismo gateway de la Fase 2** que el APK:

```typescript
// Desktop/src/App.tsx
const socket = io(`${apiUrl}/ordenes`, {
  auth: { dispositivo: 'cajero' },
  transports: ['websocket'],
});

socket.on('orden:nueva', async (orden) => {
  // Notificación de Windows
  await invoke('notificar_nueva_orden', { ordenId: orden.ordenId, tipo: orden.tipoPedido });
});

socket.on('whatsapp:handoff', (data) => {
  // Alerta de atención requerida
  setAlertas(prev => [data, ...prev]);
});
```

### Compilar e instalar

```bash
npm run tauri build
# Genera: Desktop/src-tauri/target/release/bundle/
#   → nsis/POS-Pizzeria_1.0.0_x64-setup.exe   (~5 MB)
#   → msi/POS-Pizzeria_1.0.0_x64.msi
# Instalar con doble click en la PC de caja
```

> 📄 **Código completo:** `26-plan-refinado-final/REfinadoplan.md` — Fases 8A al 8F

### Verificación Fase 8 ✅

```
□ npm run tauri dev → ventana nativa se abre
□ Indicador verde de conexión WS
□ Crear orden desde APK → aparece en Tauri sin refrescar
□ Crear orden desde APK → Windows toast aparece en PC de caja
□ npm run tauri build → genera el .exe
□ Instalar .exe en la PC de caja → funciona
```

---

## 🗓️ Cronograma de implementación

```
SEMANA 1 — La base (sin esto nada funciona)
  Día 1-2: FASE 1 — docker-compose + Redis + Ollama setup
            Descargar modelo llama3.2:3b
            Verificar todos los servicios saludables
  Día 3-4: FASE 2 — Socket.IO Gateway + Redis adapter en NestJS
            Verificar con wscat que llegan los eventos
  Día 5:   FASE 3 — Hook useOrdenesSocket en Expo
            Verificar tiempo real en 2 dispositivos

SEMANA 2 — Completar el núcleo
  Día 1:   FASE 4 — Recargos pizza server-side
  Día 2-5: FASE 5 — Auth JWT activa (la más delicada)
            Tiempo extra reservado para debugging de guardas

SEMANA 3 — Integración WhatsApp
  Día 1:   FASE 6 — ngrok + start-pos.bat
  Día 2-3: FASE 7A-B — Evolution API setup + QR WhatsApp
  Día 4-5: FASE 7C-D — n8n workflow básico (sin Ollama primero)
            Test básico: mensaje WPP → orden en APK

SEMANA 4 — IA + pulir detalles
  Día 1-2: FASE 7F — Reemplazar nodo simple por Ollama IA
            Test: pedidos complejos con productos extraídos
  Día 3-4: FASE 8 — Tauri Desktop
  Día 5:   Tests end-to-end + ajustes finales
```

> ⚠️ **Expectativa realista:** Si estás aprendiendo alguna de estas tecnologías
> en el proceso (especialmente Socket.IO o Tauri), multiplica x1.5 el estimado.
> La semana 3 (WhatsApp) puede extenderse si hay problemas con el QR o ngrok.

---

## FASE 7G — Validador de productos contra la DB (FastAPI)
### ⏱️ Tiempo: 1 día · 🎯 Complejidad: Media · 🟢 OPCIONAL pero recomendado

> **El problema real:** Ollama devuelve `"pepperoni"` pero en tu DB el sabor se llama
> `"Pepperoni clásica"` con id `"abc-123"`. Sin validación, el backend rechaza la orden
> o la crea con productos inválidos. Este servicio cierra esa brecha.

### FastAPI vs Rust para este caso

| Criterio | FastAPI (Python) | Rust (Axum/Actix) |
|---|---|---|
| **Velocidad de desarrollo** | 🟢 1 día | 🔴 3-5 días |
| **Librerías disponibles** | 🟢 httpx, fuzz, Pydantic | 🟡 reqwest, strsim (menos ecosistema) |
| **Fuzzy matching** | 🟢 `thefuzz` (Python) — maduro | 🟡 `strsim` — existe pero más manual |
| **Rendimiento** | 🟡 Suficiente (2-5ms por pedido) | 🟢 Mejor, pero irrelevante para este caso |
| **Integración con Ollama** | 🟢 Fácil (httpx async) | 🟡 Más verboso |
| **Mantenibilidad** | 🟢 Más fácil de modificar el prompt/lógica | 🟡 Compilar en cada cambio |
| **Tamaño del contenedor** | 🟡 ~200 MB (Python) | 🟢 ~10 MB (Rust binário) |

> **Recomendación: FastAPI** para este caso. La tarea es lógica de negocio con
> llamadas HTTP a la DB — no necesitas la velocidad de Rust. Usa Rust cuando
> la tarea requiera concurrencia masiva o acceso de bajo nivel al sistema.
>
> Si quieres aprender Rust: impleméntalo en Axum **después** de tener el
> FastAPI funcionando. La API del servicio será idéntica — solo cambias el container.

### Flujo con el validador

```
📨 Mensaje WhatsApp: "2 pizzas grandes pepperoni y una hawaiana a domicilio"
         ↓
🤖 Ollama parsea → JSON crudo:
   { productos: [ {nombre:"pizza", tamano:"grande", sabor:"pepperoni", cantidad:2},
                  {nombre:"pizza", tamano:"grande", sabor:"hawaiana", cantidad:1} ],
     tipoPedido:"domicilio", direccion:"..." }
         ↓
🔍 FastAPI ai-validator (NUEVO):
   1. GET http://backend:3000/productos      → catálogo real de la DB
   2. GET http://backend:3000/pizza-sabores  → sabores reales de la DB
   3. Fuzzy match "pepperoni" → "Pepperoni clásica" (id: abc-123, recargo: 3000)
   4. Fuzzy match "hawaiana"  → "Hawaiana" (id: def-456, recargo: 0)
   5. Si confianza < 80% → handoff
         ↓
✅ DTO validado con IDs reales de la DB:
   { productos: [ { productoId:"xyz", saborId:"abc-123", cantidad:2, precioUnitario:38000 },
                  { productoId:"xyz", saborId:"def-456", cantidad:1, precioUnitario:35000 } ],
     total: 111000 }
         ↓
🌐 POST http://backend:3000/ordenes → orden creada con datos 100% correctos
```

### Crea la carpeta `ai-validator/`

```
ai-validator/
├── main.py
├── requirements.txt
└── Dockerfile
```

### `ai-validator/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
thefuzz==0.22.1    # Para fuzzy matching de nombres
python-levenshtein==0.25.1  # Acelera thefuzz
pydantic==2.7.0
```

### `ai-validator/main.py` — el servicio completo

```python
"""
ai-validator — Valida productos de Ollama contra la base de datos real.
Flujo: n8n llama este servicio con el JSON crudo de Ollama.
       Se devuelve el DTO validado listo para POST /ordenes.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import os
from thefuzz import process as fuzz_process

app = FastAPI(title="AI Validator", version="1.0.0")

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:3000")
FUZZY_THRESHOLD = int(os.getenv("FUZZY_THRESHOLD", "75"))  # Confianza mínima %

# ── Cache de catálogo (se recarga en startup y cada hora) ──────────────
catalogo_cache: dict = {"productos": [], "sabores": [], "updated_at": 0}


async def cargar_catalogo():
    """Descarga productos y sabores del backend. Se llama al iniciar."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r_prod = await client.get(f"{BACKEND_URL}/productos")
            r_sab  = await client.get(f"{BACKEND_URL}/pizza-sabores")
            catalogo_cache["productos"] = r_prod.json()
            catalogo_cache["sabores"]   = r_sab.json()
            import time
            catalogo_cache["updated_at"] = time.time()
            print(f"✅ Catálogo: {len(catalogo_cache['productos'])} productos, "
                  f"{len(catalogo_cache['sabores'])} sabores")
        except Exception as e:
            print(f"⚠️ Catálogo no disponible al iniciar: {e}")


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await cargar_catalogo()   # Al iniciar Docker
    yield

app = FastAPI(title="AI Validator", version="1.0.0", lifespan=lifespan)


# ── Modelos de entrada/salida ──────────────────────────────────────────
class ProductoRaw(BaseModel):
    nombre: str                    # Lo que dijo Ollama: "pizza", "pizzita"
    tamano: Optional[str] = None   # "grande", "mediana", "pequeña"
    sabor: Optional[str] = None    # "pepperoni", "hawaiana"
    cantidad: int = 1
    notas: Optional[str] = None

class OrdenRaw(BaseModel):
    tipoPedido: str = "local"        # "local" | "domicilio"
    productos: list[ProductoRaw]
    direccion: Optional[str] = None
    metodoPago: str = "efectivo"
    nombreCliente: str = "Cliente"
    telefono: str = ""
    mensajeOriginal: str = ""

class ProductoValidado(BaseModel):
    productoId: str
    nombreProducto: str
    saborId: Optional[str] = None
    nombreSabor: Optional[str] = None
    tamano: Optional[str] = None
    cantidad: int
    precioUnitario: float
    notas: Optional[str] = None
    confianza: float              # 0.0-1.0 (qué tan seguro está del match)

class OrdenValidada(BaseModel):
    tipoPedido: str
    productos: list[ProductoValidado]
    direccion: Optional[str]
    metodoPago: str
    nombreCliente: str
    telefono: str
    total: float
    confianzaPromedio: float
    handoffRequerido: bool        # True si algún producto no se reconoció
    razonHandoff: Optional[str] = None


# ── Lógica de matching ─────────────────────────────────────────────────
def normalizar(texto: str) -> str:
    """Quita tildes, pasa a minúscula, elimina espacios extra."""
    import unicodedata
    return unicodedata.normalize('NFD', texto.lower().strip()) \
        .encode('ascii', 'ignore').decode('ascii')

def buscar_producto(nombre_raw: str) -> tuple[dict | None, float]:
    """Fuzzy match del nombre contra la lista de productos."""
    productos = catalogo_cache["productos"]
    if not productos:
        return None, 0.0

    # Extraer nombres normalizados de los productos
    nombres = {p["id"]: normalizar(p.get("nombre", "")) for p in productos}
    nombre_buscado = normalizar(nombre_raw)

    # Buscar el más cercano
    resultado = fuzz_process.extractOne(
        nombre_buscado,
        nombres,
        score_cutoff=FUZZY_THRESHOLD
    )
    if not resultado:
        return None, 0.0

    id_encontrado = resultado[2]   # thefuzz devuelve (valor, score, key)
    score = resultado[1] / 100.0   # 0.0 - 1.0
    prod = next((p for p in productos if p["id"] == id_encontrado), None)
    return prod, score

def buscar_sabor(sabor_raw: str) -> tuple[dict | None, float]:
    """Fuzzy match del sabor contra pizza_sabores."""
    sabores = catalogo_cache["sabores"]
    if not sabores or not sabor_raw:
        return None, 1.0  # Si no hay sabor en el pedido, no es error

    nombres = {s["id"]: normalizar(s.get("nombre", "")) for s in sabores}
    nombre_buscado = normalizar(sabor_raw)

    resultado = fuzz_process.extractOne(
        nombre_buscado,
        nombres,
        score_cutoff=60  # Más permisivo para sabores ("pepperoni" vs "Pepperoni clásica")
    )
    if not resultado:
        return None, 0.0

    id_encontrado = resultado[2]
    score = resultado[1] / 100.0
    sabor = next((s for s in sabores if s["id"] == id_encontrado), None)
    return sabor, score

def calcular_precio(producto: dict, sabor: dict | None, tamano: str | None) -> float:
    """Calcula precio base + recargo de sabor según tamaño."""
    # Tu DB tiene precio base en `producto` y recargo en `pizza_sabor`
    precios_tamano = {
        "pequeña": producto.get("precioBase", 18000),
        "mediana": producto.get("precioMediana", 25000),
        "grande": producto.get("precioGrande", 35000),
    }
    tamano_norm = normalizar(tamano or "grande")
    precio_base = precios_tamano.get(tamano_norm, producto.get("precio", 0))
    recargo = 0.0
    if sabor:
        # PizzaSabor tiene los recargos por tamaño en tu DB
        recargo_key = f"recargo{tamano_norm.capitalize()}"
        recargo = sabor.get(recargo_key, sabor.get("recargoPrecio", 0))
    return float(precio_base) + float(recargo)


# ── Endpoints ──────────────────────────────────────────────────────────
@app.post("/validar-orden", response_model=OrdenValidada)
async def validar_orden(orden: OrdenRaw):
    """
    Recibe el JSON crudo de Ollama y devuelve un DTO validado con IDs reales de la DB.
    Si algún producto no se reconoce, activa handoffRequerido = True.
    """
    # Recargar catálogo si tiene más de 1 hora
    import time
    if time.time() - catalogo_cache["updated_at"] > 3600:
        await cargar_catalogo()

    productos_validados = []
    confianzas = []
    errores = []

    for item in orden.productos:
        # 1. Buscar producto base
        prod, score_prod = buscar_producto(item.nombre)
        if not prod:
            errores.append(f"No encontré '{item.nombre}' en el menú")
            confianzas.append(0.0)
            continue

        # 2. Buscar sabor (si aplica)
        sabor_obj, score_sabor = None, 1.0
        if item.sabor:
            sabor_obj, score_sabor = buscar_sabor(item.sabor)
            if not sabor_obj:
                errores.append(f"Sabor '{item.sabor}' no está en el menú")
                score_sabor = 0.0

        # 3. Calcular precio real
        precio = calcular_precio(prod, sabor_obj, item.tamano)
        confianza_item = (score_prod + score_sabor) / 2
        confianzas.append(confianza_item)

        productos_validados.append(ProductoValidado(
            productoId=prod["id"],
            nombreProducto=prod["nombre"],
            saborId=sabor_obj["id"] if sabor_obj else None,
            nombreSabor=sabor_obj["nombre"] if sabor_obj else None,
            tamano=item.tamano,
            cantidad=item.cantidad,
            precioUnitario=precio,
            notas=item.notas,
            confianza=confianza_item,
        ))

    total = sum(p.precioUnitario * p.cantidad for p in productos_validados)
    confianza_promedio = sum(confianzas) / len(confianzas) if confianzas else 0.0
    handoff = confianza_promedio < (FUZZY_THRESHOLD / 100) or bool(errores)

    return OrdenValidada(
        tipoPedido=orden.tipoPedido,
        productos=productos_validados,
        direccion=orden.direccion,
        metodoPago=orden.metodoPago,
        nombreCliente=orden.nombreCliente,
        telefono=orden.telefono,
        total=total,
        confianzaPromedio=confianza_promedio,
        handoffRequerido=handoff,
        razonHandoff=" | ".join(errores) if errores else None,
    )


@app.post("/recargar-catalogo")
async def recargar_catalogo():
    """Forzar recarga del catálogo desde el backend (llama cuando agregues productos)."""
    await cargar_catalogo()
    return {
        "productos": len(catalogo_cache["productos"]),
        "sabores": len(catalogo_cache["sabores"]),
    }


@app.get("/salud")
async def salud():
    return {
        "estado": "ok",
        "productos_en_cache": len(catalogo_cache["productos"]),
        "sabores_en_cache": len(catalogo_cache["sabores"]),
        "fuzzy_threshold": FUZZY_THRESHOLD,
    }
```

### `ai-validator/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]
```

### Agregar al `docker-compose.yml`

```yaml
  # ── AI Validator (FastAPI) ──────────────────────────────────────
  ai-validator:
    build:
      context: ./ai-validator
      dockerfile: Dockerfile
    container_name: pizzeria-ai-validator
    restart: unless-stopped
    ports:
      - "8090:8090"
    environment:
      BACKEND_URL: http://backend:3000
      FUZZY_THRESHOLD: "75"          # 0-100. Bájalo si hay muchos handoffs falsos
    depends_on:
      - backend
      - ollama
    networks:
      - pizzeria-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/salud"]
      interval: 30s; timeout: 10s; retries: 3
```

### Actualizar el Nodo n8n (reemplazar Nodo 4 actual)

```
Antes (sin validador):
  Nodo 3B (Code) → Nodo 4 (POST /ordenes directo)

Ahora (con validador):
  Nodo 3B (Code) → Nodo 3.5 (HTTP Request ai-validator) → Nodo 3C (IF handoff)
                           ↓                                 ↓
                   URL: http://ai-validator:8090/validar-orden  SÍ → Handoff
                   Body: $json.ordenRaw                         NO → Nodo 4 (POST /ordenes)
```

**Nodo 3.5 — HTTP Request al validador:**

```json
{
  "method": "POST",
  "url": "http://ai-validator:8090/validar-orden",
  "body": {
    "tipoPedido": "{{ $json.orden.tipoPedido }}",
    "productos": "{{ $json.orden.productos }}",
    "direccion": "{{ $json.orden.domicilioDestino }}",
    "metodoPago": "{{ $json.orden.metodoPago }}",
    "nombreCliente": "{{ $json.orden.nombreCliente }}",
    "telefono": "{{ $json.orden.telefonoCliente }}",
    "mensajeOriginal": "{{ $json.orden.observaciones }}"
  }
}
```

**Nodo 3C — IF:** `{{ $json.handoffRequerido }}` == `true`
- Rama SI → handoff al personal (como antes)
- Rama NO → Nodo 4: `POST http://backend:3000/ordenes` con el DTO validado

### ¿Y Rust? — Cómo hacerlo cuando quieras aprender

Si en el futuro quieres reemplazar el FastAPI por Rust (para aprender Axum):

```toml
# ai-validator-rust/Cargo.toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
strsim = "0.11"     # Equivalente a thefuzz
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```rust
// La lógica es idéntica, la API HTTP también.
// Axum expone POST /validar-orden, GET /salud, POST /recargar-catalogo
// strsim::jaro_winkler() reemplaza thefuzz
// reqwest hace las llamadas al backend
//
// Ventaja real: el binário pesa ~5 MB vs ~200 MB (Python + deps)
// Usar como ejercicio de aprendizaje Rust, NO porque sea necesario
```

> 💡 **La API del servicio es idéntica en FastAPI y Rust.**
> n8n llama `http://ai-validator:8090/validar-orden` en los dos casos.
> Puedes hacer ambas versiones y simplemente cambiar el container en docker-compose.

### Verificación Fase 7G ✅

```bash
# 1. El validador levantó bien
curl http://localhost:8090/salud
# → { "estado": "ok", "productos_en_cache": 8, "sabores_en_cache": 6, ... }

# 2. Probar matching manualmente
curl -X POST http://localhost:8090/validar-orden \
  -H "Content-Type: application/json" \
  -d '{
    "tipoPedido": "domicilio",
    "productos": [
      {"nombre": "pizza", "tamano": "grande", "sabor": "pepperoni", "cantidad": 2},
      {"nombre": "pizzita", "tamano": "mediana", "sabor": "hawaiana", "cantidad": 1}
    ],
    "direccion": "Calle 15 #4-20",
    "metodoPago": "efectivo",
    "nombreCliente": "Juan",
    "telefono": "3001234567"
  }'
# → handoffRequerido: false
# → productos con IDs reales de la DB y precios correctos

# 3. Probar handoff (producto desconocido)
curl -X POST http://localhost:8090/validar-orden \
  -d '{"productos": [{"nombre": "lombriz", "cantidad": 1}], ...}'
# → handoffRequerido: true, razonHandoff: "No encontré 'lombriz' en el menú"
```

> 💡 **Tip de FUZZY_THRESHOLD:** Empézalo en 75.
> Si ves muchos handoffs innecesarios ("pizzita" no matchea "pizza") → bájalo a 65.
> Si hay matches incorrectos ("agua" matchea "aguas saborizadas") → súbelo a 85.

---

## ✅ Checklist de producción (estado final esperado)

### Infraestructura
```
□ docker-compose up -d → 6 servicios: db, redis, backend, n8n, evolution, ollama
□ Todos con status "healthy" en docker ps
□ start-pos.bat funciona (doble click → sistema listo)
□ ngrok corriendo con dominio fijo mi-pizzeria.ngrok-free.app
```

### Backend
```
□ NestJS escucha en 0.0.0.0:3000 (accesible desde toda la LAN)
□ CORS acepta IPs de LAN + tauri://localhost
□ GET /ordenes/dia responde desde celular con IP de LAN
□ Socket.IO gateway activo (evento orden:nueva llega a todos)
□ Redis adapter activo (log: "Socket.IO usando Redis adapter")
□ Recargos pizza calculados server-side (no en el frontend)
□ JWT Guards activos (401 sin token, 200 con token válido)
□ POST /whatsapp/handoff emite evento WS al personal
```

### Expo APK
```
□ Hook useOrdenesSocket conectado y verde en la app
□ Nueva orden aparece sin refrescar (< 1 segundo)
□ Alerta de handoff WhatsApp aparece en pantalla
□ APK compilado y distribuido a todos los celulares del personal
□ Test real: celular en WiFi del negocio conecta al servidor
```

### WhatsApp + IA
```
□ Evolution API: QR escaneado, estado "open"
□ Webhook Evolution → n8n configurado
□ Ollama: llama3.2:3b descargado y respondiendo
□ Test simple: "pizza local" → respuesta + orden en la app
□ Test complejo: "pizza grande pepperoni domicilio calle 15 #4-20"
  → orden con productos, dirección y total correcto
□ Test handoff: "lombriz con extra queso"
  → cliente recibe mensaje de asesor + alerta en app del personal
```

### Tauri Desktop (si aplica)
```
□ Indicador WS verde al abrir la app
□ Toast de Windows al recibir orden nueva
□ .exe instalado en la PC de caja
□ Autoarranque configurado (opcional)
```

---

## 📐 Decisiones de arquitectura (por qué así y no de otra forma)

| Decisión | Razón |
|---|---|
| **Sin Traefik** | En LAN puertos directos son suficientes. Traefik agrega complejidad sin beneficio |
| **Redis adapter en Socket.IO** | Costo mínimo con 1 instancia. Escalar a 2 réplicas = cambiar 1 número |
| **JWT 8h sin refresh token** | MVPs priorizan simplicidad. El personal reloguea al empezar turno |
| **Namespace `/ordenes` en WS** | Aisla eventos. Fácil agregar `/cocina` o `/domicilios` en el futuro |
| **Rutas sin prefijo `/api/`** | El backend actual funciona así. No migrar para no romper |
| **Ollama en lugar de OpenAI** | Gratis, privado, sin dependencia de internet para cada pedido |
| **`llama3.2:3b` como modelo** | 1.9 GB, corre en CPU, ~3 tok/s es suficiente para mensajes cortos |
| **`temperature: 0.1` en Ollama** | Tarea determinística (extraer JSON). Creatividad baja = JSON estable |
| **Handoff a humano vs fallback** | Mejor UX: el cliente sabe que un humano lo atiende. No se crean órdenes basura |
| **FastAPI para validación de productos** | Tarea de negocio con 2 llamadas HTTP. Rust sería sobrekill. Migrar a Rust después como ejercicio |
| **Fuzzy matching para nombres** | Los mensajes de WhatsApp son informales. "pizzita" debe matchear "pizza" |
| **FUZZY_THRESHOLD: 75%** | Balance entre demasiados handoffs y matches incorrectos |
| **Catálogo en caché (1h)** | No buscar a la DB en cada mensaje. Recargar manual cuando cambia el menú |
| **Tauri para PC de caja** | 5 MB vs 150 MB (Electron). Notificaciones nativas. Sin browser visible |
| **APK para celulares del personal** | Expo ya existe y funciona. Tauri es adicional para las PCs fijas |
| **ngrok gratis, sin dominio comprado** | El dominio estático de ngrok es permanente. Solo necesario con VPS en nube |
| **Evolution API v2.2.3 (pinned)** | Versión estable conocida. `:latest` puede romperse sin aviso |

---

## 🔗 Referencias al código real del proyecto

| Necesitas | Dónde está en el repo |
|---|---|
| Guards JWT (activar) | `Backend/src/auth/auth.module.ts` líneas 33-34 |
| Estrategia JWT + guards | `Backend/src/auth/strategies/`, `Backend/src/auth/guards/` |
| Entidad y seeder de usuarios | `Backend/src/auth/esquemas/user.entity.ts`, `Backend/src/common/seeders/seed-users.ts` |
| Decorator `@Public()` | `Backend/src/auth/decorators/public.decorator.ts` |
| Entidad pizza_sabores | `Backend/src/pizza-sabores/esquemas/pizza-sabores.entity.ts` |
| Auto-seed de sabores | `Backend/src/pizza-sabores/pizza-sabores.service.ts` (OnModuleInit) |
| Servicio de órdenes (donde agregar recargo) | `Backend/src/ordenes/ordenes.service.ts` |
| Módulo de órdenes (donde agregar Gateway) | `Backend/src/ordenes/ordenes.module.ts` |
| Vista de órdenes (donde agregar WebSocket) | `Frontend/components/orders/OrdersOfDayPending.tsx` |
| Layout raíz del frontend | `Frontend/app/_layout.tsx` |
| Contextos existentes (patrón a seguir) | `Frontend/contexts/OrderContext.tsx`, `Frontend/contexts/ToastContext.tsx` |
| API service (axios, donde agregar auth) | `Frontend/services/api.ts` |
| Endpoints disponibles (Swagger) | `http://localhost:3000/swagger` |
