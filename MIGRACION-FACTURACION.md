# Migración de la base de producción a la nueva facturación

Guía paso a paso para llevar la base REAL (PostgreSQL en `pizzeria-db`) de la estructura anterior (`Backend/init.sql`,
volcado del 24-may) a la actual: ventas estructuradas, cuentas de transferencia, abonos por cuenta, grupos de sabores,
inventario unificado y cierre con resumen.

> **Qué está probado y qué no.** Las pruebas automáticas (Anexo B) corren la migración completa sobre PGlite (PostgreSQL real
> compilado a WASM) partiendo de la estructura anterior, con datos sintéticos que imitan las anomalías conocidas (Anexo A). Además
> se hizo un ensayo puntual (script ya borrado) con TypeORM real: `synchronize` con las entidades actuales + el ejecutor de
> migraciones, y las herramientas compiladas corridas con `node` plano, como correrán dentro de la imagen. **No se ejecutó contra
> la base de producción, ni con Docker** (build de la imagen, `docker compose`, PostgreSQL 16 nativo): los comandos de Docker de
> esta guía están sin ejecutar. Por eso la **Fase B (ensayo con una copia de TU base) es obligatoria**: es la que descubre lo que
> aquí no se puede ver (volumen, datos reales, Dockerfile).

---

## 0. En un minuto

1. **La migración no borra ni cambia ningún monto.** Filas, facturado, cobrado y por cobrar de cada mes quedan idénticos; la verificación lo comprueba
   número a número (§6). Lo que sí se verá distinto en pantalla —por las definiciones nuevas de venta válida y de balance, no por los datos— está en §1.3.
2. **Hay 2 cosas que hacen fallar el arranque** si existen en tus datos (la auditoría las marca `BLOQUEANTE`, §4): domicilios con un repartidor
   que no existe en `domiciliarios` y domicilios cuyo repartidor solo consta en la columna heredada `"domiciliarioTelefono"`. Se arreglan con SQL
   (§11) **antes** de desplegar.
3. **El esquema lo aplica `synchronize` al arrancar el backend** (es transaccional: si falla, la base queda como estaba). Los 6 pasos de datos corren justo después.
4. **Orden:** A respaldo → B ensayo con la copia → C ventana de despliegue → D verificación → E tareas posteriores. F es la reversa.
   **Si el equipo del servidor se va a formatear, ve a §12** (respaldo completo con scripts, semáforo antes de formatear y carga en el servidor nuevo).
5. **Reglas de oro:** no desplegar sin haber hecho B; no traer el código nuevo al equipo de producción con el backend corriendo (§5, paso C0);
   nunca `npm run db:down`, `docker compose down -v` ni `backend:local` en producción; no cambiar el código entre el ensayo y el despliegue.

---

## 1. Qué hace la migración

### 1.1 Estructura anterior → actual

La estructura anterior tiene 19 tablas. Para llegar a la actual, `synchronize` crea 7 tablas, 38 columnas, 13 índices y 8 llaves foráneas (69 sentencias) y borra solo lo que se indica en §1.1.1.

| Antes | Después | Cómo llega |
|---|---|---|
| `facturas_ventas` (total, método, estado, `pago_efectivo`, `pago_transferencia`) | + `monto_pagado`, `cuenta_transferencia_id`, `cuenta_transferencia_nombre`, `desglose_transferencia` (jsonb) | synchronize + `cuentas-factura-id-v1` + `facturas-montos-v1` |
| `ordenes_productos` (solo el texto `producto`) | + `producto_base`, `variante_nombre`, `tamano`, `categoria`, `precio_lista`, `precio_manual`, `detalle_version`; tabla nueva `ordenes_productos_sabores` | synchronize + `ventas-detalle-v1` (segundo plano) |
| `ordenes` | + `canal`, `usuario_creacion_id` (las órdenes viejas quedan en NULL: canal desconocido) | solo columnas |
| `pizza_sabores` (`tipo` tradicional/especial) | + `grupo_id`; tabla nueva `sabor_grupos` (Pizza, Calzone); único `(grupo_id, nombre)` | synchronize + `sabor-grupos-v1` |
| `productos`, `producto_variantes` | + `categoria`, `personalizacion`, `sabor_grupo_id`; variantes: `tamano` y columnas de bebida | `productos-categoria-v1`, `sabor-grupos-v1` |
| `inventario_cajas*`, `ingredientes_bebidas`, `variantes_ingredientes`, columnas `*_bebida` | tablas nuevas `inventario_items`, `inventario_movimientos`, `inventario_consumos` | `inventario-unificado-v1` (las viejas quedan **intactas** como respaldo) |
| `facturas_pagos` (egresos) | + `tipo_gasto` (costo/gasto), `cuenta_origen_id` | solo columnas; se clasifican a mano (§8) |
| `empresa_config` | + `recargo_leche`, `arqueo_caja`, `arqueo_desde` | con valores por defecto |
| `cierres_caja` | + `resumen` (jsonb); los cierres antiguos quedan sin resumen | solo columna |
| `domicilios` | llave foránea a `domiciliarios`; se borra `"domiciliarioTelefono"` | **bloqueantes** (§1.1.1) |
| `clientes`, `cliente_direcciones`, `domiciliarios` | + contraseña del cliente, referencia/costo/GPS de dirección, última ubicación del repartidor | columnas nulas |
| — | tablas nuevas `cuentas_transferencia`, `migraciones_datos` | synchronize |

Foto exacta del DDL (69 sentencias): `Backend/test/unit/migracion/fixtures/sincronizacion-desde-estructura-anterior.sql`.
Tu base puede estar en un punto intermedio (si ya corrió código más reciente que `init.sql`): el DDL real sale de `schema:preview` (§4, B6) y la auditoría
lista lo que falta (`esquema-por-actualizar`).

#### 1.1.1 Los únicos `DROP` esperados

| Sentencia | Por qué es seguro |
|---|---|
| `ALTER TABLE "domicilios" DROP CONSTRAINT …` (llave heredada sobre `"domiciliarioTelefono"`) | la reemplaza la llave nueva sobre `telefono_domiciliario_asignado` |
| `ALTER TABLE "domicilios" DROP COLUMN "domiciliarioTelefono"` | **sí tiene datos si hay un domicilio con repartidor solo ahí** → bloqueante hasta copiarlos (§11) |
| `DROP INDEX`/`DROP CONSTRAINT` del único anterior de `pizza_sabores` | lo reemplaza el único `(grupo_id, nombre)` |

