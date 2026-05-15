# ── ETAPA 1: Construcción (Builder) ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Instalar dependencias necesarias para compilación nativa en Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 1. Copiar el paquete compartido (shared)
COPY packages/shared ./packages/shared

# 2. Copiar archivos del Frontend
COPY Frontend/package.json Frontend/package-lock.json* ./Frontend/

# 3. Reemplazar la referencia de workspace "@monorepo/shared": "*"
#    por una referencia local "file:" para que npm la resuelva sin workspaces
WORKDIR /app/Frontend
RUN sed -i 's|"@monorepo/shared": "\*"|"@monorepo/shared": "file:../packages/shared"|g' package.json

# 4. Instalar dependencias SOLO del Frontend (sin hoisting de monorepo)
RUN npm install --legacy-peer-deps

# 5. Copiar el código fuente restante del Frontend
COPY Frontend/ ./

# 6. Construir la aplicación (Web Export)
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
