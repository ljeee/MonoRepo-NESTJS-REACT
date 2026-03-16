# 🍕 POS Pizzería — Arquitectura del Sistema
### Actualizado al 2026-02-28 · Basado en el código real del proyecto

> **Este documento es la referencia de arquitectura del sistema.**
> Describe el estado actual de implementación y las fases pendientes.

---

## 📊 Estado actual del proyecto

```
✅ YA EXISTE Y FUNCIONA                          ❌ FALTA
──────────────────────────────────────────────────────────────────
✅ NestJS backend (Puerto 3000)                   ❌ Ollama (LLM local)
✅ PostgreSQL (Docker, 5433)                      ❌ n8n workflow IA
✅ Redis (Docker, Pub/Sub + BullMQ)               ❌ Evolution API (WhatsApp)
✅ Socket.IO Gateway + Redis Adapter            
✅ Auth JWT activa (guards + roles)               ❌ ai-validator (FastAPI)
✅ Expo APK/Web (24+ pantallas)                  
✅ Tauri Desktop (16 vistas, atajos F1-F3)
✅ WebSocket tiempo real (use-ordenes-socket)
✅ Swagger en /swagger con Bearer auth
✅ ThrottlerModule (100 req/60s)
✅ BullMQ (Redis) para colas
✅ LoggingInterceptor global
✅ start-pos.bat (arranque Windows)
✅ docker-compose (db + redis + backend + frontend)
✅ OrderContext + ToastContext + AuthContext
✅ Sistema de diseño (NativeWind + Tailwind)
✅ 15 módulos CRUD completos con entities/DTOs
✅ Seeders (usuarios, productos, órdenes)
✅ CORS configurado para LAN + Tauri
```

---

## 🏗️ Arquitectura actual (implementada)

```
╔══════════════════════════════════════════════════════════════════╗
║         SISTEMA POS — RED LOCAL DEL NEGOCIO (WiFi/LAN)          ║
╠══════════════════════════════════════════════════════════════════╣
║  PC SERVIDOR                                                     ║
║                                                                  ║
║  docker-compose levanta:                                         ║
║  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     ║
║  │ NestJS :3000 │ │ PG :5433 │ │Redis     │ │ Frontend     │     ║
║  │ API + WS     │ │ (Docker) │ │ Pub/Sub  │ │ :8081 (Cloudflare)│║
║  │ Swagger      │ │          │ │ BullMQ   │ │              │     ║
║  └──────────────┘ └──────────┘ └──────────┘ └──────────────┘     ║
╠══════════════════════════════════════════════════════════════════╣
║  PERSONAL DEL NEGOCIO → Se conectan al servidor por WiFi         ║
║  📱 Expo APK/Web  → celulares del personal (cajeros, cocina)     ║
║  🖥️  Tauri .exe   → PC fija de caja (Windows)                    ║
╠══════════════════════════════════════════════════════════════════╣
║  PENDIENTE (Fases futuras):                                      ║
║  🤖 Ollama + n8n + Evolution API → Bot WhatsApp con IA           ║
║  🌐 ngrok → túnel para recibir mensajes WhatsApp                 ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🧩 Backend — Módulos implementados

### app.module.ts importa:

| Módulo | Descripción |
|--------|-------------|
| `ConfigModule` | Variables de entorno globales (`.env`) |
| `TypeOrmModule` | PostgreSQL con configuración async |
| `ThrottlerModule` | Rate limiting (100 req / 60s) |
| `BullModule` | Colas de trabajo con Redis |
| `RedisModule` | Módulo propio para conexión Redis |
| `AuthModule` | JWT strategy + guards + roles |
| `ClientesModule` | CRUD clientes |
| `ProductosModule` | Catálogo de productos + variantes |
| `PizzaSaboresModule` | Sabores y recargos por tamaño |
| `OrdenesModule` | CRUD órdenes + **Socket.IO Gateway** |
| `OrdenesProductosModule` | Detalle de productos por orden |
| `DomiciliosModule` | Direcciones de envío |
| `DomiciliariosModule` | Gestión de domiciliarios |
| `FacturasVentasModule` | Facturación |
| `FacturasPagosModule` | Pagos de facturas |
| `CierresModule` | Gestión de cierres de caja [NEW] |
| `ContabilidadModule` | Gestión contable y reportes [NEW] |
| `EmpresaModule` | Información del negocio [NEW] |
| `EstadisticasModule` | Reportes y visualización [NEW] |

### main.ts — Configuración

- **WebSocket**: `RedisIoAdapter` (Socket.IO con Redis Adapter para multi-instancia)
- **CORS**: configurable via `CORS_ORIGINS`, incluye `tauri://localhost`
- **Swagger**: en `/swagger` con Bearer auth
- **Pipes**: `ValidationPipe` global (whitelist + transform)
- **Interceptors**: `LoggingInterceptor` global
- **Host**: `0.0.0.0` (accesible en toda la LAN)