**Cualquier otro `DROP` (sobre todo `DROP COLUMN`) es una señal de PARAR**: significa que una entidad perdió una propiedad y se borraría su columna.

### 1.2 Los 6 pasos de datos (`Backend/src/common/migraciones-datos/pasos/`)

Corren al arrancar, en este orden, una sola vez cada uno (quedan en la tabla `migraciones_datos`); son idempotentes y ninguno cambia un total.

| # | Paso | Qué hace |
|---|---|---|
| 1 | `productos-categoria-v1` | Pone `productos.categoria` (pizza, calzone, bebida, jugo, adicion, comida, otro) deducida de la personalización y el nombre. |
| 2 | `sabor-grupos-v1` | Crea los grupos Pizza y Calzone, asigna sabores y productos y deja los **precios exactos de antes** (los tradicionales nunca cobraron recargo). Si "Paisa" existe tradicional y especial, gana el especial y el otro queda inactivo (las líneas ya estructuradas que apuntaban a él se re-apuntan). Si el grupo Calzone no tiene sabores, los crea desde los nombres de las variantes del calzone (sin "UNIDAD" ni "calzone de dos sabores"). |
| 3 | `cuentas-factura-id-v1` | Enlaza por id las facturas que solo guardaron el **nombre** de su cuenta, si exactamente una cuenta coincide (sin importar mayúsculas ni espacios). Lo que no coincide queda intacto y se reporta. |
| 4 | `facturas-montos-v1` | En facturas pagadas completa `monto_pagado = total` y el reparto efectivo/QR donde estaba en NULL; en pagos mixtos con UNA parte conocida calcula la otra. Nunca pisa un valor existente. |
| 5 | `inventario-unificado-v1` | Pasa cajas y bebidas embotelladas al inventario unificado (existencias negativas → 0) y crea las reglas de consumo; registra `fechaCorte`. Mientras no termine bien, `/inventario/*` responde 503 y las ventas no descuentan stock. |
| 6 | `ventas-detalle-v1` | **En segundo plano** (lotes de 500 líneas, pausa de 150 ms): deduce producto, tamaño y sabores de cada línea histórica desde su texto. Lo que no reconoce queda marcado, no inventado. Depende de los pasos 1 y 2. |

Si un paso falla queda en `error`, el backend arranca igual y los pasos que dependen de él esperan; se reintenta en el siguiente arranque (§10).
Apagado de emergencia: variable `MIGRACIONES_DATOS_OFF=1`.

### 1.3 Lo que SÍ cambia en pantalla (y por qué)

La verificación lo muestra como `aviso`, no como falla. Avísale al dueño antes de que lo vea:

1. **Las ventas cuya orden está cancelada dejan de contar** (venta válida = factura no cancelada con alguna orden viva). Es la causa principal de que algún total histórico baje un poco; la auditoría lo cuantifica (`ventas-orden-cancelada`).
2. **El reparto efectivo/QR de una mixta con una sola parte conocida se completa** (el efectivo/QR de ese mes sube; el cobrado total no cambia).
3. **Balance de caja = cobrado − gastos pagados** en todas las pantallas (antes cada una sumaba lo suyo).
4. **Sabores:** "Paisa" tradicional queda inactivo (el especial sobrevive); el Calzone gana sus sabores; ya no existe tradicional/especial.
5. **QR histórico "Sin asignar"**: las facturas cobradas por QR sin cuenta aparecen así hasta asignarlas (§8). Los egresos viejos aparecen "sin clasificar".
6. **Usuarios sin rol** (o con un rol que no existe) reciben 403 en cualquier escritura: la API nueva exige rol en TODA operación de escritura.

---

## 2. Requisitos

- Docker Desktop encendido en producción y en el equipo de desarrollo. PowerShell (los comandos son de PowerShell 5.1+).
- **Un respaldo reciente y restaurado al menos una vez** (Fase B lo prueba). Espacio libre: unas 3 veces el tamaño de la base.
- Una ventana en que el negocio no esté vendiendo (§5): backend detenido mientras se toma la línea base. Estimación de la caída: lo que dure `git pull` + `docker compose build backend`
  (varios minutos) + el arranque (segundos o pocos minutos; **mídelo en el ensayo**).
- Decidir quién hace el commit/tag del código. **Esta guía no hace commits ni despliega**; el código nuevo está en el árbol de trabajo.
- `backups/` está en `.gitignore` y `.dockerignore` (contiene datos reales de clientes). Todo lo que genera esta guía va ahí.

---

## 3. Fase A — Respaldo (producción, en caliente)

`pg_dump` toma una foto consistente sin detener nada. Se escribe DENTRO del contenedor y se copia: redirigir con `>` en PowerShell 5.1 corrompe los binarios.

```powershell
cd <carpeta-del-repo>                       # donde está docker-compose.yml
New-Item -ItemType Directory -Force backups | Out-Null
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
docker exec pizzeria-db pg_dump -U appuser -d appdb -Fc -f /tmp/respaldo.dump
docker cp pizzeria-db:/tmp/respaldo.dump "backups\appdb-$ts.dump"
docker exec pizzeria-db rm /tmp/respaldo.dump
Get-Item "backups\appdb-$ts.dump" | Select-Object Name, Length     # Length > 0
```

Llévate una copia fuera del equipo (USB, nube privada) y copia el `.dump` al equipo de desarrollo para la Fase B. Anota los conteos de control:

```powershell
docker exec pizzeria-db psql -U appuser -d appdb -c "SELECT (SELECT count(*) FROM facturas_ventas) facturas, (SELECT count(*) FROM ordenes) ordenes, (SELECT count(*) FROM ordenes_productos) lineas, (SELECT count(*) FROM clientes) clientes"
```

---

## 4. Fase B — Ensayo con la copia (equipo de DESARROLLO, nunca en producción)

Se usa la **misma imagen** que irá a producción y contenedores descartables en una red aparte (`ensayo-net`, puertos 5434/3001): producción no se toca.
Aquí se prueba además el Dockerfile.

> **Atajo:** `powershell -ExecutionPolicy Bypass -File scripts\docker-local.ps1 ensayar -Paquete backups\respaldo-<fecha> [-Correccion backups\corregir.sql]`
> hace B1–B9 con el entorno local sin túnel (proyecto `pos-local`, ver CLAUDE.md): carga el respaldo, aplica la corrección, audita, toma la línea base,
> arranca el backend nuevo, verifica, compara precios y **mide cuánto tarda cada paso** (archivos en `backups\ensayo-local-*`). Abajo está la versión manual.
> No uses las dos a la vez: ambas publican la base en el puerto 5434.

