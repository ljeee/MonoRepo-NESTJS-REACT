# ============================================
# STAGE 1: Build (dependencias completas + compilación)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Herramientas de compilación para dependencias nativas (solo existen en esta etapa)
RUN apk add --no-cache python3 build-base linux-headers eudev-dev

COPY package*.json ./
# npm install (no ci): Backend/package-lock.json quedó desactualizado respecto a package.json (el lock real es el de la raíz del
# monorepo, que esta imagen no ve) y npm ci falla con "not in sync". Si regeneras el lock, se puede volver a npm ci.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Deja solo las dependencias de producción para copiarlas tal cual a la imagen final
RUN npm prune --omit=dev && npm cache clean --force

# ============================================
# STAGE 2: Development (opcional: docker build --target development)
# ============================================
FROM builder AS development

RUN npm install --no-audit --no-fund
CMD ["npm", "run", "start:dev"]

# ============================================
# STAGE 3: Production (imagen final, sin compiladores ni devDependencies)
# ============================================
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
