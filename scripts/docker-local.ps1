<#
.SYNOPSIS
  Entorno LOCAL de pruebas en Docker: la pila del servidor (base, redis, backend y POS web) SIN el tunel de Cloudflare.

.DESCRIPTION
  Usa siempre docker-compose.yml + docker-compose.local.yml, el proyecto "pos-local" y las variables de docker-local.env
  (sin secretos: el .env real no se lee). Antes de cada accion comprueba que la configuracion efectiva sea la local
  (proyecto pos-local, contenedores y volumenes pos-local-*, tunel apagado, sin correo); si no, no hace nada.

  up           construye y levanta base, redis, backend y POS web; espera al backend y muestra las direcciones
  seed         usuarios (seed-users.ts), menu y datos de demostracion, dentro del contenedor del backend
  estado       contenedores del entorno
  logs         registro de un servicio (-Servicio, por defecto backend)
  down         apaga el entorno; los datos se conservan
  reset        apaga y BORRA los datos locales (exige -Confirmar)
  herramienta  auditar | linea-base | verificar | precios: herramientas de la migracion (solo lectura) sobre la base local.
               Los archivos quedan en backups\ (dentro del contenedor: /out). Opciones: -Opciones "--salida /out/x.json"
  ensayar      ensayo completo de la migracion con un respaldo real (-Paquete): carga, correccion opcional (-Correccion),
               auditoria, linea base, arranque del backend nuevo y verificacion, midiendo cuanto tarda cada parte

  -EsperaMinutos (15) es cuanto se espera a que el backend responda en up y ensayar.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\docker-local.ps1 up
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\docker-local.ps1 herramienta auditar
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\docker-local.ps1 ensayar -Paquete backups\respaldo-20261015-2230 -Correccion backups\corregir.sql
#>
[CmdletBinding()]
param(
	[Parameter(Position = 0, Mandatory = $true)]
	[ValidateSet('up', 'seed', 'estado', 'logs', 'down', 'reset', 'herramienta', 'ensayar')]
	[string]$Accion,
	[Parameter(Position = 1)]
	[string]$Herramienta,
	[string]$Opciones = '',
	[string]$Paquete,
	[string]$Correccion,
	[string]$Servicio = 'backend',
	[int]$EsperaMinutos = 15,
	[switch]$Confirmar
)

. (Join-Path $PSScriptRoot 'lib-respaldo.ps1')
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz
$ProgressPreference = 'SilentlyContinue'

$Proyecto = 'pos-local'
$DbContenedor = 'pos-local-db'
$Backups = Join-Path $Raiz 'backups'
$ArgsCompose = @('compose', '-p', $Proyecto, '--env-file', 'docker-local.env', '-f', 'docker-compose.yml', '-f', 'docker-compose.local.yml')
$script:IpsRed = @()

function Compose { docker @ArgsCompose @args }

# CORS para el POS web en este equipo y en los demas de la red (celulares, tablets): http://IP-DEL-PC:8081.
function Preparar-Variables {
	try {
		$script:IpsRed = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {
				$_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Docker|Loopback|VirtualBox|VMware'
			} | ForEach-Object { $_.IPAddress })
	}
	catch { $script:IpsRed = @() }
	$origenes = @('http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:5173') + @($script:IpsRed | ForEach-Object { "http://$($_):8081" })
	$env:CORS_ORIGINS = ($origenes -join ',')
}

# Corta si la configuracion efectiva no es la local: proyecto, contenedores, volumenes, tunel y correo.
function Comprobar-Configuracion {
	foreach ($f in 'docker-compose.yml', 'docker-compose.local.yml', 'docker-local.env') {
		if (-not (Test-Path -LiteralPath (Join-Path $Raiz $f))) { Falla "Falta $f en la raiz del repo." }
	}
	$texto = (Compose config --format json) -join "`n"
	if ($LASTEXITCODE -ne 0 -or -not $texto) {
		Falla 'docker compose no pudo leer la configuracion local. Actualiza Docker Desktop (la etiqueta !override pide Compose 2.24.4 o mas nuevo).'
	}
	$cfg = $texto | ConvertFrom-Json
	$malos = @()
	if ($cfg.name -ne $Proyecto) { $malos += "el proyecto se llama '$($cfg.name)'" }
	foreach ($s in $cfg.services.PSObject.Properties) {
		$cn = "$($s.Value.container_name)"
		if ($cn -and -not $cn.StartsWith('pos-local-')) { $malos += "contenedor $cn" }
		if ($s.Name -eq 'cloudflared' -and -not (@($s.Value.profiles) -contains 'tunel')) { $malos += 'el tunel (cloudflared) quedaria activo' }
	}
	if ($cfg.volumes) {
		foreach ($v in $cfg.volumes.PSObject.Properties) {
			if (-not "$($v.Value.name)".StartsWith('pos-local-')) { $malos += "volumen $($v.Value.name)" }
		}
	}
	$entorno = $cfg.services.backend.environment
	if ($entorno -and ("$($entorno.REPORT_EMAIL)" -or "$($entorno.MAIL_HOST)")) { $malos += 'el backend enviaria correos' }
	if ($malos.Count -gt 0) { Falla ('La configuracion efectiva NO es la del entorno local: ' + ($malos -join '; ') + '. No se hizo nada.') }
	Ok 'Configuracion local comprobada: proyecto pos-local, contenedores y volumenes pos-local-*, sin tunel ni correo'
}