```powershell
cd <carpeta-del-repo>
# B1. Imagen nueva (la que irá a producción)
docker build -t pizzeria-backend:ensayo --target production ./Backend

# B2. Base y Redis descartables
docker network create ensayo-net
docker run -d --name ensayo-db --network ensayo-net -p 5434:5432 -e POSTGRES_USER=appuser -e POSTGRES_PASSWORD=ensayo -e POSTGRES_DB=appdb -e TZ=America/Bogota postgres:16-alpine
docker run -d --name ensayo-redis --network ensayo-net redis:7-alpine
docker exec ensayo-db pg_isready -U appuser -d appdb          # repetir hasta "accepting connections"

# B3. Restaurar la copia de producción
docker cp backups\appdb-AAAAMMDD-HHMM.dump ensayo-db:/tmp/produccion.dump
docker exec ensayo-db pg_restore -U appuser -d appdb --no-owner /tmp/produccion.dump
docker exec ensayo-db psql -U appuser -d appdb -c "SELECT (SELECT count(*) FROM facturas_ventas) facturas, (SELECT count(*) FROM ordenes) ordenes, (SELECT count(*) FROM ordenes_productos) lineas, (SELECT count(*) FROM clientes) clientes"
#   ↑ deben ser los mismos conteos de producción (Fase A). Si no, el respaldo no sirve: repetir A.

# Atajo para correr las herramientas (solo lectura) con la imagen nueva contra la copia
function Migracion { docker run --rm --network ensayo-net -v "${PWD}\backups:/out" -e DATABASE_HOST=ensayo-db -e DATABASE_USER=appuser -e DATABASE_PASSWORD=ensayo -e DATABASE_NAME=appdb pizzeria-backend:ensayo node dist/common/migraciones-datos/herramientas/cli.js @args }

# B4. Auditoría: qué hay en la base y qué problemas traería migrarla (código de salida 2 = hay bloqueantes)
Migracion auditar --salida /out/auditoria-ensayo.txt
Get-Content backups\auditoria-ensayo.txt -Encoding UTF8      # sin -Encoding, PowerShell 5.1 muestra mal las tildes y los íconos
```

**Cómo leer la auditoría** (cada hallazgo trae su SQL de corrección; ver también el Anexo A):
- `⛔ BLOQUEANTE`: se corrige SÍ o SÍ (§11). Con alguno, `synchronize` falla y el backend se queda reiniciándose.
- `⚠️ ATENCIÓN`: cambia lo que se ve o requiere una tarea posterior (§8). No bloquea. Léelos todos y decide cuáles resolver antes.
- `ℹ️ INFO`: contexto (volumen, esquema por actualizar…).

```powershell
# B5. Corregir los bloqueantes EN LA COPIA (así pruebas el SQL que luego correrás en producción) y repetir la auditoría hasta 0 bloqueantes
#     Edita backups\corregir.sql con el SQL del §11 adaptado a lo que mostró la auditoría.
docker cp backups\corregir.sql ensayo-db:/tmp/corregir.sql
docker exec ensayo-db psql -U appuser -d appdb -v ON_ERROR_STOP=1 -f /tmp/corregir.sql
Migracion auditar                                            # "Bloqueantes: 0"

# B6. (Opcional, si tienes Node en este equipo) DDL exacto que aplicaría synchronize, SIN aplicarlo
cd Backend
$env:DATABASE_HOST='localhost'; $env:DATABASE_PORT='5434'; $env:DATABASE_USER='appuser'; $env:DATABASE_PASSWORD='ensayo'; $env:DATABASE_NAME='appdb'
npm run schema:preview                                       # revisar los DROP contra §1.1.1; cualquier otro DROP = PARAR
Remove-Item Env:DATABASE_HOST, Env:DATABASE_PORT, Env:DATABASE_USER, Env:DATABASE_PASSWORD, Env:DATABASE_NAME   # que no queden apuntando al ensayo
cd ..

# B7. Línea base: la foto de lo que NO debe cambiar (conteos, dinero por mes, huellas md5, inventario, catálogo)
Migracion linea-base --salida /out/linea-base-ensayo.json

# B8. Arrancar el backend NUEVO contra la copia. Sin MAIL_* ni REPORT_EMAIL: no envía correos.
docker run -d --name ensayo-backend --network ensayo-net -p 3001:3000 -e NODE_ENV=production -e TZ=America/Bogota -e PORT=3000 -e HOST=0.0.0.0 `
  -e DATABASE_HOST=ensayo-db -e DATABASE_PORT=5432 -e DATABASE_USER=appuser -e DATABASE_PASSWORD=ensayo -e DATABASE_NAME=appdb `
  -e REDIS_HOST=ensayo-redis -e REDIS_PORT=6379 -e JWT_SECRET=ensayo-ensayo-ensayo-ensayo-ensayo-ensayo pizzeria-backend:ensayo
docker logs -f ensayo-backend        # Ctrl+C para salir
```

En el log esperas, en este orden: el DDL de `synchronize` (`ALTER TABLE`/`CREATE TABLE`), `[MigracionesDatos] Ejecutando "productos-categoria-v1"`… `"inventario-unificado-v1" terminado`,
`Iniciando en segundo plano "ventas-detalle-v1"`, `Nest application successfully started` y más tarde `"ventas-detalle-v1" terminado`. **Anota cuánto tardó cada cosa**: es la duración real de la ventana.
Un `ERROR`, un paso en `error` o el contenedor reiniciándose = no desplegar; ver §10.

```powershell
# B9. Verificar contra la línea base (espera al paso en segundo plano) y la paridad de precios de las pizzas
Migracion verificar --base /out/linea-base-ensayo.json --esperar
Migracion precios                                            # "N combinaciones: 0 diferencias"

# B10. Prueba de humo con la API del ensayo (usa un usuario real de tu copia)
$login = Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -ContentType 'application/json' -Body (@{username='admin'; password='<tu-clave>'} | ConvertTo-Json)
$h = @{Authorization = "Bearer $($login.accessToken)"}
Invoke-RestMethod -Uri http://localhost:3001/empresa
Invoke-RestMethod -Headers $h -Uri "http://localhost:3001/estadisticas/resumen?from=AAAA-MM-DD&to=AAAA-MM-DD"
Invoke-RestMethod -Headers $h -Uri http://localhost:3001/estadisticas/analitica/calidad-datos     # avance del detalle estructurado
```

