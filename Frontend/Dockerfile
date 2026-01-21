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

# Exportar aplicación web (la detección de URL es dinámica en runtime)
RUN npx expo export -p web

# ============================================
# STAGE 2: Production
# ============================================
FROM nginx:alpine AS production

# Copiar build de Expo Web
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto
EXPOSE 8081

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
