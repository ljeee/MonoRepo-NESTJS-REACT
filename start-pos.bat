@echo off
title POS Pizzería
color 0A
echo ==============================
echo    POS PIZZERIA - INICIANDO
echo ==============================
echo.

echo [1/3] Verificando Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo Iniciando Docker Desktop en el fondo...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  echo Esperando a que el motor arranque (esto puede tardar unos 20-30 seg)...
  :wait_docker
  timeout /t 5 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto wait_docker
  echo Docker Engine listo!
)

echo.
echo [2/3] Iniciando Contenedores...
docker-compose up -d

echo [2/2] Esperando servicios (5 seg)...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================
echo   SISTEMA LISTO 
echo   Backend:   http://localhost:3000
echo   Frontend:  http://localhost:8081
echo   Swagger:   http://localhost:3000/swagger
echo ===============================================
pause