**Criterio para pasar a producción:** `verificar` sin fallas (los `aviso` esperados están en §1.3), `precios` con 0 diferencias, 0 bloqueantes, y un total de la copia
(`/estadisticas/resumen` de un mes) igual al que ya conoces de la pantalla actual, salvo lo explicado en §1.3.

```powershell
# B11. Limpieza del ensayo
docker rm -f ensayo-backend ensayo-db ensayo-redis
docker network rm ensayo-net
```

**Prueba también la reversa (§9) sobre la copia**: restaurar el `.dump` en un contenedor nuevo y confirmar los conteos. Un respaldo que no se ha restaurado no es un respaldo.

---

## 5. Fase C — Ventana de despliegue (producción)

**Cuándo:** después de la última venta del día y terminando **antes de las 00:05**. Así el primer cierre automático ya sale con el formato nuevo. Si el arranque
cae después de medianoche, el cierre de "ayer" se genera (y se manda por correo) al arrancar el backend, mientras las migraciones aún corren: evítalo.
La auditoría avisa si el cierre de ayer no existe (`cierre-de-ayer`). Avisa a los clientes del sitio web y a los domiciliarios de que habrá una pausa corta.

> ⚠️ **C0 — antes que nada.** Si producción corre con el `docker-compose.yml` anterior, el backend usa `target: development`, monta `./Backend:/app` y ejecuta
> `npm run start:dev` (modo watch). **Cualquier cambio de archivos en `Backend/` se recarga solo y correría `synchronize` y las migraciones contra la base real**,
> sin respaldo ni línea base. Detén el backend ANTES de traer el código nuevo (por eso es el primer comando).

```powershell
cd <carpeta-del-repo>

# C0. Detener el backend viejo (DB y Redis siguen arriba; el sitio y el POS quedan sin API)
docker compose stop backend

# C1. Respaldo final, ya sin escrituras (mismos comandos de la Fase A)
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
docker exec pizzeria-db pg_dump -U appuser -d appdb -Fc -f /tmp/respaldo.dump
docker cp pizzeria-db:/tmp/respaldo.dump "backups\appdb-final-$ts.dump"
docker exec pizzeria-db rm /tmp/respaldo.dump

# C2. Traer el código nuevo (el mismo que ensayaste: sin cambios) y construir la imagen. El backend sigue detenido.
git pull                                                    # o como lleves hoy el código a este equipo
docker compose build backend
```

```powershell
# C3. Auditoría y línea base con la imagen NUEVA, de solo lectura, contra la base real (red de compose)
function Migracion { docker compose run --rm --no-deps -v "${PWD}\backups:/out" backend node dist/common/migraciones-datos/herramientas/cli.js @args }
Migracion auditar --salida /out/auditoria-produccion.txt         # si hay bloqueantes, corregir (§11) y repetir
Migracion linea-base --salida /out/linea-base-produccion.json
```

Corrección de bloqueantes en producción (solo si C3 los muestra; el mismo SQL ya probado en B5):

```powershell
docker cp backups\corregir.sql pizzeria-db:/tmp/corregir.sql
docker exec pizzeria-db psql -U appuser -d appdb -v ON_ERROR_STOP=1 -f /tmp/corregir.sql
Migracion auditar                                              # "Bloqueantes: 0"
Migracion linea-base --salida /out/linea-base-produccion.json  # la línea base se toma DESPUÉS de corregir
```

```powershell
# C4. Arrancar el backend nuevo y mirar el log
docker compose up -d backend
docker compose logs -f backend                                  # Ctrl+C para salir
```

Espera `Nest application successfully started` (los pasos 1-5 ya terminaron antes: corren antes de abrir el puerto). El paso 6 sigue en segundo plano; el POS ya se puede usar.
**Antes de abrir ventas confirma en el log que `sabor-grupos-v1` terminó** (`"sabor-grupos-v1" terminado`): sin él, las pizzas y calzones no ofrecen sabores ni cobran recargos (el
servidor calcula los sabores a partir del grupo del producto). Si quedó en `error`, no abras ventas: corrige (§10) o revierte (§9).

```powershell
# C5. Verificación contra la línea base (espera al segundo plano; solo lectura)
Migracion verificar --base /out/linea-base-produccion.json --esperar
Migracion precios

# C6. POS web nuevo (sirve archivos estáticos; reconstruye la imagen)
docker compose up -d --build frontend
```

Si C5 no termina en `Sin fallas`: **no sigas con las pruebas de humo**. Mira §10 y decide entre arreglar o revertir (§9). Cuanto antes se decida,
menos ventas nuevas se pierden al revertir.

---

## 6. Fase D — Verificación y pruebas de humo

`verificar` hace 20 pruebas; las que valen la pena entender:

| Prueba | Qué garantiza |
|---|---|
| `filas`, `huellas` | mismo número de filas en cada tabla y mismo md5 de las columnas que la migración no debe tocar |
| `dinero` | facturas, facturado, cobrado y por cobrar idénticos **mes a mes** |
| `gastos`, `lineas`, `caja` | egresos, líneas de venta y movimientos de caja idénticos |
| `precios-catalogo`, `precios-sabores` | el precio de cada variante y de **cada combinación de sabores** de la pizza es el de antes |
| `sabores-catalogo` | ningún sabor desapareció; solo se agregaron los del calzone |
| `reparto-por-medio` | efectivo/QR **solo puede subir** (aviso esperado, §1.3) |
| `montos`, `cuentas`, `huerfanos`, `inventario`, `detalle-ventas`, `analitica` | los 6 pasos hicieron su trabajo y `GET /estadisticas/resumen` coincide con el SQL directo |

**Pruebas manuales en el POS** (con el navegador recargado con Ctrl+F5; el pie del menú muestra `BUILD_JS`):

1. Entrar con admin, cajero, mesero y cocina: cada uno ve lo suyo. Un usuario `domiciliario` entra a RiderApp.
2. Crear una orden de mesa con una pizza de 2 sabores y verificar que el precio es el de siempre; verla en cocina.
3. Cobrar en efectivo; cobrar por QR (el sistema pide la cuenta); hacer un abono y saldarlo; revertir un cobro y volver a cobrar.
4. Balance del día: balance = cobrado − gastos pagados. Contabilidad (rango largo) y Analítica cargan.
5. Inventario muestra cajas y bebidas con su stock; vender una gaseosa lo descuenta.
6. Registrar un egreso por QR (pide la cuenta de origen). Revisar un cierre de caja.
7. Llamar `GET /sabor-grupos` y abrir el sitio de clientes (ClientWeb): el catálogo y los sabores cargan y un pedido de prueba entra.

