# ── ETAPA 1: Construcción (Builder) ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para compilación nativa en Alpine si fuera necesario
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 1. Copiar archivos de definición de dependencias (para cachear capas)
# Copiamos los archivos de la raíz (monorepo) y del frontend
COPY package*.json ./
COPY packages ./packages
COPY Frontend/package*.json ./Frontend/

# 2. Instalar dependencias (Sin borrar lockfile para usar cache)
# Usamos --legacy-peer-deps para evitar conflictos de versiones de React con Expo
RUN npm install --legacy-peer-deps --include=optional

# 3. Copiar el código fuente restante
COPY Frontend ./Frontend

# 4. Construir la aplicación (Web Export)
WORKDIR /app/Frontend
RUN npx expo export -p web

# ── ETAPA 2: Servidor de Producción (Runner) ──────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Instalar 'serve' para servir estáticos
RUN npm install -g serve

# Copiar solo el resultado del build desde la etapa anterior
COPY --from=builder /app/Frontend/dist ./dist

# Exponer el puerto
EXPOSE 8081

# Comando para servir la aplicación
CMD ["serve", "dist", "-p", "8081", "-s"]