function Avisar-Puertos {
	foreach ($p in 3000, 8081, 5434) {
		$c = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
		if ($c) {
			$proc = "$((Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue).ProcessName)"
			if ($proc -notmatch 'docker|wslrelay|vpnkit') { Aviso "El puerto $p lo usa '$proc' (npm run dev?). Detenlo o Docker no podra publicarlo." }
		}
	}
}

function Esperar-Backend([int]$minutos) {
	$limite = (Get-Date).AddMinutes($minutos)
	while ((Get-Date) -lt $limite) {
		try {
			$r = Invoke-WebRequest -Uri 'http://localhost:3000/empresa' -UseBasicParsing -TimeoutSec 5
			if ($r.StatusCode -eq 200) { return $true }
		}
		catch { }
		Start-Sleep -Seconds 5
	}
	return $false
}

# Herramientas de la migracion (solo lectura) dentro de la imagen del backend; su salida va a la pantalla.
function Correr-Herramienta($nombre, [string[]]$opciones = @()) {
	New-Item -ItemType Directory -Force -Path $Backups | Out-Null
	Compose run --rm --no-deps -v "${Backups}:/out" backend node dist/common/migraciones-datos/herramientas/cli.js $nombre @opciones | Out-Host
	return $LASTEXITCODE
}

function Mostrar-Direcciones {
	Write-Host ''
	Write-Host 'Entorno local arriba, SIN tunel (d-firu.com sigue apuntando al servidor real):' -ForegroundColor Green
	Write-Host '   POS web    http://localhost:8081'
	Write-Host '   API        http://localhost:3000   (Swagger: http://localhost:3000/swagger)'
	Write-Host '   Base       localhost:5434   usuario appuser, clave local, base appdb'
	foreach ($ip in $script:IpsRed) { Write-Host "   Red local  http://$($ip):8081   (celular o tablet en la misma red; el firewall de Windows debe permitirlo)" }
}

function Duracion($desde) { return ((Get-Date) - $desde).ToString('hh\:mm\:ss') }

Paso "Entorno local de pruebas (sin tunel): $Accion"
Probar-Docker
Preparar-Variables
Comprobar-Configuracion