Deja las `auditoria-*.txt`, `linea-base-*.json` y los `.dump` de `backups/` guardados al menos un mes.

---

## 7. Compatibilidad de clientes

El backend nuevo no es 100 % compatible con las apps instaladas:

| Cliente | Con el backend nuevo | Qué hacer |
|---|---|---|
| **POS web** (contenedor `frontend`) | Compatible tras `up -d --build frontend` y recargar (Ctrl+F5). | Verificar `BUILD_JS` en el menú. |
| **APK del POS** (versión anterior) | Las pantallas de estadísticas llaman a rutas **retiradas** (`/estadisticas/productos-top`, `sabores-top`, `variantes-top`, `ventas-por-hora`, `ventas-por-dia`, `metodos-pago`, `resumen-periodo`, `clientes-frecuentes`, `domiciliarios`) → 404. Los cobros por QR/mixto y los abonos por transferencia **exigen la cuenta**: sin ella, 400. Las escrituras exigen rol: sin él, 403. | Mientras no haya APK nuevo (no se generó): **usar el POS web en el navegador** en tablets y celulares. |
| **RiderApp** | Mismas rutas (`/domicilios/me`, `PATCH /domicilios/:id`, `PATCH /domiciliarios/me/ubicacion`). Reglas nuevas: el repartidor solo cambia el estado de SUS entregas (si no, 403); si su usuario no corresponde a un domiciliario registrado, el reporte de ubicación responde 404 (antes decía `ok` sin guardar). | Revisar `domiciliarios-usuarios` en la auditoría: `username` = teléfono de 10 dígitos. |
| **ClientWeb** | Se despliega aparte (no está en `docker-compose.yml`). El backend recalcula todo precio, así que un ClientWeb viejo puede **mostrar** un recargo distinto al que cobra el servidor. | Publicar la versión nueva junto con el backend. |
| Sockets (`/ordenes`) | Sin cambio: ya exigían el JWT. | — |
| Bot de WhatsApp (n8n) | Fuera del alcance de esta migración. | — |

---

## 8. Fase E — Tareas posteriores (a mano, sin prisa)

1. **Cuentas de transferencia reales.** Si la tabla estaba vacía, el backend crea al arrancar tres de ejemplo (Jeferson, Diana, Firu). Ajústalas en *Ajustes del negocio* antes del primer cobro por QR. Renombrar una cuenta reescribe sus facturas (intencional).
2. **QR histórico "Sin asignar".** Desde *QR / Transferencias*, una a una; o en bloque si hasta cierta fecha todo entraba a la misma cuenta (primero como `SELECT`):
   `UPDATE facturas_ventas SET cuenta_transferencia_id = <id>, cuenta_transferencia_nombre = '<nombre>' WHERE <mismo filtro> AND "fechaFactura" < '<fecha>';`
3. **Egresos históricos**: tocar cada uno en *Contabilidad › Egresos* para clasificar costo/gasto y asignar la cuenta de los pagados por QR.
4. **Pagos mixtos sin desglose** que `verificar` reporta en `montos` (no se pueden deducir): corregir `pago_efectivo` y `pago_transferencia` para que sumen el total.
5. **Datos de prueba** del seeder viejo (`datos-de-prueba` en la auditoría): confirmar con `SELECT` y borrar; inflan ventas y estadísticas.
6. **Teléfonos** que no están en 10 dígitos (sin `+57` ni espacios), sobre todo los de domiciliarios; **usuarios sin rol** (asignarles uno).
7. **Variantes de pizza sin tamaño reconocible** (p. ej. "Familiar"): se cobran como GRANDE, igual que antes; fijar su tamaño en la variante si es otro.
8. **Caja huérfana** (`caja-huerfana`): efectivo que quedó en caja de una factura luego cancelada; si una se vuelve a cobrar, hacer antes un ajuste de caja por esa suma.

---

## 9. Fase F — Reversa

Hay que entender una asimetría: **el código viejo no puede correr sobre la base ya migrada.** Su `synchronize` borraría las columnas nuevas de las tablas que conoce
(`monto_pagado`, `cuenta_transferencia_*`, `producto_base`…). Por eso la reversa **siempre es restaurar el respaldo** y volver al código anterior; lo vendido después de migrar
se pierde (hay que reingresarlo). Decide en la primera hora.

| Situación | Qué hacer |
|---|---|
| El backend nuevo **no arranca por `synchronize`** (error de llave foránea, etc.) | La base no cambió (el DDL es transaccional). `docker compose stop backend`, corregir los datos con el SQL del §11 y `docker compose up -d backend`. No hace falta restaurar. |
| Un **paso de datos quedó en `error`** | No hace falta restaurar: ver §10, arreglar la causa y reiniciar el backend. Mientras tanto, **no abras ventas si el paso es `sabor-grupos-v1`** (sin él las pizzas no ofrecen sabores ni cobran recargos); con otro paso la app puede operar (`inventario-unificado-v1`: las ventas no descuentan stock; `ventas-detalle-v1`: la analítica de productos queda incompleta). |
| La verificación falla en `dinero`, `filas` o `huellas`, o aparece algo grave en producción | Restaurar el respaldo del paso C1 y volver al código anterior (abajo). |

```powershell
# Reversa completa (con el backend detenido, para que nadie escriba mientras se restaura)
docker compose stop backend frontend
docker exec pizzeria-db psql -U appuser -d postgres -c "DROP DATABASE appdb WITH (FORCE)"
docker exec pizzeria-db psql -U appuser -d postgres -c "CREATE DATABASE appdb OWNER appuser"
docker cp backups\appdb-final-AAAAMMDD-HHMM.dump pizzeria-db:/tmp/final.dump
docker exec pizzeria-db pg_restore -U appuser -d appdb --no-owner /tmp/final.dump
# Volver al código anterior (el commit/tag que desplegaste antes), con su docker-compose.yml, y levantar:
git checkout <commit-o-tag-anterior>
docker compose up -d --build backend frontend
```

Para poder hacerlo, **antes de C2 anota el commit que corre hoy en producción** (`git rev-parse HEAD`) o ponle un tag (`git tag produccion-antes-migracion`). Eso lo decides tú.
Nunca dejes correr el backend viejo sobre la base migrada para "probar".

---

