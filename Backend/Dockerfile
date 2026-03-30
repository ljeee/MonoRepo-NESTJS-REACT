# ============================================
# STAGE 1: Build
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Instalar Python y herramientas de compilación para dependencias nativas
RUN apk add --no-cache python3 build-base linux-headers eudev-dev

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluye devDependencies)
RUN npm install

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

# Instalar Python y herramientas de compilación para dependencias nativas
RUN apk add --no-cache python3 build-base linux-headers eudev-dev

# Copiar dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar build desde stage anterior
COPY --from=builder /app/dist ./dist

# Cambiar a usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/main.js"]
