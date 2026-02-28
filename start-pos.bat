@echo off
title POS Pizzería
color 0A
echo ==============================
echo    POS PIZZERIA - INICIANDO
echo ==============================
echo.

echo [1/2] Iniciando Docker...
docker-compose up -d
if %errorlevel% neq 0 (
  echo ERROR: ¿Esta Docker Desktop abierto?
  pause & exit /b 1
)

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