### WebSocket Gateway (`ordenes.gateway.ts`)

```
Namespace: /ordenes

Servidor → Clientes (broadcast):
  orden:nueva          → Todos los dispositivos
  orden:actualizada    → Todos (cambio de estado)
  cocina:nueva-orden   → Solo room 'cocina'
  whatsapp:handoff     → Personal (alerta de atención)

Rooms por dispositivo:
  auth: { dispositivo: 'cajero' | 'cocina' | 'admin' | 'repartidor' }
```

### Auth JWT

- `JwtAuthGuard` y `RolesGuard` disponibles
- Decoradores: `@Public()`, `@Roles()`
- Strategy: `passport-jwt`
- DTOs: login, register, refresh-token, auth-response
- Entity: `User` con roles enum

### Seeders disponibles

```bash
npm run seed:users       # Crear usuarios
npm run seed:productos   # Cargar productos
npm run seed:orders      # Generar órdenes de prueba
npm run seed             # Todo junto
```

---

## 📱 Frontend (Expo) — Estructura actual

### 24+ Pantallas (Expo Router `app/`)
Diferenciadas por jerarquía `app/(app)` (Personal) y `app/(web)` (Externos).

| Pantalla | Descripción |
|----------|-------------|
| `index.tsx` | Dashboard principal |
| `login.tsx` | Autenticación |
| `crear-orden.tsx` | Formulario de nueva orden |
| `ordenes.tsx` | Órdenes del día pendientes |
| `ordenes-todas.tsx` | Historial de órdenes |
| `orden-detalle.tsx` | Detalle de una orden |
| `facturas.tsx` | Listado de facturas |
| `facturas-dia.tsx` | Facturas del día |
| `facturas-pagos.tsx` | Gestión de pagos |
| `clientes.tsx` | CRUD clientes |
| `domiciliarios.tsx` | Gestión domiciliarios |
| `gestion-productos.tsx` | CRUD productos |
| `balance-dia.tsx` | Balance diario |
| `balance-fechas.tsx` | Balance por rango de fechas |

### 10 Hooks

| Hook | Función |
|------|---------|
| `use-ordenes-socket` | **WebSocket tiempo real** (Socket.IO) |
| `use-create-order` | Crear nueva orden |
| `use-productos` | Listar productos |
| `use-pizza-sabores` | Listar sabores de pizza |
| `use-client-by-phone` | Buscar cliente por teléfono |
| `use-clientes-list` | Listar clientes |
| `use-domiciliarios-list` | Listar domiciliarios |
| `use-facturas` | Listar facturas |
| `use-facturas-pagos-screen` | Lógica de pantalla pagos |
| `use-create-factura-pago` | Crear pago de factura |

### Contexts

- **AuthContext** — Login/logout, token JWT, persistencia en AsyncStorage
- **OrderContext** — Carrito de compras, productos seleccionados
- **ToastContext** — Notificaciones tipo toast

### Componentes destacados

- `orderForm/` — CartPanel, CreateOrderForm, MenuPicker, PizzaPersonalizadaModal
- `orders/` — OrdersOfDayPending (con WebSocket integrado)
- `products/` — ProductCard, ProductModal, SaborModal, VariantModal
- `ui/` — 13 componentes reutilizables (Badge, Button, Card, etc.)
- `states/` — EmptyState, ErrorState, LoadingState

---

## 🖥️ Desktop (Tauri v2) — Estructura actual

### 16 Páginas (React Router)

| Ruta | Vista | Atajo |
|------|-------|-------|
| `/login` | Login | — |
| `/dashboard` | Dashboard Principal | — |
| `/ordenes` | Órdenes del día | F2 |
| `/crear-orden` | Nueva orden | F1 |
| `/facturas` | Facturas | F3 |
| `/historial` | Historial de órdenes | — |
| `/clientes` | Gestión de Clientes | — |
| `/productos` | Gestión de Productos | — |
| `/estadisticas` | Estadísticas del Día | — |
| `/balance-fechas` | Balance por Fechas | — |
| `/cierres` | Cierres de Caja | — |
| `/ajustes-negocio` | Ajustes de Negocio | — |
| `/ajustes` | Configuración (URL backend) | — |

... y otras vistas de gestión interna (16 en total).

### Características

- **URL del backend configurable** (persiste con Tauri Store)
- **Atajos de teclado**: F1 (crear orden), F2 (órdenes), F3 (facturas)
- **Prevención de cierre accidental** (evento Tauri close-requested)
- **Notificaciones nativas de Windows** (Tauri Notification plugin)
- **11 hooks** (mismos que Frontend + `use-keyboard-shortcuts`)
- **Utilidades**: CSV export, formateo de números, impresión de recibos, rangos de fecha
- **Sidebar** con navegación lateral

