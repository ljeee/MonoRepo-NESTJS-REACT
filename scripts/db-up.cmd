@echo off
REM Start Postgres DB via Docker Compose
cd /d %~dp0..
docker compose up -d db
if %ERRORLEVEL% NEQ 0 (
  echo Failed to start DB service.
  exit /b 1
)
echo DB is starting. Use "docker compose logs -f db" to follow logs.
