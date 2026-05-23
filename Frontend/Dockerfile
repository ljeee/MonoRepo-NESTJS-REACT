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
# Eliminar el .env de Frontend para no hardcodear URLs de producción en builds locales.
# La URL se inyecta via build arg; si está vacía, getBaseUrl() detecta el hostname en runtime.
RUN rm -f .env

# 3. Construir la aplicación (Web Export)
ARG EXPO_PUBLIC_API_BASE_URL=""
ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}
RUN npx expo export -p web --no-minify -c

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