### Stack Desktop

- React 19 + React Router v6 + Vite 7
- Radix UI (Dialog, Select, Toast)
- Lucide React (iconos)
- Tauri v2 con plugins: notification, opener, store
- Socket.IO client (mismo gateway que Frontend)

---

## 🐳 docker-compose.yml actual

4 servicios en producción:

| Servicio | Imagen | Puerto | Dependencias |
|----------|--------|--------|-------------|
| `db` | postgres:16-alpine | 5433:5432 | — |
| `redis` | redis:7-alpine | (interno) | — |
| `backend` | Build local | 3000:3000 | db (healthy), redis (healthy) |
| `frontend` | Build local (Nginx) | 8081:8081 | backend |

Volúmenes: `pizzeria-pgdata`, `redis_data`
Red: `pizzeria-network` (bridge)

---

## 📋 Fases completadas vs pendientes

| # | Fase | Estado | Notas |
|---|------|:------:|-------|
| **1** | Infraestructura: Redis + docker-compose | ✅ Completada | Redis, docker-compose limpio (sin Traefik) |
| **2** | Backend: Socket.IO Gateway + Redis adapter | ✅ Completada | Gateway en `/ordenes`, RedisIoAdapter en main.ts |
| **3** | Frontend Expo: Hook WS + tiempo real | ✅ Completada | `use-ordenes-socket.ts` implementado |
| **4** | Recargos pizza server-side | ❌ Pendiente | La tabla PizzaSabores existe pero los recargos no se aplican al crear orden |
| **5** | Autenticación JWT activa | ✅ Completada | Guards, roles, @Public() disponibles |
| **6** | ngrok + script arranque | ⚠️ Parcial | `start-pos.bat` existe (sin ngrok — no se necesita hasta Fase 7) |
| **7** | WhatsApp: Evolution + n8n + Ollama | ❌ Pendiente | No hay servicios de IA/WhatsApp en docker-compose |
| **7G** | AI Validator (FastAPI) | ❌ Pendiente | Carpeta `ai-validator/` no existe aún |
| **8** | Tauri Desktop (PC de caja) | ✅ Completada | 16 vistas, atajos de teclado, sidebar premium |

---

## ❌ Fases pendientes de implementación

### FASE 4 — Recargos pizza server-side
#### ⏱️ Tiempo: 2-3 horas · 🎯 Complejidad: Baja · 🟡 IMPORTANTE
> **Qué falta:** El backend tiene la tabla `PizzaSabores` con los recargos pero no los aplica al crear orden.
> Los recargos se calculan en el frontend (no confiable).

#### Lo que cambia

- `Backend/src/pizza-sabores/pizza-sabores.module.ts` → exportar `PizzaSaboresService`
- `Backend/src/ordenes/ordenes.module.ts` → importar `PizzaSaboresModule`
- `Backend/src/ordenes/ordenes.service.ts` → inyectar servicio + método `calcularRecargoSabores()`

> 📄 **Código completo:** `26-plan-refinado-final/REfinadoplan.md` — Fase 4

#### Verificación Fase 4 ✅

```bash
# Crear orden con sabor Quesuda talla mediana (recargo +$3.000)
curl -X POST http://localhost:3000/ordenes \
  -H "Content-Type: application/json" \
  -d '{"tipoPedido":"local","productos":[{"sabor1":"quesuda","tamano":"mediana",...}]}'
# El campo "total" en la respuesta debe incluir el recargo
```

---

### FASE 6 — ngrok (para WhatsApp)
#### ⏱️ Tiempo: 2-4 horas · 🎯 Complejidad: Baja · 🟡 IMPORTANTE

> `start-pos.bat` ya existe en la raíz. Solo falta agregar ngrok cuando se implemente WhatsApp.

#### Pasos para ngrok

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

### `start-pos.bat` — Ya implementado

El script actual levanta Docker y muestra los endpoints. Cuando se agregue ngrok,
actualizar para incluir el paso de túnel:

```batch
start "ngrok" /min ngrok http --domain=mi-pizzeria.ngrok-free.app 8080
```

---

### FASE 7 — WhatsApp: Evolution API + n8n + Ollama
#### ⏱️ Tiempo: 3-5 días · 🎯 Complejidad: Alta · 🟢 DIFERENCIADOR

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

> ✅ **FASE 8 (Tauri Desktop) YA COMPLETADA** — Ver sección "Desktop (Tauri v2)" arriba.

---

## 🗓️ Cronograma de implementación (restante)

