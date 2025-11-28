@echo off
REM Stop Postgres DB via Docker Compose
cd /d %~dp0..
docker compose down --volumes --remove-orphans
