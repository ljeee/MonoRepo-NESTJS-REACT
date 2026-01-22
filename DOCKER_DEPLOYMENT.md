# 🍕 Pizzería MonoRepo - Guía de Deployment Docker

## 📋 Arquitectura

```
┌─────────────────────────────────────────┐
│        Red Local (WiFi/LAN)             │
│                                         │
│  ┌──────────┐      ┌──────────┐        │
│  │ Celular  │      │   PC     │        │
│  │          │◄────►│ (Host)   │        │
│  └──────────┘      └─────┬────┘        │
│                          │             │
│              ┌───────────▼──────────┐  │
│              │   Docker Network      │  │
│              │   172.28.0.0/16      │  │
│              │                      │  │
│              │  ┌─────────────┐    │  │
│              │  │  Traefik    │    │  │
│              │  │ 172.28.0.5  │    │  │
│              │  │ Port: 80    │    │  │
│              │  └──────┬──────┘    │  │
│              │         │           │  │
│              │  ┌──────▼──────┐    │  │
│              │  │ PostgreSQL  │    │  │
│              │  │ 172.28.0.10 │    │  │
│              │  └──────┬──────┘    │  │
│              │         │           │  │
│              │  ┌──────▼──────┐    │  │
│              │  │  Backend    │    │  │
│              │  │ 172.28.0.20 │    │  │
│              │  │ Port: 3000  │    │  │
│              │  └──────┬──────┘    │  │
│              │         │           │  │
│              │  ┌──────▼──────┐    │  │
│              │  │  Frontend   │    │  │
│              │  │ 172.28.0.30 │    │  │
│              │  │ Port: 8081  │    │  │
│              │  └─────────────┘    │  │
│              └─────────────────────┘  │
└─────────────────────────────────────────┘
```

## 🚀 Inicio Rápido

### 0. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
# Telegram Bot (opcional)
TELEGRAM_BOT_TOKEN=tu_token_aqui

# Impresora térmica (opcional)
PRINTER_ENABLED=false
PRINTER_PATH=/dev/usb/lp0
```

### 1. Verificar Docker
```powershell
docker --version
docker-compose --version
```

### 2. Levantar servicios
```powershell
# Solo base de datos (desarrollo local)
docker-compose up db -d

# Stack completo (producción)
docker-compose up -d --build
```

### 3. Verificar servicios
```powershell
docker-compose ps
docker-compose logs -f
```

## 🌐 Acceso a los Servicios

### Acceso Unificado con Traefik (Recomendado)
- **Todo en uno**: http://localhost (o http://TU_IP_LOCAL)
- **Dashboard Traefik**: http://localhost:8080
- Backend automáticamente en: http://localhost/api
- Frontend automáticamente en: http://localhost/

### Acceso Directo (puertos individuales)
Desde tu PC (localhost)
- Frontend: http://localhost:8081
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/api
- PostgreSQL: localhost:5433

### Desde dispositivos en la red local
**Primero, obtén tu IP local:**
```powershell
ipconfig | findstr /i "IPv4"
```

**Ejemplo:** Si tu IP es `192.168.1.50`
- **Acceso unificado**: http://192.168.1.50
- Frontend: http://192.168.1.50:8081
- Backend: http://192.168.1.50:3000
- Swagger: http://192.168.1.50:3000/api

> 🎯 **Con Traefik solo necesitas recordar una URL:** `http://TU_IP` y todo funciona automáticamente.

## 🖨️ Configuración de Impresora Térmica

### Requisitos
- Impresora térmica compatible con ESC/POS (ej: Epson TM-T20, TM-T88)
- Cable USB conectado al PC/servidor

### Configuración en Linux
1. Identificar dispositivo:
```bash
lsusb
ls -la /dev/usb/
```

2. Dar permisos (reemplazar con tu dispositivo):
```bash
sudo chmod 666 /dev/usb/lp0
# O crear regla udev permanente
sudo nano /etc/udev/rules.d/99-printer.rules
# Agregar: SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", MODE="0666"
sudo udevadm control --reload-rules
```

3. Actualizar `.env`:
```env
PRINTER_ENABLED=true
PRINTER_PATH=/dev/usb/lp0
```

### Configuración en Windows
1. Identificar puerto COM o usar driver USB
2. Actualizar `.env`:
```env
PRINTER_ENABLED=true
PRINTER_PATH=COM3
```

### Uso
Al crear una orden, agregar el campo `imprimirRecibo: true`:
```json
{
  "nombreCliente": "Juan Pérez",
  "productos": [...],
  "imprimirRecibo": true
}
```

## 📱 Configuración de Notificaciones Telegram