## 10. Diagnóstico

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El backend se reinicia en bucle justo al desplegar | `synchronize` falló (el DDL se revirtió completo). En el log: `foreign key`/`violates` → bloqueantes sin corregir. | `docker compose logs --tail 80 backend`; corregir con §11; `docker compose restart backend`. |
| Un paso en `error` | Ver el motivo: `docker exec pizzeria-db psql -U appuser -d appdb -c "SELECT id, estado, resultado FROM migraciones_datos ORDER BY id"` | Arreglar la causa y `docker compose restart backend`: los pasos que no están en `ok` se reintentan en cada arranque. Los que dependen de él esperan. |
| Las pizzas/calzones no ofrecen sabores o no cobran recargo | `sabor-grupos-v1` (o `productos-categoria-v1`, del que depende) no terminó: los productos quedaron sin grupo de sabores. | Mismo diagnóstico de arriba; no vender hasta que `sabor-grupos-v1` esté en `ok`. |
| `/inventario/*` responde 503 | `inventario-unificado-v1` aún no terminó bien. Hasta entonces las ventas no descuentan stock. | Mismo diagnóstico de arriba. |
| Estadísticas de productos/sabores incompletas | `ventas-detalle-v1` sigue en segundo plano o terminó con errores. | `GET /estadisticas/analitica/calidad-datos` (pendientes, con error, sin producto, sin clasificar). |
| Paso en `en_progreso` tras un reinicio | Se retoma solo; marca cada fila procesada. | Nada. |
| Hay que apagar las migraciones | — | Variable `MIGRACIONES_DATOS_OFF=1` en el servicio `backend`: no corre ninguna (y entonces el inventario nuevo queda en 503). |

Herramientas (solo lectura; la sesión se abre con `default_transaction_read_only = on`). Desde el equipo de desarrollo con Node: `cd Backend` y
`$env:DOTENV_CONFIG_PATH='.env.ensayo'` (un archivo con las 5 variables `DATABASE_*`, ignorado por git), luego
`npm run migracion:auditar | migracion:linea-base -- --salida ../backups/base.json | migracion:verificar -- --base ../backups/base.json --esperar | migracion:precios`.

---

## 11. SQL de corrección de los bloqueantes

Guárdalo como `backups\corregir.sql` (ASCII), ajusta lo marcado y revisa con `SELECT` antes. Corre dentro de una transacción.

```sql
BEGIN;

-- 1) Domicilios con repartidor "vacio": quedan sin repartidor asignado.
UPDATE domicilios SET telefono_domiciliario_asignado = NULL WHERE telefono_domiciliario_asignado = '';

-- 2) Repartidor que consta SOLO en la columna heredada: copiarlo antes de que synchronize la borre.
UPDATE domicilios SET telefono_domiciliario_asignado = "domiciliarioTelefono"
 WHERE telefono_domiciliario_asignado IS NULL AND "domiciliarioTelefono" IS NOT NULL;

-- 3) Por CADA telefono huerfano que muestre la auditoria (domicilios cuyo repartidor no existe en domiciliarios), elegir UNA:
--    a) crear el domiciliario:
INSERT INTO domiciliarios (telefono, domiciliario_nombre) VALUES ('3000000000', 'Repartidor antiguo');
--    b) o corregir el telefono del domicilio si solo difiere en +57/espacios:
-- UPDATE domicilios SET telefono_domiciliario_asignado = '3001112233' WHERE telefono_domiciliario_asignado = '+57 300 111 2233';

COMMIT;
```

Después: `Migracion auditar` debe decir `Bloqueantes: 0`. Si el paso 2 dejó valores que difieren del actual, revísalos a mano antes de seguir.

---

## 12. Cambio de servidor: el equipo del servidor se formatea

Formatear borra el volumen `pizzeria-pgdata`: **el respaldo pasa a ser la única copia de las ventas**. Dos reglas:

1. **No se formatea hasta que el respaldo FINAL se haya restaurado y comparado en OTRO equipo** (semáforo de 12.5).
2. El servidor nuevo parte de cero: se instala, se **carga** el respaldo (que trae la estructura ANTERIOR) y se **migra** como en §5. No hay reversa de base ni de código
   (el equipo viejo ya no existe): el respaldo original es lo único que se conserva, por eso se guarda en dos lugares.

