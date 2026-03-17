# Frontend Expo Web Server
# ============================================
FROM node:20

WORKDIR /app

# Copiar root package files (necesarios para workspaces)
COPY package*.json ./

# Copiar packages compartidos (workspace dependencies)
COPY packages ./packages

# Copiar código completo del Frontend
COPY Frontend ./Frontend

# Instalar dependencias desde raíz
# Borramos el lockfile para forzar una resolución limpia en Linux (evita el bug de optional dependencies entre Windows/Linux)
RUN rm -f package-lock.json && npm install --legacy-peer-deps --include=optional --no-save

# Cambiar a directorio del Frontend
WORKDIR /app/Frontend

# Instalar 'serve' globalmente para servir los estáticos
RUN npm install -g serve

# Construir la versión estática de producción
RUN npx expo export -p web

# Exponer puerto
EXPOSE 8081

# Comando de inicio - servir la carpeta dist en el puerto 8081
CMD ["serve", "dist", "-p", "8081", "-s"]
