<#
.SYNOPSIS
  CARGA un respaldo hecho con respaldar-servidor.ps1 en la base del POS (servidor nuevo o copia de ensayo) y comprueba
  que quedo con exactamente las mismas filas que el servidor original.

.DESCRIPTION
  Pasos: verifica la huella SHA-256 -> levanta db y redis si hace falta (solo con pizzeria-db) -> espera al Postgres definitivo
  -> se NIEGA a borrar una base que ya tiene ventas (salvo -Forzar) -> borra y recrea la base vacia -> restaura -> compara conteos.
  La base se recrea vacia a proposito: la primera vez que arranca el contenedor db crea la base con Backend\init.sql y
  Backend\seed-menu.sql (estructura vieja + menu de ejemplo), y eso no debe mezclarse con los datos reales.
  Despues de cargar hay que MIGRAR (MIGRACION-FACTURACION.md, seccion 5): auditoria, linea base, arrancar el backend, verificar.

.PARAMETER Paquete
  Carpeta del respaldo (con appdb.dump y SHA256.txt) o ruta a un .dump / .sql.
.PARAMETER Contenedor
  pizzeria-db (servidor) o el contenedor de ensayo, p. ej. ensayo-db (ya debe estar corriendo).
.PARAMETER Forzar
  Permite reemplazar una base que YA TIENE ventas. Peligroso: borra lo que haya.
.PARAMETER AceptarAvisos
  Si pg_restore termina con avisos/errores, sigue igual y deja que decida la comparacion de conteos.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\cargar-respaldo.ps1 -Paquete backups\respaldo-20261015-2230
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\cargar-respaldo.ps1 -Paquete backups\respaldo-20261015-2230 -Contenedor ensayo-db
#>
[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)][string]$Paquete,
	[string]$Contenedor = 'pizzeria-db',
	[string]$Usuario = 'appuser',
	[string]$Base = 'appdb',
	[switch]$Forzar,
	[switch]$AceptarAvisos
)

. (Join-Path $PSScriptRoot 'lib-respaldo.ps1')
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

# ── 1. Localizar y comprobar el respaldo ─────────────────────────────────────────────────────────
Paso 'Buscando el respaldo'
if (-not (Test-Path -LiteralPath $Paquete)) { Falla "No existe $Paquete" }
if (Test-Path -LiteralPath $Paquete -PathType Container) {
	$carpeta = (Resolve-Path -LiteralPath $Paquete).Path
	$archivo = Join-Path $carpeta 'appdb.dump'
	if (-not (Test-Path -LiteralPath $archivo)) { $archivo = Join-Path $carpeta 'appdb.sql' }
}
else {
	$archivo = (Resolve-Path -LiteralPath $Paquete).Path
	$carpeta = Split-Path -Parent $archivo
}
if (-not (Test-Path -LiteralPath $archivo)) { Falla "No encuentro appdb.dump ni appdb.sql en $Paquete" }
$esSql = $archivo.ToLower().EndsWith('.sql')
$nombre = Split-Path -Leaf $archivo
Ok ('Respaldo: {0} ({1})' -f $archivo, (Tamano (Get-Item -LiteralPath $archivo).Length))

$sumas = Join-Path $carpeta 'SHA256.txt'
if (Test-Path -LiteralPath $sumas) {
	$linea = Get-Content -LiteralPath $sumas | Where-Object { $_ -match ('\s' + [regex]::Escape($nombre) + '$') } | Select-Object -First 1
	if ($linea) {
		$esperada = ($linea -split '\s+')[0].ToLower()
		if ((Hash-Archivo $archivo) -ne $esperada) {
			Falla "La huella SHA-256 de $nombre NO coincide con SHA256.txt: el archivo se danio al copiarlo. Vuelve a copiarlo desde el original."
		}
		Ok 'Huella SHA-256 correcta (el archivo llego completo)'
	}
	else {
		Aviso "SHA256.txt no menciona ${nombre}: no se puede comprobar la huella."
	}
}
else {
	Aviso 'No hay SHA256.txt junto al respaldo: no se puede comprobar que el archivo llego completo.'
}

# ── 2. Docker y Postgres ─────────────────────────────────────────────────────────────────────────
Paso 'Docker y base de datos'
Probar-Docker
if (-not (Contenedor-Corriendo $Contenedor)) {
	if ($Contenedor -ne 'pizzeria-db') { Falla "El contenedor $Contenedor no esta corriendo. Levantalo y repite." }
	if (-not (Test-Path -LiteralPath (Join-Path $Raiz '.env'))) {
		Falla 'Falta el archivo .env en la raiz del repo (DB_PASSWORD, JWT_SECRET, CLOUDFLARE_TUNNEL_TOKEN...). Copialo de la carpeta "secretos" del respaldo.'
	}
	Aviso "$Contenedor no esta corriendo: lo levanto junto con redis (docker compose up -d db redis)"
	docker compose up -d db redis
	Revisar 'docker compose up -d db redis'
}
Esperar-Postgres $Contenedor $Usuario $Base
Ok "Postgres de $Contenedor listo"