Tres scripts de PowerShell hacen lo delicado (carpeta `scripts\`; en un Windows recién instalado se llaman con `powershell -ExecutionPolicy Bypass -File …`):

| Script | Dónde | Qué hace |
|---|---|---|
| `respaldar-servidor.ps1` | servidor actual | Con `-DetenerBackend` detiene el backend. Cuenta las filas de cada tabla; hace `pg_dump` comprimido (`appdb.dump`) **y** SQL plano (`appdb.sql`) y comprueba que ambos se leen. Con `-Verificar` los **restaura en una base temporal y compara fila por fila**. Copia `.env` y compose (`secretos\`), anota IP, tareas de arranque, impresoras y cambios locales de git (`servidor\`) y calcula `SHA256.txt`. Todo en `backups\respaldo-<fecha>\`. |
| `cargar-respaldo.ps1` | servidor nuevo (o `-Contenedor ensayo-db`) | Verifica la huella SHA-256, levanta `db` y `redis` si hace falta, espera al Postgres definitivo, **se niega a borrar una base que ya tenga ventas** (salvo `-Forzar`), recrea `appdb` vacía, restaura y compara fila por fila con `conteos-origen.txt`. |
| `probar-scripts.ps1` | cualquier equipo | Prueba la lógica de estos scripts y de `docker-local.ps1` con un `docker` **simulado** (91 comprobaciones: éxito, huella alterada, base con ventas, `pg_restore` con errores, configuración local equivocada…). No ejecuta Docker; vuelve a correrlo si editas los scripts. |

> **Qué se probó:** la lógica con ese `docker` simulado y la sintaxis con el analizador de Windows PowerShell 5.1. **No se ejecutaron contra Docker real.**
> Por eso 12.3 (ensayarlos en el equipo de desarrollo) no es opcional.

### 12.1 Qué hay que salvar

| Qué | Dónde está | Cómo se salva |
|---|---|---|
| Ventas, clientes, caja, inventario, usuarios… | PostgreSQL, volumen `pizzeria-pgdata` | `respaldar-servidor.ps1` (dos formatos + conteos + SHA-256) |
| `DB_PASSWORD`, `JWT_SECRET`, `MAIL_*`, `CLOUDFLARE_TUNNEL_TOKEN`… | `.env` de la raíz (no está en git) | el script lo copia a `secretos\`; guárdalo en privado. El token del túnel también se recupera en el panel de Cloudflare Zero Trust (Tunnels). |
| El código nuevo | repositorio | commit y push **tuyos** (hoy está sin commitear en el equipo de desarrollo y los archivos nuevos necesitan `git add`), o una copia en USB sin `node_modules`. |
| Cambios locales del servidor que no estén en git | árbol de trabajo del servidor | el script guarda `servidor\git-cambios-locales.diff` |
| IP, arranque automático, impresoras | Windows | `servidor\*.txt` y la lista de 12.7 |
| Redis | volumen `pizzeria-redis-data` | **nada**: solo es el adaptador de Socket.IO |
| Archivos subidos | — | no hay: el backend no guarda archivos en disco |
| n8n, si alguna vez corrió | volumen `pizzeria-n8n-data` | míralo con `docker volume ls`; los flujos de `workflows/` ya están en git |

### 12.2 Antes del día D (sin parar nada)

1. Respaldo en caliente (`respaldar-servidor.ps1` sin `-DetenerBackend`) y ensayo completo de §4 con esa copia: así llegas al día D con `corregir.sql` listo y la duración medida.
2. Commit y push del código nuevo; comprueba que un `git clone` limpio trae `scripts\`, `Backend\src\common\migraciones-datos\` y este documento.
3. Deja en un USB los instaladores de Docker Desktop y Git para Windows. El primer `docker compose build` en el equipo nuevo **sí necesita internet** (descarga imágenes y paquetes: varios cientos de MB).
4. Anota la IP actual del servidor (`ipconfig`) y resérvala en el router; confirma que la virtualización está activada en la BIOS (Docker Desktop la necesita).
5. Fija el horario con el negocio cerrado. Planea varias horas sin servicio: lo que domina es reinstalar Windows y construir las imágenes; la carga y la migración de una base pequeña son minutos (mídelo en el ensayo).

### 12.3 Ensayar los scripts con Docker real (equipo de desarrollo)

```powershell
cd <carpeta-del-repo>
# a) El respaldo, contra la base de desarrollo (solo lee; con -Verificar crea y borra una base temporal)
docker compose up -d db
powershell -ExecutionPolicy Bypass -File scripts\respaldar-servidor.ps1 -Verificar

# b) La carga y la migración en el entorno local sin túnel (pos-local), con el paquete recién creado
powershell -ExecutionPolicy Bypass -File scripts\docker-local.ps1 ensayar -Paquete backups\respaldo-<fecha>
```

Si algo no funciona aquí, se corrige aquí: el día D no se improvisa. Al terminar: `scripts\docker-local.ps1 down` (o `reset -Confirmar` para borrar la base local).

### 12.4 Día D — respaldo final (en el servidor)

1. **Cierre del último día de operación.** El cierre automático corre a las 00:05; si el servidor va a estar apagado a esa hora, hazlo antes desde la pantalla de Cierre de caja (admin).
   El servidor nuevo solo recupera el cierre de AYER al arrancar, no el de días anteriores.
2. Sin ventas en curso:

```powershell
cd <carpeta-del-repo>
powershell -ExecutionPolicy Bypass -File scripts\respaldar-servidor.ps1 -DetenerBackend -Verificar
```

   Debe terminar en `LISTO`, sin ningún `[X]`, y mostrar las filas clave (facturas, órdenes, clientes…): confirma que son las de tu negocio. **Si algo sale en rojo, no formatees.**
3. Copia `backups\respaldo-<fecha>\` **entera** a dos lugares distintos (disco externo y nube privada u otro equipo). La carpeta `secretos\` trae claves: no la subas a un repositorio ni a un chat.
4. En cada copia compara las huellas: `Get-FileHash <copia>\appdb.dump -Algorithm SHA256` debe dar la misma que la línea de `SHA256.txt`.

### 12.5 Semáforo verde: todo debe cumplirse antes de formatear

- [ ] `respaldar-servidor.ps1 -DetenerBackend -Verificar` terminó en `LISTO`, sin `[X]`.
- [ ] Hay dos copias del paquete y las huellas coinciden en cada una.
- [ ] El `.dump` **final** se restauró en OTRO equipo y se ensayó la migración con él: `docker-local.ps1 ensayar -Paquete <copia>` terminó en «El ensayo paso»
      (su carga ya compara las filas con el original). Si el ensayo del 12.2 fue limpio y el código no cambió, basta con que la carga diga «mismas filas», pero **no** te la saltes.
- [ ] `.env` y token del túnel guardados; sabes entrar al panel de Cloudflare.
- [ ] El código nuevo está en el remoto o en el USB y se puede construir (12.2).
- [ ] Instaladores y notas (IP, impresoras, arranque) a la mano.

### 12.6 Servidor nuevo — la carga

1. Instala Windows, activa la virtualización, instala Docker Desktop (WSL2) y Git, y abre Docker Desktop hasta que diga *Engine running*.
2. Trae el código (clone o USB) y copia **tal cual** `secretos\.env` a la raíz del repo como `.env` (no lo abras y guardes con otro editor: trae BOM y comentarios con caracteres especiales).
   Si el servidor viejo tenía cambios locales (`servidor\git-cambios-locales.diff`), revísalos antes de seguir.
3. Carga el respaldo:

```powershell
cd <carpeta-del-repo>
powershell -ExecutionPolicy Bypass -File scripts\cargar-respaldo.ps1 -Paquete <ruta>\respaldo-<fecha>
```

   La base se **recrea vacía a propósito**: en el primer arranque el contenedor `db` la crea con `Backend\init.sql` y `Backend\seed-menu.sql` (estructura vieja y menú de ejemplo),
   y eso no debe mezclarse con los datos reales. Si falla (`[X]`): no sigas; el respaldo original no se tocó. Prueba con el otro formato (`-Paquete …\appdb.sql`) o mira el registro que imprime.
4. Migra (la base cargada tiene la estructura ANTERIOR; es §5 sin «detener backend» ni «git pull»):

```powershell
docker compose build backend
function Migracion { docker compose run --rm --no-deps -v "${PWD}\backups:/out" backend node dist/common/migraciones-datos/herramientas/cli.js @args }
Migracion auditar --salida /out/auditoria-servidor-nuevo.txt      # bloqueantes → §11
Migracion linea-base --salida /out/linea-base-servidor-nuevo.json
docker compose up -d                                              # backend, frontend (lo construye) y túnel
docker compose logs -f backend                                    # espera «successfully started» y «"sabor-grupos-v1" terminado»
Migracion verificar --base /out/linea-base-servidor-nuevo.json --esperar
```

5. Pruebas de humo de §6 y la lista de 12.7.

### 12.7 Con el servidor andando

- **Red:** reserva de IP en el router (los celulares y tablets pueden apuntar a la IP vieja); el `.env` (`CORS_ORIGINS`, `EXPO_PUBLIC_API_BASE_URL`) debe corresponder a la dirección real.
- **Túnel:** en el panel de Cloudflare el conector debe aparecer sano y `pos.d-firu.com` / `api.d-firu.com` deben abrir. No dejes encendido el servidor viejo con el mismo token.
- **Arranque tras un corte de luz:** BIOS en «encender al volver la corriente», inicio de sesión automático de Windows, Docker Desktop con «iniciar al iniciar sesión» (los contenedores ya tienen `restart: unless-stopped`) o `start-pos.bat` en la carpeta Inicio.
- **Equipo:** suspensión e hibernación desactivadas, zona horaria America/Bogotá, Windows Update fuera del horario del negocio, firewall abierto a la LAN para los puertos 3000 y 8081 si los dispositivos entran por IP.
- **Impresoras** (si el equipo también es caja): reinstala el controlador; mira `servidor\impresoras.txt`.
- **Respaldo diario desde el primer día:** programa `respaldar-servidor.ps1` en el Programador de tareas (sin parámetros hace un respaldo en caliente) y copia la carpeta fuera del equipo; `backups\` está en el mismo disco que la base.

### 12.8 Si el servidor nuevo se demora

El túnel de Cloudflare es saliente: cualquier equipo con Docker, el código y el `.env` puede servir `pos.d-firu.com` mientras tanto. Plan B en el equipo de desarrollo: `cargar-respaldo.ps1`, migrar como en 12.6 y `docker compose up -d`.
Necesita libres los puertos 3000, 8081 y 5433 y que no existan otros contenedores `pizzeria-*` con datos que quieras conservar (el script se niega a pisar una base con ventas, pero `docker compose up` usa los mismos nombres).

---

## Anexo A — Qué revisa la auditoría

`Migracion auditar` (solo lectura). Severidades: ⛔ bloqueante · ⚠️ atención · ℹ️ info. Código de salida 2 si hay bloqueantes.

| Id | Qué detecta |
|---|---|
| `domiciliario-huerfano` ⛔, `domiciliarioTelefono-con-datos` ⛔ | los dos que impiden el arranque (§1.1.1) |
| `estados-factura`, `metodos-factura` | estados/métodos que el sistema nuevo no reconoce (p. ej. `nequi`, `daviplata` → "otro") |
| `pagadas-sin-metodo`, `mixtas-sin-desglose`, `pagadas-montos-nulos` | facturas pagadas con método ausente o montos incompletos (el paso 4 completa lo deducible) |
| `transferencias-sin-cuenta`, `cuentas-solo-nombre`, `cuentas-duplicadas` | QR sin cuenta, facturas que solo guardaron el nombre, cuentas con el mismo nombre (el paso 3 no enlaza las ambiguas) |
| `ventas-orden-cancelada` | facturas no canceladas cuya orden sí lo está: dejan de contar como venta |
| `huerfanos`, `lineas`, `datos-de-prueba`, `caja-huerfana` | órdenes/facturas sin pareja, líneas sin variante, datos de seeders, efectivo en caja de facturas no cobradas |
| `telefonos`, `domiciliarios-usuarios`, `usuarios-roles` | teléfonos mal formados, usuario↔domiciliario que no se corresponden, usuarios sin rol |
| `sabores`, `calzone-sabores`, `variantes-pizza` | sabores repetidos, calzone sin sabores en `pizza_sabores`, variantes de pizza sin tamaño reconocible |
| `inventario-anterior`, `egresos`, `esquema-por-actualizar`, `columna-domiciliarioTelefono`, `volumen` | inventario que pasa, egresos por clasificar, tablas/columnas que creará `synchronize`, tamaño de lo que se migra |
| `cierre-de-ayer`, `configuracion-base` | si falta el cierre de ayer (se enviaría por correo al arrancar), cuentas y datos del negocio |

## Anexo B — Dónde está el código y cómo se prueba

- Pasos de datos: `Backend/src/common/migraciones-datos/pasos/` (registro ordenado en `index.ts`; **`sabor-grupos-v1` debe ir antes que `ventas-detalle-v1`**) y utilidades en `migraciones-datos.utils.ts` (`contarActualizadas`: `manager.query` devuelve `[filas, n]` en `UPDATE`/`DELETE`, no un conteo).
- Herramientas: `Backend/src/common/migraciones-datos/herramientas/` (`auditoria`, `linea-base`, `verificacion`, `paridad-precios`, `esquema`, `cli`). Compiladas quedan en `dist/common/migraciones-datos/herramientas/cli.js` y corren con `node` dentro de la imagen de producción.
- Pruebas contra PostgreSQL real (PGlite), desde `Backend/` con `npm test -- --testPathPatterns=<nombre>`:
  - `migracion-desde-estructura-anterior.sql.spec.ts`: el ensayo completo (estructura anterior + datos con anomalías → auditoría → bloqueantes → línea base → DDL → 6 pasos → verificación → precios).
  - `pasos-facturacion.sql.spec.ts`, `sabor-grupos-v1.spec.ts`, `parsear-linea-venta.spec.ts`: los pasos de datos y el parser del histórico.
- Dockerfile: la etapa `builder` usa `npm install` y no `npm ci` porque `Backend/package-lock.json` está desactualizado respecto a `package.json` (el lock real es el de la raíz del monorepo).
- Cambio de servidor (§12): `scripts/respaldar-servidor.ps1`, `scripts/cargar-respaldo.ps1` y sus funciones comunes `scripts/lib-respaldo.ps1`. Entorno local sin túnel: `scripts/docker-local.ps1` + `docker-compose.local.yml` + `docker-local.env`. `scripts/probar-scripts.ps1` prueba los tres con un `docker` simulado (no ejecuta Docker); al editar los scripts, vuelve a correrlo. Se guardan como UTF-8 con BOM y CRLF para que Windows PowerShell 5.1 lea bien las tildes.
- No dejes archivos `.ts` sueltos en la raíz de `Backend/`: `tsc` calcularía otra raíz común y la salida pasaría a `dist/src/main.js`, rompiendo el `CMD ["node", "dist/main.js"]` de la imagen.