switch ($Accion) {
	'up' {
		Avisar-Puertos
		Paso 'Construyendo y levantando base, redis, backend y POS web (la primera vez tarda varios minutos)'
		Compose up -d --build db redis backend frontend
		Revisar 'docker compose up'
		Paso 'Esperando al backend (el primer arranque crea el esquema y corre las migraciones de datos)'
		if (-not (Esperar-Backend $EsperaMinutos)) {
			Compose logs --tail 60 backend
			Falla "El backend no respondio en $EsperaMinutos minutos (arriba esta su registro; en un equipo lento usa -EsperaMinutos 30)."
		}
		Ok 'Backend listo'
		Mostrar-Direcciones
		$usuarios = Sql-Escalar $DbContenedor 'appuser' 'appdb' 'select count(*) from users'
		if ($usuarios -eq '0') { Aviso 'La base no tiene usuarios: corre "scripts\docker-local.ps1 seed" (usuarios, menu y datos de demostracion).' }
	}

	'seed' {
		if (-not (Contenedor-Corriendo $DbContenedor)) { Falla 'El entorno no esta arriba: corre primero "scripts\docker-local.ps1 up".' }
		Paso 'Usuarios, menu y datos de demostracion (dentro del contenedor del backend)'
		Compose run --rm --no-deps -e NODE_ENV=development backend sh -c 'node dist/common/seeders/seed-users.js && node dist/common/seeders/seed-productos.js && node dist/common/seeders/seed-demo.js'
		Revisar 'los seeders'
		Ok 'Listo. Entra con los usuarios de Backend\src\common\seeders\seed-users.ts (admin, cajero01, mesero01, cocina01, contador01).'
	}

	'estado' { Compose ps }

	'logs' { Compose logs -f --tail 200 $Servicio }

	'down' {
		Compose down
		Revisar 'docker compose down'
		Ok 'Entorno apagado; los datos siguen en los volumenes pos-local-*.'
	}

	'reset' {
		if (-not $Confirmar) { Falla 'reset BORRA la base local (volumenes pos-local-*). Si es lo que quieres, repite con -Confirmar.' }
		Compose down -v --remove-orphans
		Revisar 'docker compose down -v'
		Ok 'Entorno local borrado. El proximo "up" crea una base nueva (estructura vieja de init.sql + menu de ejemplo, que el backend migra).'
	}

	'herramienta' {
		if (@('auditar', 'linea-base', 'verificar', 'precios') -notcontains $Herramienta) { Falla 'Indica la herramienta: auditar | linea-base | verificar | precios' }
		if (-not (Contenedor-Corriendo $DbContenedor)) { Falla 'El entorno no esta arriba: corre primero "scripts\docker-local.ps1 up".' }
		$codigo = Correr-Herramienta $Herramienta @($Opciones -split '\s+' | Where-Object { $_ })
		exit $codigo
	}

	'ensayar' {
		if (-not $Paquete) { Falla 'Indica el respaldo: -Paquete backups\respaldo-<fecha> (la carpeta) o la ruta de un .dump' }
		if ($Correccion -and -not (Test-Path -LiteralPath $Correccion)) { Falla "No existe $Correccion" }
		$marca = 'ensayo-local-' + (Get-Date -Format 'yyyyMMdd-HHmm')
		$tiempos = [ordered]@{}

		$t = Get-Date
		Paso '1/6 Imagen nueva del backend'
		Compose build backend
		Revisar 'docker compose build backend'
		$tiempos['imagen'] = Duracion $t

		$t = Get-Date
		Paso '2/6 Base local arriba y backend detenido (nadie escribe durante la carga)'
		Compose up -d db redis
		Revisar 'docker compose up -d db redis'
		Compose stop backend | Out-Null
		Esperar-Postgres $DbContenedor 'appuser' 'appdb'

		Paso '3/6 Cargando el respaldo en la base local'
		& (Join-Path $PSScriptRoot 'cargar-respaldo.ps1') -Paquete $Paquete -Contenedor $DbContenedor -Forzar
		if ($LASTEXITCODE -ne 0) { Falla 'La carga del respaldo fallo (mira arriba).' }
		if ($Correccion) {
			Paso '    Aplicando la correccion de bloqueantes'
			docker cp $Correccion "${DbContenedor}:/tmp/corregir.sql" | Out-Null
			Revisar 'copiar la correccion al contenedor'
			docker exec $DbContenedor psql -U appuser -d appdb -v ON_ERROR_STOP=1 -f /tmp/corregir.sql
			Revisar 'aplicar la correccion'
		}
		$tiempos['carga'] = Duracion $t

		$t = Get-Date
		Paso '4/6 Auditoria y linea base (solo lectura)'
		$codigo = Correr-Herramienta 'auditar' @('--salida', "/out/$marca-auditoria.txt")
		if ($codigo -eq 2) {
			Falla "Hay BLOQUEANTES (backups\$marca-auditoria.txt). Prepara el SQL (MIGRACION-FACTURACION.md, seccion 11) y repite con -Correccion <archivo.sql>."
		}
		if ($codigo -ne 0) { Falla 'La auditoria fallo.' }
		$codigo = Correr-Herramienta 'linea-base' @('--salida', "/out/$marca-linea-base.json")
		if ($codigo -ne 0) { Falla 'No se pudo tomar la linea base.' }
		$tiempos['auditoria'] = Duracion $t

		$t = Get-Date
		Paso '5/6 Arrancando el backend NUEVO (synchronize + migraciones de datos): esto es lo que dura la caida en produccion'
		Compose up -d backend
		Revisar 'docker compose up -d backend'
		if (-not (Esperar-Backend $EsperaMinutos)) {
			Compose logs --tail 80 backend
			Falla "El backend no arranco en $EsperaMinutos minutos (arriba esta su registro)."
		}
		$tiempos['arranque'] = Duracion $t

		$t = Get-Date
		Paso '6/6 Verificacion contra la linea base (espera al paso en segundo plano) y precios'
		$verif = Correr-Herramienta 'verificar' @('--base', "/out/$marca-linea-base.json", '--esperar', '--salida', "/out/$marca-verificacion.json")
		$precios = Correr-Herramienta 'precios'
		$tiempos['verificacion'] = Duracion $t

		Paso 'Resumen del ensayo'
		foreach ($k in $tiempos.Keys) { Write-Host ('   {0,-13} {1}' -f $k, $tiempos[$k]) }
		Write-Host "   Archivos:     backups\$marca-*"
		if ($verif -ne 0 -or $precios -ne 0) { Falla 'El ensayo NO paso (mira la verificacion de arriba). No migres produccion asi.' }
		Ok 'El ensayo paso: los datos no cambiaron y los precios son los mismos. El entorno sigue arriba; "up" levanta tambien el POS web para revisar a mano.'
	}
}
exit 0