# ── 3. No borrar una base con ventas por accidente ───────────────────────────────────────────────
Paso 'Comprobando que no se va a borrar una base con ventas'
$hay = Sql-Escalar $Contenedor $Usuario 'postgres' "select 1 from pg_database where datname = '$Base'"
if ($hay -eq '1') {
	$tabla = Sql-Escalar $Contenedor $Usuario $Base "select to_regclass('public.facturas_ventas') is not null"
	if ($tabla -eq 't') {
		$ventas = [int64](Sql-Escalar $Contenedor $Usuario $Base 'select count(*) from public.facturas_ventas')
		if ($ventas -gt 0) {
			if (-not $Forzar) {
				Falla "La base $Base de $Contenedor YA TIENE $ventas facturas. Este script la reemplazaria por completo. Si es exactamente lo que quieres, repite con -Forzar."
			}
			Aviso "-Forzar: se reemplazan las $ventas facturas que tiene $Base."
		}
	}
}
Ok 'Nada que perder (o autorizado con -Forzar)'

# ── 4. Restaurar ─────────────────────────────────────────────────────────────────────────────────
Paso "Cargando el respaldo en $Base (borra y recrea la base vacia)"
$dentro = if ($esSql) { '/tmp/carga.sql' } else { '/tmp/carga.dump' }
docker cp $archivo "${Contenedor}:$dentro" | Out-Null
Revisar 'copiar el respaldo al contenedor'
docker exec $Contenedor psql -U $Usuario -d postgres -c "DROP DATABASE IF EXISTS $Base WITH (FORCE)" | Out-Null
Revisar "borrar la base $Base"
docker exec $Contenedor psql -U $Usuario -d postgres -c "CREATE DATABASE $Base OWNER $Usuario" | Out-Null
Revisar "crear la base $Base"
if ($esSql) {
	$cmd = 'psql -U {0} -d {1} -v ON_ERROR_STOP=1 -f {2} > /tmp/carga.log 2>&1; echo $?' -f $Usuario, $Base, $dentro
}
else {
	$cmd = 'pg_restore -U {0} -d {1} --no-owner --no-privileges {2} > /tmp/carga.log 2>&1; echo $?' -f $Usuario, $Base, $dentro
}
$codigo = "$(docker exec $Contenedor sh -c $cmd | Select-Object -Last 1)".Trim()
if ($codigo -ne '0') {
	Aviso 'La restauracion termino con avisos o errores. Ultimas lineas de su registro:'
	docker exec $Contenedor tail -n 25 /tmp/carga.log
	if (-not $AceptarAvisos) {
		Falla "La restauracion termino con codigo $codigo. El respaldo original sigue intacto: revisa el registro (docker exec $Contenedor cat /tmp/carga.log) y repite; si son avisos sin importancia, usa -AceptarAvisos."
	}
	Aviso '-AceptarAvisos: sigo; la comparacion de conteos decide si quedo bien.'
}
docker exec $Contenedor rm -f $dentro | Out-Null
Ok 'Respaldo restaurado'

# ── 5. Comparar con el servidor original ─────────────────────────────────────────────────────────
Paso 'Comparando las filas de cada tabla con las del servidor original'
$copia = Obtener-Conteos $Contenedor $Usuario $Base
$origen = Join-Path $carpeta 'conteos-origen.txt'
if (Test-Path -LiteralPath $origen) {
	$dif = @(Comparar-Conteos (Get-Content -LiteralPath $origen) $copia)
	if ($dif.Count -gt 0) {
		$dif | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
		Falla 'Los conteos NO coinciden con el servidor original. NO sigas: repite la carga o usa el otro formato (appdb.sql).'
	}
	Ok ('Las {0} tablas tienen exactamente las mismas filas que el servidor original' -f @($copia).Count)
}
else {
	Aviso 'No hay conteos-origen.txt para comparar. Estos son los conteos de lo cargado:'
	$copia | ForEach-Object { Write-Host "   $_" }
}

Paso 'LISTO: la base esta cargada (todavia con la estructura ANTERIOR)'
Write-Host 'Falta migrarla (MIGRACION-FACTURACION.md, seccion 5):' -ForegroundColor Yellow
Write-Host '  1. docker compose build backend'
Write-Host '  2. auditoria y linea base con la imagen nueva (C3); corregir bloqueantes si los hay'
Write-Host '  3. docker compose up -d     (backend, frontend y tunel)'
Write-Host '  4. verificar contra la linea base (C5) y hacer las pruebas de humo (seccion 6)'
exit 0