```
SEMANA 1 — Ajustes al core
  Día 1:   FASE 4 — Recargos pizza server-side (2-3 h)
  Día 2:   FASE 6 — ngrok setup (2-4 h)

SEMANA 2 — Integración WhatsApp
  Día 1-2: FASE 7A-B — Evolution API setup + QR WhatsApp
            Agregar servicios a docker-compose (n8n, evolution, ollama)
  Día 3-4: FASE 7C-D — n8n workflow básico (sin Ollama primero)
            Test básico: mensaje WPP → orden en APK
  Día 5:   FASE 7F — Reemplazar nodo simple por Ollama IA

SEMANA 3 — IA + validador
  Día 1-2: FASE 7G — AI Validator (FastAPI, fuzzy matching)
  Día 3-5: Tests end-to-end + ajustes finales
```

> ⚠️ **Estimado restante: ~2-3 semanas de trabajo efectivo.**
> Las fases 1, 2, 3, 5 y 8 ya están completadas.

---

### FASE 7G — Validador de productos contra la DB (FastAPI)
#### ⏱️ Tiempo: 1 día · 🎯 Complejidad: Media · 🟢 OPCIONAL pero recomendado

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

## ✅ Checklist de producción

### Infraestructura
```
✅ docker-compose up -d → 4 servicios: db, redis, backend, frontend
✅ Todos con status "healthy" en docker ps
✅ start-pos.bat funciona (doble click → sistema listo)
□ Agregar n8n, evolution, ollama a docker-compose (pendiente — Fase 7)
□ ngrok con dominio fijo (pendiente — Fase 6 + 7)
```

### Backend
```
✅ NestJS escucha en 0.0.0.0:3000 (accesible desde toda la LAN)
✅ CORS acepta IPs de LAN + tauri://localhost
✅ 10 módulos CRUD completos (entities, DTOs, controllers, services)
✅ Socket.IO gateway en /ordenes (orden:nueva, orden:actualizada, etc.)
✅ Redis adapter activo (RedisIoAdapter)
✅ ThrottlerModule (100 req/60s)
✅ BullMQ con Redis
✅ JWT Guards + Roles disponibles
✅ LoggingInterceptor global
✅ Swagger en /swagger con Bearer auth
✅ Seeders (usuarios, productos, órdenes)
□ Recargos pizza server-side (pendiente — Fase 4)
□ POST /whatsapp/handoff (pendiente — Fase 7)
```

### Frontend (Expo APK/Web)
```
✅ 15 pantallas completas (Expo Router)
✅ Hook useOrdenesSocket (Socket.IO tiempo real)
✅ AuthContext + OrderContext + ToastContext
✅ Sistema de diseño (tokens, tema, responsive)
✅ 10 hooks especializados
✅ Componentes UI reutilizables (13 en ui/)
```

### Desktop (Tauri v2)
```
✅ 6 vistas (Login, Órdenes, CrearOrden, Facturas, Historial, Ajustes)
✅ Atajos de teclado (F1, F2, F3)
✅ URL backend configurable (Tauri Store)
✅ Notificaciones nativas de Windows
✅ Prevención de cierre accidental
✅ Conecta al mismo gateway WebSocket
✅ 11 hooks (incl. keyboard-shortcuts)
```

### WhatsApp + IA (pendiente)
```
□ Evolution API: QR escaneado, estado "open"
□ Webhook Evolution → n8n configurado
□ Ollama: llama3.2:3b descargado y respondiendo
□ ai-validator (FastAPI) con fuzzy matching
□ Test e2e: mensaje WPP → orden en la app
□ Test handoff: mensaje incomprensible → alerta en app
```

---

## 📐 Decisiones de arquitectura

| Decisión | Razón |
|---|---|
| **Sin Traefik** | En LAN puertos directos son suficientes. Traefik agrega complejidad sin beneficio |
| **Redis adapter en Socket.IO** | Costo mínimo con 1 instancia. Escalar a 2 réplicas = cambiar 1 número |
| **Namespace `/ordenes` en WS** | Aisla eventos. Fácil agregar `/cocina` o `/domicilios` en el futuro |
| **Rutas sin prefijo `/api/`** | El backend actual funciona así. No migrar para no romper |
| **Tauri para PC de caja** | 5 MB vs 150 MB (Electron). Notificaciones nativas. Sin browser visible |
| **APK para celulares del personal** | Expo ya existe y funciona. Tauri es adicional para las PCs fijas |
| **Ollama en lugar de OpenAI** (futuro) | Gratis, privado, sin dependencia de internet para cada pedido |
| **FastAPI para validador** (futuro) | Tarea de negocio con fuzzy matching. Python más productivo |
| **Handoff a humano vs fallback** (futuro) | Mejor UX: el cliente sabe que un humano lo atiende |
| **ngrok gratis, sin dominio comprado** (futuro) | El dominio estático de ngrok es permanente |
| **3 apps cliente (Expo, Tauri, WhatsApp)** | Cada una cubre un caso de uso distinto del negocio |
