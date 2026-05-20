# ── ETAPA 1: Construcción (Builder) ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para compilación nativa en Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app/Frontend

# 1. Copiar manifiestos e instalar dependencias
COPY Frontend/package.json Frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

# 2. Copiar el código fuente del Frontend
COPY Frontend/ ./

# 3. Construir la aplicación (Web Export)
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
