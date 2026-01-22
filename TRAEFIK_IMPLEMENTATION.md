# 🚀 Implementación Traefik + Callbacks (Impresión + Telegram)

## ✅ Resumen de Cambios

### 1. **Traefik como API Gateway**
- ✅ Servicio Traefik agregado en `docker-compose.yml`
- ✅ Puerto unificado: **80** (acceso a todo el stack)
- ✅ Dashboard: **8080** (monitoreo de rutas)
- ✅ Labels configurados en backend y frontend para enrutamiento automático
- ✅ Backend accesible en: `http://TU_IP/api`
- ✅ Frontend accesible en: `http://TU_IP/`

### 2. **Servicio de Impresión Térmica**
- ✅ Archivo: `Backend/src/common/printing.service.ts`
- ✅ Soporte para impresoras ESC/POS
- ✅ Dependencias: `escpos`, `escpos-usb`
- ✅ Configurable via `.env`: `PRINTER_ENABLED`, `PRINTER_PATH`
- ✅ Lazy loading para evitar errores si no está instalada
- ✅ Imprime recibo con datos de orden completos

### 3. **Servicio de Notificaciones Telegram**
- ✅ Archivo: `Backend/src/common/telegram.service.ts`
- ✅ Dependencia: `node-telegram-bot-api`
- ✅ Configurable via `.env`: `TELEGRAM_BOT_TOKEN`
- ✅ Envía notificación formateada al domiciliario
- ✅ Mapeo dinámico teléfono → chat_id
- ✅ Lazy loading para evitar errores si no está instalada

### 4. **Integración en Servicios**
- ✅ `ordenes.service.ts`: Callbacks para impresión y notificación Telegram
- ✅ `domicilios.service.ts`: Método para notificar cambios de estado
- ✅ Módulos actualizados con providers de servicios comunes
- ✅ Callbacks opcionales activables por parámetro `imprimirRecibo: true`

### 5. **Dependencias Agregadas**
```json
"escpos": "^3.0.0-alpha.6",
"escpos-usb": "^3.0.0-alpha.4",
"node-telegram-bot-api": "^0.64.0"
```

### 6. **Documentación**
- ✅ `DOCKER_DEPLOYMENT.md` actualizado con:
  - Arquitectura con Traefik
  - Guía de configuración de impresora
  - Guía de configuración de Telegram
  - Troubleshooting completo
  - Flujo de orden con callbacks
- ✅ `.env.example` creado con todas las variables

## 🔧 Instalación

### 1. Instalar dependencias backend
```bash
cd Backend
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus valores
```

### 3. Levantar stack con Traefik
```bash
docker-compose up -d --build
```

### 4. Verificar Traefik
```bash
# Ver dashboard
http://localhost:8080

# Ver logs
docker-compose logs -f traefik
```

## 📱 Uso de Callbacks

### Impresión de Recibo
Agregar campo al crear orden:
```json
POST /api/ordenes
{
  "nombreCliente": "Juan Pérez",
  "productos": [...],
  "imprimirRecibo": true
}
```

### Notificación Telegram
Configurar mapeo en `telegram.service.ts`:
```typescript
async getChatIdFromPhone(phone: string): Promise<string | null> {
  const mapping: Record<string, string> = {
    '3001234567': '123456789',
    '3009876543': '987654321',
  };
  return mapping[phone] || null;
}
```

Luego, al crear orden con domicilio, automáticamente notifica:
```json
POST /api/ordenes
{
  "tipoPedido": "domicilio",
  "telefonoDomiciliario": "3001234567",
  "telefonoCliente": "3111234567",
  "direccionCliente": "Calle 123",
  "productos": [...]
}
```

## 🎯 Flujo Completo

1. **Cliente crea orden** → POST `/api/ordenes`
2. **Backend procesa**:
   - Crea factura
   - Guarda orden
   - Vincula productos
   - Si domicilio: crea registro
3. **Callbacks**:
   - Si `imprimirRecibo: true` → 🖨️ Imprime recibo
   - Si domicilio → 📱 Notifica por Telegram
4. **Domiciliario recibe notificación** con todos los datos

## 📊 Acceso desde Celular

### Con Traefik (Recomendado)
1. Obtener IP del PC: `ipconfig`
2. Ejemplo: `192.168.1.50`
3. Abrir en celular: `http://192.168.1.50`
4. ✅ Frontend y backend funcionan automáticamente

### Sin Traefik (Directo)
- Frontend: `http://192.168.1.50:8081`
- Backend: `http://192.168.1.50:3000`

## 🔍 Verificación

```bash
# Ver todos los contenedores
docker-compose ps

# Ver logs de todos los servicios
docker-compose logs -f

# Ver solo backend
docker-compose logs -f backend

# Ver solo Traefik
docker-compose logs -f traefik

# Dashboard de Traefik
http://localhost:8080
```

## 🚨 Troubleshooting

Ver sección completa en `DOCKER_DEPLOYMENT.md`

### Problemas comunes:
- **Traefik no enruta**: Verificar labels en docker-compose
- **Impresora no imprime**: Verificar permisos USB y PRINTER_ENABLED
- **Telegram no envía**: Verificar token y mapeo chat_id

## 📝 Próximos Pasos

1. ✅ Instalar dependencias: `cd Backend && npm install`
2. ✅ Configurar `.env` con valores reales
3. ✅ Crear bot de Telegram (@BotFather)
4. ✅ Obtener chat_ids de domiciliarios
5. ✅ Configurar mapeo en `telegram.service.ts`
6. ✅ Conectar impresora térmica (opcional)
7. ✅ Probar acceso desde celular

## 💡 Mejoras Futuras

- [ ] Mapeo dinámico Telegram desde base de datos
- [ ] HTTPS con Let's Encrypt en Traefik
- [ ] Load balancing si se agregan más instancias
- [ ] Middlewares de autenticación en Traefik
- [ ] Rate limiting
- [ ] Compresión y caching

---

**Documentación completa**: Ver `DOCKER_DEPLOYMENT.md`
