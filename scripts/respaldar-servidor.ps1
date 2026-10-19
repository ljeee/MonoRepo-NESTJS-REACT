<#
.SYNOPSIS
  Respaldo COMPLETO del servidor del POS antes de formatearlo (o de migrar): la base en dos formatos, conteos de control,
  secretos (.env, token del tunel), inventario del equipo y huellas SHA-256, todo en una carpeta backups\respaldo-<fecha>.

.DESCRIPTION
  Pensado para correrse en el equipo del servidor, en la carpeta del repo, con Docker Desktop encendido.
  Es de SOLO LECTURA sobre la base de produccion (pg_dump); con -Verificar crea y borra una base temporal en el mismo contenedor.

.PARAMETER DetenerBackend
  Detiene el backend ANTES de respaldar (nadie escribe durante el respaldo). Usalo siempre en el respaldo FINAL.
.PARAMETER Verificar
  Restaura el respaldo en una base temporal del mismo contenedor y compara el numero de filas de cada tabla.
.PARAMETER SinSecretos
  No copia los .env ni el docker-compose.yml.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\respaldar-servidor.ps1 -DetenerBackend -Verificar
#>
[CmdletBinding()]
param(
	[string]$Destino = (Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'),
	[string]$Contenedor = 'pizzeria-db',
	[string]$Usuario = 'appuser',
	[string]$Base = 'appdb',
	[switch]$DetenerBackend,
	[switch]$Verificar,
	[switch]$SinSecretos
)

. (Join-Path $PSScriptRoot 'lib-respaldo.ps1')
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

# ── 1. Docker y contenedor ───────────────────────────────────────────────────────────────────────
Paso 'Comprobando Docker y la base de datos'
Probar-Docker
if (-not (Contenedor-Corriendo $Contenedor)) {
	Falla "El contenedor $Contenedor no esta corriendo. Enciendelo (docker compose up -d db) y repite."
}
Ok "$Contenedor esta corriendo"

if ($DetenerBackend) {
	Paso 'Deteniendo el backend (nadie escribe mientras se respalda)'
	docker compose stop backend
	Revisar 'docker compose stop backend'
	Ok 'Backend detenido: el POS queda sin API hasta que lo vuelvas a encender'
}
elseif (Contenedor-Corriendo 'pizzeria-backend') {
	Aviso 'El backend sigue corriendo: esto es un respaldo EN CALIENTE (sirve para ensayar). Para el respaldo FINAL repite con -DetenerBackend.'
}

# ── 2. Carpeta del respaldo ──────────────────────────────────────────────────────────────────────
$marca = Get-Date -Format 'yyyyMMdd-HHmm'
$Carpeta = Join-Path $Destino "respaldo-$marca"
$n = 1
while (Test-Path -LiteralPath $Carpeta) { $n++; $Carpeta = Join-Path $Destino "respaldo-$marca-$n" }
New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null
$Carpeta = (Resolve-Path -LiteralPath $Carpeta).Path
Ok "Carpeta del respaldo: $Carpeta"

# ── 3. Conteos de control ────────────────────────────────────────────────────────────────────────
Paso 'Contando las filas de cada tabla (para compararlas despues de restaurar)'
$conteos = Obtener-Conteos $Contenedor $Usuario $Base
Set-Content -LiteralPath (Join-Path $Carpeta 'conteos-origen.txt') -Value $conteos -Encoding ascii
$totalFilas = ($conteos | ForEach-Object { [int64]($_.Split('|')[1]) } | Measure-Object -Sum).Sum
Ok ('{0} tablas, {1} filas en total' -f @($conteos).Count, $totalFilas)

# ── 4. Los dos respaldos ─────────────────────────────────────────────────────────────────────────
Paso 'Generando el respaldo (formato comprimido y SQL plano)'
docker exec $Contenedor pg_dump -U $Usuario -d $Base -Fc -f /tmp/respaldo.dump
Revisar 'pg_dump (formato comprimido)'
docker exec $Contenedor pg_dump -U $Usuario -d $Base --no-owner --no-privileges -f /tmp/respaldo.sql
Revisar 'pg_dump (SQL plano)'
docker exec $Contenedor pg_restore -l /tmp/respaldo.dump | Out-Null
Revisar 'leer el respaldo comprimido (pg_restore -l)'
docker cp "${Contenedor}:/tmp/respaldo.dump" (Join-Path $Carpeta 'appdb.dump') | Out-Null
Revisar 'copiar appdb.dump'
docker cp "${Contenedor}:/tmp/respaldo.sql" (Join-Path $Carpeta 'appdb.sql') | Out-Null
Revisar 'copiar appdb.sql'
docker exec $Contenedor rm -f /tmp/respaldo.dump /tmp/respaldo.sql | Out-Null

$archivoDump = Join-Path $Carpeta 'appdb.dump'
$archivoSql = Join-Path $Carpeta 'appdb.sql'
$tamDump = (Get-Item -LiteralPath $archivoDump).Length
if ($tamDump -lt 1024) { Falla "appdb.dump pesa solo $tamDump bytes: algo salio mal." }
$cola = @(Get-Content -LiteralPath $archivoSql -Tail 5)
if (-not ($cola -match 'PostgreSQL database dump complete')) { Falla 'appdb.sql esta incompleto (no termina con la marca "dump complete").' }
Ok ('appdb.dump {0} (se puede leer) y appdb.sql {1} (completo)' -f (Tamano $tamDump), (Tamano (Get-Item -LiteralPath $archivoSql).Length))

# ── 5. Prueba de restauracion (opcional) ─────────────────────────────────────────────────────────
if ($Verificar) {
	$tmpDb = 'verif_' + (Get-Date -Format 'yyyyMMddHHmmss')
	Paso "Probando que el respaldo SE PUEDE RESTAURAR (base temporal $tmpDb en $Contenedor)"
	$fallo = $null
	try {
		docker exec $Contenedor psql -U $Usuario -d postgres -c "CREATE DATABASE $tmpDb OWNER $Usuario" | Out-Null
		if ($LASTEXITCODE -ne 0) { throw 'no se pudo crear la base temporal' }
		docker cp $archivoDump "${Contenedor}:/tmp/verif.dump" | Out-Null
		if ($LASTEXITCODE -ne 0) { throw 'no se pudo copiar el respaldo al contenedor' }
		$cmd = 'pg_restore -U {0} -d {1} --no-owner --no-privileges /tmp/verif.dump > /tmp/verif.log 2>&1; echo $?' -f $Usuario, $tmpDb
		$codigo = "$(docker exec $Contenedor sh -c $cmd | Select-Object -Last 1)".Trim()
		if ($codigo -ne '0') {
			Aviso 'pg_restore reporto problemas. Ultimas lineas de su registro:'
			docker exec $Contenedor tail -n 15 /tmp/verif.log
			throw "pg_restore termino con codigo $codigo"
		}
		$copia = Obtener-Conteos $Contenedor $Usuario $tmpDb
		$dif = @(Comparar-Conteos $conteos $copia)
		if ($dif.Count -gt 0) { throw ('las filas no coinciden en: ' + ($dif -join '; ')) }
	}
	catch {
		$fallo = $_.Exception.Message
	}
	finally {
		docker exec $Contenedor psql -U $Usuario -d postgres -c "DROP DATABASE IF EXISTS $tmpDb WITH (FORCE)" | Out-Null
		docker exec $Contenedor rm -f /tmp/verif.dump /tmp/verif.log | Out-Null
	}
	if ($fallo) {
		if (Contenedor-Corriendo 'pizzeria-backend') {
			Aviso 'El backend esta corriendo: una diferencia pequena puede ser una venta entrante. Repite con -DetenerBackend.'
		}
		Falla "La prueba de restauracion FALLO: $fallo"
	}
	Ok "Restauracion probada: las $(@($conteos).Count) tablas quedaron con exactamente las mismas filas. La base temporal ya se borro."
}

# ── 6. Secretos y configuracion ──────────────────────────────────────────────────────────────────
if (-not $SinSecretos) {
	Paso 'Copiando secretos y configuracion (.env, token del tunel, docker-compose.yml)'
	$sec = Join-Path $Carpeta 'secretos'
	New-Item -ItemType Directory -Force -Path $sec | Out-Null
	foreach ($rel in @('.env', 'Backend\.env', 'Backend\.env.docker', 'Backend\.env.local', 'docker-compose.yml')) {
		$ruta = Join-Path $Raiz $rel
		if (Test-Path -LiteralPath $ruta) {
			Copy-Item -LiteralPath $ruta -Destination (Join-Path $sec ($rel -replace '[\\/]', '__')) -Force
			Ok "copiado $rel"
		}
		else {
			Aviso "no existe $rel (se omite)"
		}
	}
	if (-not (Test-Path -LiteralPath (Join-Path $Raiz '.env'))) {
		Aviso 'NO hay .env en la raiz del repo: busca DB_PASSWORD, JWT_SECRET y CLOUDFLARE_TUNNEL_TOKEN en otro lado ANTES de formatear.'
	}
	Aviso 'La carpeta "secretos" trae claves y el token del tunel de Cloudflare: guardala en un lugar privado (no en git, no en un chat).'
}

# ── 7. Inventario del equipo ─────────────────────────────────────────────────────────────────────
Paso 'Anotando como esta armado este equipo (para dejar el nuevo igual)'
$inv = Join-Path $Carpeta 'servidor'
New-Item -ItemType Directory -Force -Path $inv | Out-Null
function Guardar($nombre, [scriptblock]$bloque) {
	try {
		& $bloque | Out-File -LiteralPath (Join-Path $inv $nombre) -Encoding utf8 -Width 250
		Ok "servidor\$nombre"
	}
	catch {
		"No disponible: $($_.Exception.Message)" | Out-File -LiteralPath (Join-Path $inv $nombre) -Encoding utf8
		Aviso "servidor\$nombre no disponible"
	}
}
Guardar 'docker.txt' { docker ps -a; docker volume ls; docker images }
Guardar 'red.txt' { ipconfig /all }
Guardar 'arranque.txt' {
	'--- Carpeta Inicio (Startup) ---'
	Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" -ErrorAction SilentlyContinue | Select-Object Name
	'--- Tareas programadas que no son de Microsoft ---'
	Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | Select-Object TaskName, State
}
Guardar 'impresoras.txt' { Get-Printer | Select-Object Name, DriverName, PortName }
if ((Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath (Join-Path $Raiz '.git'))) {
	Guardar 'git.txt' { 'commit: ' + (git rev-parse HEAD); git remote -v; '--- cambios locales (git status) ---'; git status --short }
	Guardar 'git-cambios-locales.diff' { git diff HEAD }
}

# ── 8. Huellas SHA-256 ───────────────────────────────────────────────────────────────────────────
Paso 'Calculando las huellas SHA-256 (para comprobar que las copias no se danaron)'
$lineas = Get-ChildItem -LiteralPath $Carpeta -Recurse -File | Where-Object { $_.Name -ne 'SHA256.txt' } | ForEach-Object {
	'{0}  {1}' -f (Hash-Archivo $_.FullName), $_.FullName.Substring($Carpeta.Length + 1)
}
Set-Content -LiteralPath (Join-Path $Carpeta 'SHA256.txt') -Value $lineas -Encoding ascii
Ok "SHA256.txt con $(@($lineas).Count) archivos"

# ── 9. Resumen ───────────────────────────────────────────────────────────────────────────────────
Paso 'LISTO'
Get-ChildItem -LiteralPath $Carpeta -Recurse -File | ForEach-Object {
	Write-Host ('   {0,-34} {1,10}' -f $_.FullName.Substring($Carpeta.Length + 1), (Tamano $_.Length))
}
Write-Host ''
Write-Host "Carpeta: $Carpeta" -ForegroundColor Green
$clave = @($conteos | Where-Object { $_ -match '^(facturas_ventas|ordenes|ordenes_productos|clientes|users|facturas_pagos|caja_movimientos)\|' })
if ($clave.Count -gt 0) { Write-Host ('Filas clave (confirma que es la base correcta): ' + (($clave | ForEach-Object { $_.Replace('|', ' = ') }) -join '  ·  ')) -ForegroundColor Green }
Write-Host ''
Write-Host 'AHORA, antes de formatear:' -ForegroundColor Yellow
Write-Host '  1. Copia la carpeta ENTERA a DOS lugares distintos (disco externo + nube privada u otro equipo).'
Write-Host '  2. En cada copia compara las huellas: Get-FileHash <archivo> -Algorithm SHA256   (deben ser las de SHA256.txt).'
Write-Host '  3. En OTRO equipo, carga y ensaya la migracion con la copia: docker-local.ps1 ensayar -Paquete <copia> (MIGRACION-FACTURACION.md 12.5).'
Write-Host '  4. Solo entonces formatea.'
exit 0
