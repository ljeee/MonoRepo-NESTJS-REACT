# ============================================
# STAGE 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# ============================================
# STAGE 2: Production
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copiar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar build desde stage anterior
COPY --from=builder /app/dist ./dist

# Cambiar a usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main.js"]