### 1. Crear Bot de Telegram
1. Hablar con [@BotFather](https://t.me/botfather) en Telegram
2. Ejecutar `/newbot` y seguir instrucciones
3. Copiar el token que te da

### 2. Configurar el token
Actualizar `.env`:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### 3. Obtener Chat ID del domiciliario
Cada domiciliario debe:
1. Buscar tu bot en Telegram y darle "Start"
2. Enviar un mensaje al bot
3. Tú consultas el chat_id visitando:
```
https://api.telegram.org/bot<TU_TOKEN>/getUpdates
```

### 4. Mapeo teléfono → chat_id
**Opción A: Hardcodear en código** (temporal)
Editar `Backend/src/common/telegram.service.ts`:
```typescript
async getChatIdFromPhone(phone: string): Promise<string | null> {
  const mapping = {
    '3001234567': '123456789',
    '3009876543': '987654321',
  };
  return mapping[phone] || null;
}
```

**Opción B: Base de datos** (recomendado para producción)
Agregar tabla `domiciliarios_telegram` con columnas:
- telefono
- chat_id
- activo

### 5. Uso
Las notificaciones se envían automáticamente al crear domicilios con `tipoPedido: 'domicilio'`.

## 🔧 Configuración de Red

### IPs Fijas Internas (Docker)
- Gateway: 172.28.0.1
- Traefik: 172.28.0.5
- DB: 172.28.0.10
- Backend: 172.28.0.20
- Frontend: 172.28.0.30

### Abrir puertos en Firewall (Windows)
**Ejecutar como Administrador:**
```powershell
# Traefik (puerto unificado)
netsh advfirewall firewall add rule name="Traefik Gateway" dir=in action=allow protocol=tcp localport=80

# Traefik Dashboard
netsh advfirewall firewall add rule name="Traefik Dashboard" dir=in action=allow protocol=tcp localport=8080

# Backend (acceso directo opcional)
netsh advfirewall firewall add rule name="Backend NestJS" dir=in action=allow protocol=tcp localport=3000

# Frontend (acceso directo opcional)
netsh advfirewall firewall add rule name="Frontend Expo" dir=in action=allow protocol=tcp localport=8081

# PostgreSQL (opcional, para herramientas externas)
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=tcp localport=5433
```

## 📱 Acceso desde Celular

1. **Conecta el celular a la misma red WiFi** que tu PC
2. **Obtén la IP de tu PC** (ver comando arriba)
3. **Abre el navegador** en el celular
4. **Ingresa:** `http://TU_IP:8081`

**Ejemplo:** `http://192.168.1.50:8081`

## 📱 Acceso óptimo desde celular (red local)

### Requisitos
- Celular y PC conectados a la misma red WiFi/LAN
- Backend y frontend corriendo en Docker
- Puertos 3000 (backend) y 8081 (frontend) abiertos en el firewall
- IP local del PC preferiblemente estática (configurada en el router)

### Configuración recomendada
- **Backend:** Escuchar en `0.0.0.0` (ya configurado)
- **Frontend:** Detecta automáticamente la IP del backend usando `window.location.hostname` (ya configurado)
- **Docker Compose:** Exponer puertos 3000 y 8081
- **Firewall:** Abrir puertos 3000 y 8081
- **Router:** Reservar la IP local del PC para evitar cambios

### Acceso desde el celular
1. Obtén la IP local del PC (ejemplo: `192.168.1.1`)
2. Abre el navegador en el celular
3. Ingresa la URL del frontend: `http://192.168.1.1:8081`
4. El frontend se comunicará automáticamente con el backend en `http://192.168.1.1:3000`

### Estándares y buenas prácticas
- No hardcodear IPs, usar detección automática
- Usar CORS seguro en backend
- Documentar el proceso para usuarios finales
- Usar HTTPS si se requiere seguridad adicional
- Mantener la IP del PC fija en el router

### Troubleshooting
- Si la IP del PC cambia, obtén la nueva con `ipconfig` y accede usando esa IP
- Si el celular no accede, verifica firewall y red
- Si usas Docker Desktop, asegúrate que esté corriendo

---

## 🛠️ Comandos Útiles

### Gestión de contenedores
```powershell
# Ver logs específicos
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Reiniciar un servicio
docker-compose restart backend

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (limpieza completa)
docker-compose down -v

# Reconstruir imágenes
docker-compose build --no-cache
docker-compose up -d
```

### Desarrollo local (sin Docker)
```powershell
# Backend
cd Backend
npm install
npm run start:dev

# Frontend
cd Frontend
npm install
npm run web
```

## 🔒 IP Estática (Recomendado)

Para evitar que cambien las IPs cada vez que reinicias el router:

### Opción 1: Configurar IP estática en el router
1. Accede al panel de tu router (generalmente `192.168.1.1` o `192.168.0.1`)
2. Busca "DHCP Reservation" o "Reserva de IP"
3. Asigna una IP fija a tu PC usando su MAC address

### Opción 2: IP estática en Windows
```powershell
# Ver adaptadores de red
Get-NetAdapter

# Configurar IP estática (ajusta valores según tu red)
New-NetIPAddress -InterfaceAlias "Wi-Fi" -IPAddress 192.168.1.50 -PrefixLength 24 -DefaultGateway 192.168.1.1
Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses 8.8.8.8,8.8.4.4
```

## ⚠️ Troubleshooting

### Traefik no enruta correctamente
- Verificar labels en `docker-compose.yml`
- Ver logs: `docker-compose logs -f traefik`
- Acceder al dashboard: http://localhost:8080
- Verificar que los servicios tengan `traefik.enable=true`

### Impresora no imprime
- Verificar conexión USB: `lsusb` (Linux) o Device Manager (Windows)
- Comprobar permisos: `ls -la /dev/usb/` (Linux)
- Ver logs del backend: `docker-compose logs -f backend`
- Verificar `PRINTER_ENABLED=true` en `.env`
- Probar impresión de prueba directa con `echo "test" > /dev/usb/lp0`

### Telegram no envía notificaciones
- Verificar token válido: `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Comprobar que el domiciliario inició el bot
- Ver logs: `docker-compose logs -f backend | grep -i telegram`
- Verificar mapeo teléfono → chat_id en el código
- Probar manualmente: `curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" -d "chat_id=<CHAT_ID>&text=test"`

### El celular no puede conectarse
- ✅ Verifica que estén en la misma red WiFi
- ✅ Verifica el firewall (ver comandos arriba)
- ✅ Prueba hacer ping desde el celular a la IP del PC
- ✅ Verifica que los contenedores estén corriendo: `docker-compose ps`

### Error "Cannot connect to Docker daemon"
- Inicia Docker Desktop
- Espera a que el icono muestre "Running" (ballena verde)

### Cambió la IP y dejó de funcionar
- Obtén la nueva IP: `ipconfig | findstr /i "IPv4"`
- Accede con la nueva IP: `http://NUEVA_IP:8081`
- El frontend se adaptará automáticamente

### Limpiar todo y empezar de nuevo
```powershell
docker-compose down -v
docker system prune -a --volumes
docker-compose up -d --build
```

## 📊 Monitoreo

### Ver uso de recursos
```powershell
docker stats
```

### Ver espacio usado
```powershell
docker system df
```

## 🔐 Seguridad

Para producción real (no solo red local):
- Cambiar contraseñas de la base de datos
- Usar HTTPS con certificados SSL
- Configurar variables de entorno seguras
- Limitar acceso con firewall más restrictivo

## 📝 Variables de Entorno

### Backend (.env raíz del proyecto)
```env
# Base de datos
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=appuser
DATABASE_PASSWORD=apppass
DATABASE_NAME=appdb

# Servidor
PORT=3000
NODE_ENV=development
HOST=0.0.0.0

# Telegram (opcional)
TELEGRAM_BOT_TOKEN=

# Impresora térmica (opcional)
PRINTER_ENABLED=false
PRINTER_PATH=/dev/usb/lp0
```

### Frontend (.env)
```env
# Opcional, se detecta automáticamente
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000
```

## 📚 Stack Tecnológico

- **API Gateway**: Traefik v2.11
- **Backend**: NestJS (Node.js + TypeScript)
- **Frontend**: Expo Web (React Native)
- **Base de datos**: PostgreSQL 16
- **Servidor web**: Nginx (para frontend)
- **Notificaciones**: Telegram Bot API
- **Impresión**: ESC/POS (escpos)
- **Orquestación**: Docker Compose

## 🔄 Flujo de Orden Completo

1. **Cliente crea orden** (POST /api/ordenes)
2. **Backend procesa**:
   - Crea factura
   - Guarda orden
   - Vincula productos
   - Si es domicilio: crea registro de domicilio
3. **Callbacks opcionales**:
   - Si `imprimirRecibo: true` → Imprime en impresora térmica
   - Si es domicilio → Envía notificación a Telegram del domiciliario
4. **Domiciliario recibe notificación** con:
   - Datos del cliente
   - Dirección
   - Productos
   - Observaciones

---

**¿Preguntas?** Revisa los logs: `docker-compose logs -f`
