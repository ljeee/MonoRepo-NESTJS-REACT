# Prueba la LOGICA de los scripts de scripts\ (respaldar-servidor.ps1, cargar-respaldo.ps1 y docker-local.ps1) con un "docker"
# SIMULADO: una funcion de PowerShell que imita lo que hacen los contenedores. NO ejecuta Docker ni toca ninguna base real:
# trabaja en una carpeta temporal. Sirve para volver a comprobar los scripts despues de editarlos:
#     powershell -ExecutionPolicy Bypass -File scripts\probar-scripts.ps1
# No reemplaza probarlos con Docker real (MIGRACION-FACTURACION.md, seccion 12.3).
param(
	[string]$Repo = (Split-Path -Parent $PSScriptRoot),
	[string]$Trabajo = (Join-Path ([IO.Path]::GetTempPath()) 'prueba-scripts')
)

$ErrorActionPreference = 'Continue'
if (Test-Path -LiteralPath $Trabajo) { Remove-Item -Recurse -Force -LiteralPath $Trabajo }
New-Item -ItemType Directory -Force -Path $Trabajo | Out-Null

# ───────────────────────── docker simulado ─────────────────────────
$global:S = $null
$global:Llamadas = New-Object System.Collections.ArrayList

function Nuevo-Estado([hashtable]$Dbs, [bool]$DbCorre = $true, [bool]$BackendCorre = $true, [bool]$DockerOk = $true) {
	# Lo que devolveria "docker compose config --format json" con docker-compose.local.yml bien aplicado.
	$cfg = [ordered]@{
		name     = 'pos-local'
		services = [ordered]@{
			db       = @{ container_name = 'pos-local-db' }
			redis    = @{ container_name = 'pos-local-redis' }
			backend  = @{ container_name = 'pos-local-backend'; environment = @{ DATABASE_HOST = 'db'; MAIL_HOST = ''; REPORT_EMAIL = '' } }
			frontend = @{ container_name = 'pos-local-frontend' }
		}
		volumes  = [ordered]@{ pgdata = @{ name = 'pos-local-pgdata' }; redis_data = @{ name = 'pos-local-redis-data' } }
	}
	$global:S = @{
		DockerOk          = $DockerOk
		Corriendo         = @{ 'pizzeria-db' = $DbCorre; 'pizzeria-backend' = $BackendCorre; 'ensayo-db' = $false; 'pos-local-db' = $false; 'pos-local-backend' = $false }
		Dbs               = $Dbs
		Fs                = @{}
		RestoreCodigo     = '0'
		RestorePierdeFilas = $false
		ConteosFallanEn   = ''
		Config            = $cfg
		ConfigJson        = ($cfg | ConvertTo-Json -Depth 6)
		ConfigCodigo      = 0
		Herramientas      = @{}
		BackendListo      = $false
		BackendNuncaListo = $false
	}
	$global:Llamadas.Clear()
}
function Recalcular-Config { $global:S.ConfigJson = ($global:S.Config | ConvertTo-Json -Depth 6) }

function Texto-DeBytes($b) { return [Text.Encoding]::UTF8.GetString([byte[]]$b) }

function docker {
	$a = @($args)
	[void]$global:Llamadas.Add(($a -join ' '))
	$global:LASTEXITCODE = 0
	$s = $global:S

	if ($a[0] -eq 'info') { if (-not $s.DockerOk) { $global:LASTEXITCODE = 1 }; return }
	if ($a[0] -eq 'inspect') {
		$n = $a[$a.Count - 1]
		if ($s.Corriendo.ContainsKey($n)) { if ($s.Corriendo[$n]) { 'true' } else { 'false' } } else { $global:LASTEXITCODE = 1 }
		return
	}
	if ($a[0] -eq 'compose') {
		$proyecto = 'pos-pizzeria'; $i = 1
		while ($i -lt $a.Count -and @('-p', '--env-file', '-f', '--profile') -contains $a[$i]) {
			if ($a[$i] -eq '-p') { $proyecto = $a[$i + 1] }
			$i += 2
		}
		$sub = $a[$i]
		$resto = @($a | Select-Object -Skip ($i + 1))
		$pref = 'pizzeria'
		if ($proyecto -eq 'pos-local') { $pref = 'pos-local' }
		switch ($sub) {
			'config' {
				if ($resto -contains '--format') { $s.ConfigJson }
				$global:LASTEXITCODE = $s.ConfigCodigo
			}
			'up' {
				if ($resto -contains 'db') {
					$s.Corriendo["$pref-db"] = $true
					# primer arranque: init.sql + seed-menu.sql crean la base con la estructura vieja y un menu de ejemplo
					if (-not $s.Dbs.ContainsKey('appdb')) { $s.Dbs['appdb'] = @{ 'productos' = 8; 'facturas_ventas' = 0; 'users' = 0 } }
				}
				if ($resto -contains 'backend') { $s.Corriendo["$pref-backend"] = $true; $s.BackendListo = -not $s.BackendNuncaListo }
			}
			'stop' { if ($resto -contains 'backend') { $s.Corriendo["$pref-backend"] = $false; $s.BackendListo = $false } }
			'run' {
				$k = [array]::IndexOf($resto, 'dist/common/migraciones-datos/herramientas/cli.js')
				if ($k -ge 0) {
					$h = $resto[$k + 1]
					"simulado: herramienta $h"
					if ($s.Herramientas.ContainsKey($h)) { $global:LASTEXITCODE = $s.Herramientas[$h] }
				}
				else { 'simulado: run' }
			}
			default { "simulado: compose $sub" }
		}
		return
	}
	if (@('ps', 'volume', 'images') -contains $a[0]) { "simulado: docker $($a[0])"; return }

	if ($a[0] -eq 'cp') {
		$src = $a[1]; $dst = $a[2]
		$rx = '^(?<c>[A-Za-z0-9_.-]{2,}):(?<p>/.*)$'
		if ($src -match $rx) {
			$p = $Matches['p']
			if (-not $s.Fs.ContainsKey($p)) { $global:LASTEXITCODE = 1; return }
			[IO.File]::WriteAllBytes($dst, [byte[]]$s.Fs[$p])
		}
		elseif ($dst -match $rx) {
			$s.Fs[$Matches['p']] = [IO.File]::ReadAllBytes($src)
		}
		else { $global:LASTEXITCODE = 1 }
		return
	}

	if ($a[0] -eq 'exec') {
		$cmd = $a[2]
		$i = [array]::IndexOf($a, '-d'); $db = ''
		if ($i -ge 0) { $db = $a[$i + 1] }

		if ($cmd -eq 'pg_isready' -or $cmd -eq 'rm') { return }
		if ($cmd -eq 'tail') { 'ultimas lineas del registro (simulado)'; return }

		if ($cmd -eq 'pg_restore' -and ($a -contains '-l')) { 'TOC simulado'; 'linea 2'; return }

		if ($cmd -eq 'pg_dump') {
			$f = $a[[array]::IndexOf($a, '-f') + 1]
			if (-not $s.Dbs.ContainsKey($db)) { $global:LASTEXITCODE = 1; return }
			$lineas = @('FAKEDUMP') + @($s.Dbs[$db].Keys | Sort-Object | ForEach-Object { "$_|$($s.Dbs[$db][$_])" }) + @('END')
			$txt = ($lineas -join "`n") + "`n" + ('x' * 3000) + "`n"
			if (-not ($a -contains '-Fc')) { $txt += "-- PostgreSQL database dump complete`n" }
			$s.Fs[$f] = [Text.Encoding]::UTF8.GetBytes($txt)
			return
		}

		if ($cmd -eq 'sh') {
			$linea = $a[4]
			if ($linea -notmatch '-d (?<db>\S+)') { $global:LASTEXITCODE = 1; return }
			$dest = $Matches['db']
			if ($linea -notmatch '(?<f>/tmp/\S+\.(dump|sql))') { $global:LASTEXITCODE = 1; return }
			$origen = $Matches['f']
			if ($s.RestoreCodigo -eq '0' -or $s.RestoreCodigo -eq 'solo-avisos') {
				$t = (Texto-DeBytes $s.Fs[$origen]) -split "`n"
				$h = @{}
				$dentro = $false
				foreach ($l in $t) {
					if ($l -eq 'FAKEDUMP') { $dentro = $true; continue }
					if ($l -eq 'END') { break }
					if ($dentro -and $l) { $p = $l.Split('|'); $h[$p[0]] = [int64]$p[1] }
				}
				if ($s.RestorePierdeFilas) { $k = @($h.Keys)[0]; $h[$k] = $h[$k] - 1 }
				$s.Dbs[$dest] = $h
			}
			if ($s.RestoreCodigo -eq 'solo-avisos') { '1' } else { $s.RestoreCodigo }
			return
		}

		if ($cmd -eq 'psql') {
			$ic = [array]::IndexOf($a, '-c'); $iff = [array]::IndexOf($a, '-f')
			if ($ic -ge 0) {
				$sql = $a[$ic + 1]
				if ($sql -match "^select tablename from pg_tables") {
					if (-not $s.Dbs.ContainsKey($db)) { $global:LASTEXITCODE = 1; return }
					@($s.Dbs[$db].Keys | Sort-Object); return
				}
				if ($sql -match "^select 1 from pg_database where datname = '(?<n>[^']+)'") { if ($s.Dbs.ContainsKey($Matches['n'])) { '1' }; return }
				if ($sql -match "to_regclass\('public\.facturas_ventas'\)") { if ($s.Dbs[$db].ContainsKey('facturas_ventas')) { 't' } else { 'f' }; return }
				if ($sql -match '^select count\(\*\) from public\.facturas_ventas') { "$($s.Dbs[$db]['facturas_ventas'])"; return }
				if ($sql -match '^select count\(\*\) from users') {
					if (-not $s.Dbs.ContainsKey($db)) { $global:LASTEXITCODE = 1; return }
					"$($s.Dbs[$db]['users'])"; return
				}
				if ($sql -match '^CREATE DATABASE (?<n>\w+) OWNER') { $s.Dbs[$Matches['n']] = @{}; return }
				if ($sql -match '^DROP DATABASE IF EXISTS (?<n>\w+) WITH') { $s.Dbs.Remove($Matches['n']); return }
				$global:LASTEXITCODE = 1; "simulado: consulta no prevista: $sql"; return
			}
			if ($iff -ge 0) {
				$ruta = $a[$iff + 1]
				if (-not $s.Fs.ContainsKey($ruta)) { $global:LASTEXITCODE = 1; return }
				if ($s.ConteosFallanEn -and $db -like "$($s.ConteosFallanEn)*") { $global:LASTEXITCODE = 1; return }
				$sql = Texto-DeBytes $s.Fs[$ruta]
				foreach ($m in [regex]::Matches($sql, "select '(?<t>[^']+)' \|\| '\|' \|\| count\(\*\) from public\.""(?<t2>[^""]+)""")) {
					$t = $m.Groups['t'].Value
					if ($t -ne $m.Groups['t2'].Value -or -not $s.Dbs[$db].ContainsKey($t)) { $global:LASTEXITCODE = 1; return }
					"$t|$($s.Dbs[$db][$t])"
				}
				return
			}
		}
		$global:LASTEXITCODE = 1; "simulado: exec no previsto: $($a -join ' ')"; return
	}
	$global:LASTEXITCODE = 1; "simulado: docker no previsto: $($a -join ' ')"
}

# Simulados del sistema que usa docker-local.ps1: la red, los puertos y la espera al backend.
function Invoke-WebRequest { if ($global:S.BackendListo) { [pscustomobject]@{ StatusCode = 200 } } else { throw 'conexion rechazada (simulado)' } }
function Get-NetIPAddress {
	[pscustomobject]@{ IPAddress = '192.168.1.50'; InterfaceAlias = 'Wi-Fi' }
	[pscustomobject]@{ IPAddress = '172.24.80.1'; InterfaceAlias = 'vEthernet (WSL)' }
	[pscustomobject]@{ IPAddress = '127.0.0.1'; InterfaceAlias = 'Loopback Pseudo-Interface 1' }
}
function Get-NetTCPConnection { }

# ───────────────────────── mini marco de pruebas ─────────────────────────
$global:Falladas = 0; $global:Pasadas = 0
function Afirmar($cond, $mensaje) {
	if ($cond) { $global:Pasadas++; Write-Host "   ok   $mensaje" -ForegroundColor DarkGreen }
	else { $global:Falladas++; Write-Host "   FALLA $mensaje" -ForegroundColor Red }
}
function Escenario($nombre) { Write-Host ''; Write-Host "### $nombre" -ForegroundColor Cyan }

function Nuevo-Repo($nombre) {
	$r = Join-Path $Trabajo $nombre
	if (Test-Path $r) { Remove-Item -Recurse -Force $r }
	New-Item -ItemType Directory -Force -Path (Join-Path $r 'scripts') | Out-Null
	New-Item -ItemType Directory -Force -Path (Join-Path $r 'Backend') | Out-Null
	Copy-Item (Join-Path $Repo 'scripts\*.ps1') (Join-Path $r 'scripts')
	[IO.File]::WriteAllText((Join-Path $r '.env'), "DB_PASSWORD=falsa`nJWT_SECRET=falsa-falsa-falsa-falsa-falsa-falsa`nCLOUDFLARE_TUNNEL_TOKEN=eyJfalso`n")
	[IO.File]::WriteAllText((Join-Path $r 'Backend\.env'), "DATABASE_HOST=falso`n")
	[IO.File]::WriteAllText((Join-Path $r 'docker-compose.yml'), "name: prueba`n")
	return $r
}

# Corre un script en proceso (con `&`) y devuelve su codigo de salida; el cwd se restaura.
function Correr($ruta, [hashtable]$parametros) {
	Push-Location $Trabajo
	$Error.Clear()
	try { $global:LASTEXITCODE = $null; $null = & $ruta @parametros 6>&1 5>&1 4>&1 3>&1 2>&1; $codigo = $global:LASTEXITCODE } finally { Pop-Location }
	foreach ($e in @($Error | Select-Object -First 3)) {
		Write-Host ("   [error en el script] {0}`n      en {1}:{2}  ->  {3}" -f $e.Exception.Message, (Split-Path -Leaf $e.InvocationInfo.ScriptName), $e.InvocationInfo.ScriptLineNumber, $e.InvocationInfo.Line.Trim()) -ForegroundColor Yellow
	}
	return $codigo
}

function Base-Origen { return @{ 'facturas_ventas' = 24; 'ordenes' = 21; 'ordenes_productos' = 29; 'clientes' = 7; 'users' = 6 } }
function Carpetas-Respaldo($destino) { return @(Get-ChildItem -LiteralPath $destino -Directory -ErrorAction SilentlyContinue) }

# ───────────────────────── escenarios: RESPALDAR ─────────────────────────
$repoA = Nuevo-Repo 'repoA'
git -C $repoA init -q 2>$null; git -C $repoA -c user.name=t -c user.email=t@t add -A 2>$null; git -C $repoA -c user.name=t -c user.email=t@t commit -q -m inicial 2>$null
$bk = Join-Path $repoA 'backups'

Escenario 'R1 respaldo final completo (-DetenerBackend -Verificar)'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = $bk; DetenerBackend = $true; Verificar = $true }
$car = Carpetas-Respaldo $bk
Afirmar ($c -eq 0) "termina con codigo 0 (fue: $c)"
Afirmar ($car.Count -eq 1) 'crea UNA carpeta respaldo-<fecha>'
$paq = $car[0].FullName
Afirmar ((Get-Item (Join-Path $paq 'appdb.dump')).Length -ge 1024) 'appdb.dump tiene contenido'
Afirmar ((Get-Content (Join-Path $paq 'appdb.sql') -Tail 1) -match 'dump complete') 'appdb.sql termina con la marca'
Afirmar ((@(Get-Content (Join-Path $paq 'conteos-origen.txt')).Count) -eq 5) 'conteos-origen.txt tiene las 5 tablas'
Afirmar ((Get-Content (Join-Path $paq 'conteos-origen.txt')) -contains 'facturas_ventas|24') 'conteos-origen.txt trae facturas_ventas|24'
Afirmar (-not $global:S.Corriendo['pizzeria-backend']) 'detuvo el backend'
Afirmar (-not (@($global:S.Dbs.Keys) -like 'verif_*').Count) 'borro la base temporal de la verificacion'
Afirmar (Test-Path (Join-Path $paq 'secretos\.env')) 'copio .env a secretos'
Afirmar ((Get-FileHash (Join-Path $paq 'secretos\.env')).Hash -eq (Get-FileHash (Join-Path $repoA '.env')).Hash) 'la copia de .env es identica byte a byte'
Afirmar (Test-Path (Join-Path $paq 'secretos\Backend__.env')) 'copio Backend\.env con nombre aplanado'
Afirmar (Test-Path (Join-Path $paq 'servidor\red.txt')) 'inventario: red.txt'
Afirmar (Test-Path (Join-Path $paq 'servidor\docker.txt')) 'inventario: docker.txt'
Afirmar (Test-Path (Join-Path $paq 'servidor\git.txt')) 'inventario: git.txt (el repo de prueba si tiene git)'
$sumas = Get-Content (Join-Path $paq 'SHA256.txt')
$archivos = Get-ChildItem -LiteralPath $paq -Recurse -File | Where-Object { $_.Name -ne 'SHA256.txt' }
Afirmar ($sumas.Count -eq $archivos.Count) "SHA256.txt lista todos los archivos ($($sumas.Count) de $($archivos.Count))"
$todasBien = $true
foreach ($l in $sumas) { $h, $rel = $l -split '\s{2}', 2; if ((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $paq $rel)).Hash.ToLower() -ne $h) { $todasBien = $false } }
Afirmar $todasBien 'cada huella de SHA256.txt coincide con el archivo real'
Afirmar (($global:Llamadas -join "`n") -match 'compose stop backend') 'ejecuto docker compose stop backend'
$PaqueteBueno = $paq

Escenario 'R2 sin -DetenerBackend el backend sigue corriendo'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups2') }
Afirmar ($c -eq 0) "termina con codigo 0 (fue: $c)"
Afirmar ($global:S.Corriendo['pizzeria-backend']) 'no toca el backend'
Afirmar (-not (($global:Llamadas -join "`n") -match 'compose stop')) 'no ejecuta compose stop'

Escenario 'R3 Docker apagado: falla y no crea nada'
Nuevo-Estado (@{ appdb = (Base-Origen) }) $true $true $false
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups3') }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (Test-Path (Join-Path $repoA 'backups3'))) 'no crea la carpeta de destino'

Escenario 'R4 contenedor de la base apagado: falla'
Nuevo-Estado (@{ appdb = (Base-Origen) }) $false $true $true
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups4') }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (Test-Path (Join-Path $repoA 'backups4'))) 'no crea la carpeta de destino'

Escenario 'R5 la prueba de restauracion detecta filas perdidas'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$global:S.RestorePierdeFilas = $true
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups5'); DetenerBackend = $true; Verificar = $true }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (@($global:S.Dbs.Keys) -like 'verif_*').Count) 'aun asi borra la base temporal'

Escenario 'R6 pg_restore falla en la prueba de restauracion'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$global:S.RestoreCodigo = '1'
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups6'); DetenerBackend = $true; Verificar = $true }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (@($global:S.Dbs.Keys) -like 'verif_*').Count) 'borra la base temporal tambien aqui'

Escenario 'R7 los conteos fallan DENTRO de la verificacion (exit dentro de try): se limpia la base temporal?'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$global:S.ConteosFallanEn = 'verif_'
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups7'); DetenerBackend = $true; Verificar = $true }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (@($global:S.Dbs.Keys) -like 'verif_*').Count) 'borra la base temporal aunque el conteo aborte el script'

Escenario 'R8 -SinSecretos no copia los .env'
Nuevo-Estado (@{ appdb = (Base-Origen) })
$c = Correr (Join-Path $repoA 'scripts\respaldar-servidor.ps1') @{ Destino = (Join-Path $repoA 'backups8'); SinSecretos = $true }
$p8 = (Carpetas-Respaldo (Join-Path $repoA 'backups8'))[0].FullName
Afirmar ($c -eq 0 -and -not (Test-Path (Join-Path $p8 'secretos'))) 'no crea la carpeta secretos'

# ───────────────────────── escenarios: CARGAR ─────────────────────────
$repoB = Nuevo-Repo 'repoB'
$cargar = Join-Path $repoB 'scripts\cargar-respaldo.ps1'
function Copiar-Paquete($nombre) { $d = Join-Path $Trabajo $nombre; if (Test-Path $d) { Remove-Item -Recurse -Force $d }; Copy-Item -Recurse $PaqueteBueno $d; return $d }

Escenario 'C1 servidor nuevo: levanta db, descarta el menu de ejemplo y deja las mismas filas'
Nuevo-Estado @{} $false $false
$p = Copiar-Paquete 'paqueteC1'
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 0) "codigo 0 (fue: $c)"
Afirmar ($global:S.Corriendo['pizzeria-db']) 'levanto el contenedor db (compose up)'
Afirmar ((($global:Llamadas -join "`n") -match 'compose up -d db redis')) 'uso docker compose up -d db redis'
Afirmar ((($global:Llamadas -join "`n") -match 'DROP DATABASE IF EXISTS appdb') -and (($global:Llamadas -join "`n") -match 'CREATE DATABASE appdb')) 'borro y recreo appdb'
Afirmar ($global:S.Dbs['appdb']['facturas_ventas'] -eq 24 -and -not $global:S.Dbs['appdb'].ContainsKey('productos')) 'appdb quedo con las 24 facturas y sin el menu de ejemplo'
Afirmar ($global:S.Dbs['appdb'].Count -eq 5) 'las 5 tablas del origen'

Escenario 'C2 un byte alterado: la huella lo detiene ANTES de tocar la base'
Nuevo-Estado @{ appdb = @{ productos = 8; facturas_ventas = 0 } }
$p = Copiar-Paquete 'paqueteC2'
$bytes = [IO.File]::ReadAllBytes((Join-Path $p 'appdb.dump')); $bytes[200] = $bytes[200] -bxor 1; [IO.File]::WriteAllBytes((Join-Path $p 'appdb.dump'), $bytes)
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (($global:Llamadas -join "`n") -match 'DROP DATABASE')) 'no borro nada'

Escenario 'C3 base con ventas: se niega; con -Forzar la reemplaza'
Nuevo-Estado @{ appdb = @{ facturas_ventas = 10; ordenes = 3 } }
$p = Copiar-Paquete 'paqueteC3'
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 1) "sin -Forzar: codigo 1 (fue: $c)"
Afirmar ($global:S.Dbs['appdb']['facturas_ventas'] -eq 10) 'la base con ventas queda intacta'
Afirmar (-not (($global:Llamadas -join "`n") -match 'DROP DATABASE')) 'no ejecuto DROP'
Nuevo-Estado @{ appdb = @{ facturas_ventas = 10; ordenes = 3 } }
$c = Correr $cargar @{ Paquete = $p; Forzar = $true }
Afirmar ($c -eq 0 -and $global:S.Dbs['appdb']['facturas_ventas'] -eq 24) "con -Forzar: codigo 0 y 24 facturas (fue: $c)"

Escenario 'C4 pg_restore con errores: falla; con -AceptarAvisos y conteos iguales, sigue'
Nuevo-Estado @{ appdb = @{ productos = 8; facturas_ventas = 0 } }
$global:S.RestoreCodigo = '1'
$p = Copiar-Paquete 'paqueteC4'
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 1) "sin -AceptarAvisos: codigo 1 (fue: $c)"
Nuevo-Estado @{ appdb = @{ productos = 8; facturas_ventas = 0 } }
$global:S.RestoreCodigo = 'solo-avisos'
$c = Correr $cargar @{ Paquete = $p; AceptarAvisos = $true }
Afirmar ($c -eq 0) "con -AceptarAvisos y conteos iguales: codigo 0 (fue: $c)"

Escenario 'C5 conteos distintos tras cargar: falla'
Nuevo-Estado @{ appdb = @{ productos = 8; facturas_ventas = 0 } }
$global:S.RestorePierdeFilas = $true
$p = Copiar-Paquete 'paqueteC5'
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"

Escenario 'C6 contenedor de ensayo apagado: no intenta levantar el compose'
Nuevo-Estado @{} $true $true
$p = Copiar-Paquete 'paqueteC6'
$c = Correr $cargar @{ Paquete = $p; Contenedor = 'ensayo-db' }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not (($global:Llamadas -join "`n") -match 'compose up')) 'no ejecuto compose up'

Escenario 'C7 servidor nuevo sin .env: se detiene con un mensaje claro'
Nuevo-Estado @{} $false $false
Remove-Item (Join-Path $repoB '.env')
$p = Copiar-Paquete 'paqueteC7'
$c = Correr $cargar @{ Paquete = $p }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not $global:S.Corriendo['pizzeria-db']) 'no levanto nada'
[IO.File]::WriteAllText((Join-Path $repoB '.env'), "DB_PASSWORD=falsa`n")

Escenario 'C8 cargar desde el .sql directo (sin carpeta ni huella)'
Nuevo-Estado @{ appdb = @{ productos = 8; facturas_ventas = 0 } }
$sql = Join-Path $Trabajo 'suelto.sql'; Copy-Item (Join-Path $PaqueteBueno 'appdb.sql') $sql -Force
$c = Correr $cargar @{ Paquete = $sql }
Afirmar ($c -eq 0 -and $global:S.Dbs['appdb']['facturas_ventas'] -eq 24) "codigo 0 y 24 facturas (fue: $c)"

Escenario 'C9 ruta inexistente'
Nuevo-Estado @{}
$c = Correr $cargar @{ Paquete = (Join-Path $Trabajo 'no-existe') }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"

# ───────────────────────── escenarios: ENTORNO LOCAL (docker-local.ps1) ─────────────────────────
$repoL = Nuevo-Repo 'repoL'
foreach ($f in 'docker-compose.local.yml', 'docker-local.env') { Copy-Item -LiteralPath (Join-Path $Repo $f) -Destination $repoL }
$local = Join-Path $repoL 'scripts\docker-local.ps1'
$prefijo = 'compose -p pos-local --env-file docker-local.env -f docker-compose.yml -f docker-compose.local.yml'
# Las llamadas a compose sin el prefijo local (las que no lo tengan quedan marcadas).
function Llamadas-Compose {
	return @($global:Llamadas | Where-Object { $_ -like 'compose *' } | ForEach-Object {
			if ($_.StartsWith($prefijo)) { $_.Substring($prefijo.Length).Trim() } else { "SIN-PROYECTO-LOCAL: $_" }
		})
}
function Posicion($lista, $patron) { for ($i = 0; $i -lt $lista.Count; $i++) { if ($lista[$i] -like $patron) { return $i } }; return -1 }

Escenario 'L1 up: comprueba la configuracion, levanta los 4 servicios (sin tunel) y espera al backend'
Nuevo-Estado @{} $false $false
$c = Correr $local @{ Accion = 'up' }
$lc = Llamadas-Compose
Afirmar ($c -eq 0) "codigo 0 (fue: $c)"
Afirmar ($lc -contains 'config --format json') 'lee la configuracion efectiva antes de hacer nada'
Afirmar ($lc -contains 'up -d --build db redis backend frontend') 'levanta exactamente db, redis, backend y frontend'
Afirmar ((Posicion $lc 'config*') -lt (Posicion $lc 'up *')) 'comprueba la configuracion ANTES de levantar'
Afirmar (-not ($lc -match 'cloudflared|--profile|tunel')) 'nunca menciona el tunel'
Afirmar (-not ($lc -like 'SIN-PROYECTO-LOCAL*')) 'todas las llamadas a compose usan el proyecto y los archivos locales'
Afirmar ($env:CORS_ORIGINS -match 'http://192\.168\.1\.50:8081' -and $env:CORS_ORIGINS -match 'http://localhost:8081' -and $env:CORS_ORIGINS -notmatch '172\.24\.80\.1') "CORS con localhost y la IP de la red, sin la de WSL ($env:CORS_ORIGINS)"

Escenario 'L2 configuracion que NO es la local (contenedor del servidor): no hace nada'
Nuevo-Estado @{} $false $false
$global:S.Config.services.db.container_name = 'pizzeria-db'; Recalcular-Config
$c = Correr $local @{ Accion = 'up' }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not ((Llamadas-Compose) -like 'up *')) 'no levanto nada'

Escenario 'L3 tunel activo en la configuracion: no hace nada; con su perfil "tunel" (apagado) si sigue'
Nuevo-Estado @{} $false $false
$global:S.Config.services['cloudflared'] = @{ container_name = 'pos-local-cloudflared' }; Recalcular-Config
$c = Correr $local @{ Accion = 'estado' }
Afirmar ($c -eq 1) "sin perfil: codigo 1 (fue: $c)"
Nuevo-Estado @{} $false $false
$global:S.Config.services['cloudflared'] = @{ container_name = 'pos-local-cloudflared'; profiles = @('tunel') }; Recalcular-Config
$c = Correr $local @{ Accion = 'estado' }
Afirmar ($c -eq 0) "con perfil tunel: codigo 0 (fue: $c)"

Escenario 'L4 el backend enviaria correos: no hace nada'
Nuevo-Estado @{} $false $false
$global:S.Config.services.backend.environment.REPORT_EMAIL = 'dueno@correo.com'; Recalcular-Config
$c = Correr $local @{ Accion = 'up' }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not ((Llamadas-Compose) -like 'up *')) 'no levanto nada'

Escenario 'L5 un volumen del servidor en la configuracion: reset NO borra nada'
Nuevo-Estado @{} $false $false
$global:S.Config.volumes.pgdata.name = 'pizzeria-pgdata'; Recalcular-Config
$c = Correr $local @{ Accion = 'reset'; Confirmar = $true }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not ((Llamadas-Compose) -like 'down*')) 'no ejecuto down -v'

Escenario 'L6 Compose no entiende la configuracion (version sin !override): se detiene'
Nuevo-Estado @{} $false $false
$global:S.ConfigCodigo = 1; $global:S.ConfigJson = ''
$c = Correr $local @{ Accion = 'up' }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar (-not ((Llamadas-Compose) -like 'up *')) 'no levanto nada'

Escenario 'L7 reset exige -Confirmar'
Nuevo-Estado @{} $false $false
$c = Correr $local @{ Accion = 'reset' }
Afirmar ($c -eq 1 -and -not ((Llamadas-Compose) -like 'down*')) "sin -Confirmar: codigo 1 y no borra (fue: $c)"
Nuevo-Estado @{} $false $false
$c = Correr $local @{ Accion = 'reset'; Confirmar = $true }
Afirmar ($c -eq 0 -and ((Llamadas-Compose) -contains 'down -v --remove-orphans')) "con -Confirmar: down -v del proyecto local (fue: $c)"

Escenario 'L8 herramienta: corre la CLI en la imagen del backend y devuelve su codigo'
Nuevo-Estado @{ appdb = @{ facturas_ventas = 3 } }
$global:S.Corriendo['pos-local-db'] = $true
$global:S.Herramientas['auditar'] = 2
$c = Correr $local @{ Accion = 'herramienta'; Herramienta = 'auditar'; Opciones = '--salida /out/a.txt' }
$run = @(Llamadas-Compose | Where-Object { $_ -like 'run *' })
Afirmar ($c -eq 2) "devuelve el codigo de la herramienta: 2 = bloqueantes (fue: $c)"
Afirmar ($run.Count -eq 1 -and $run[0] -like 'run --rm --no-deps -v *backups:/out backend node dist/common/migraciones-datos/herramientas/cli.js auditar --salida /out/a.txt') "llamada: $($run[0])"
$c = Correr $local @{ Accion = 'herramienta'; Herramienta = 'borrar-todo' }
Afirmar ($c -eq 1) "herramienta desconocida: codigo 1 (fue: $c)"

Escenario 'L9 ensayar: carga, audita, toma la linea base y SOLO DESPUES arranca el backend nuevo'
Nuevo-Estado @{} $false $false
$c = Correr $local @{ Accion = 'ensayar'; Paquete = (Copiar-Paquete 'paqueteL9') }
$lc = Llamadas-Compose
Afirmar ($c -eq 0) "codigo 0 (fue: $c)"
$orden = @('build backend', 'up -d db redis', 'stop backend', 'run *cli.js auditar*', 'run *cli.js linea-base*', 'up -d backend', 'run *cli.js verificar*', 'run *cli.js precios*')
$pos = @($orden | ForEach-Object { Posicion $lc $_ })
Afirmar (-not ($pos -contains -1)) "estan todos los pasos (posiciones $($pos -join ','))"
$creciente = $true; for ($i = 1; $i -lt $pos.Count; $i++) { if ($pos[$i] -le $pos[$i - 1]) { $creciente = $false } }
Afirmar $creciente 'orden: imagen, base, backend detenido, auditoria, linea base, arranque, verificacion, precios'
Afirmar ($global:S.Dbs['appdb']['facturas_ventas'] -eq 24) 'la base local quedo con el respaldo (24 facturas)'
Afirmar (@($global:Llamadas | Where-Object { $_ -like 'exec pos-local-db*' }).Count -gt 0) 'la carga uso el contenedor pos-local-db'
Afirmar (-not ($lc -like 'SIN-PROYECTO-LOCAL*')) 'ninguna llamada a compose fuera del proyecto local'

Escenario 'L10 ensayar con bloqueantes: se detiene ANTES de la linea base y sin arrancar el backend'
Nuevo-Estado @{} $false $false
$global:S.Herramientas['auditar'] = 2
$c = Correr $local @{ Accion = 'ensayar'; Paquete = (Copiar-Paquete 'paqueteL10') }
$lc = Llamadas-Compose
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar ((Posicion $lc 'run *linea-base*') -eq -1 -and (Posicion $lc 'up -d backend') -eq -1) 'no tomo linea base ni arranco el backend'

Escenario 'L11 ensayar con -Correccion: la aplica en la base local antes de auditar'
Nuevo-Estado @{} $false $false
$fix = Join-Path $Trabajo 'corregir.sql'
[IO.File]::WriteAllText($fix, "BEGIN;`nUPDATE domicilios SET telefono_domiciliario_asignado = NULL WHERE telefono_domiciliario_asignado = '';`nCOMMIT;`n")
$c = Correr $local @{ Accion = 'ensayar'; Paquete = (Copiar-Paquete 'paqueteL11'); Correccion = $fix }
$todas = @($global:Llamadas)
$iFix = Posicion $todas 'exec pos-local-db psql -U appuser -d appdb -v ON_ERROR_STOP=1 -f /tmp/corregir.sql'
$iAud = Posicion $todas 'compose*cli.js auditar*'
Afirmar ($c -eq 0) "codigo 0 (fue: $c)"
Afirmar ((Posicion $todas "cp $fix pos-local-db:/tmp/corregir.sql") -ge 0) 'copio la correccion al contenedor local'
Afirmar ($iFix -ge 0 -and $iFix -lt $iAud) 'la aplico antes de auditar'

Escenario 'L12 ensayar: si la verificacion falla, el ensayo NO pasa'
Nuevo-Estado @{} $false $false
$global:S.Herramientas['verificar'] = 1
$c = Correr $local @{ Accion = 'ensayar'; Paquete = (Copiar-Paquete 'paqueteL12') }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"

Escenario 'L13 up: si el backend nunca responde, termina con error y muestra su registro'
Nuevo-Estado @{} $false $false
$global:S.BackendNuncaListo = $true
$c = Correr $local @{ Accion = 'up'; EsperaMinutos = 0 }
Afirmar ($c -eq 1) "codigo 1 (fue: $c)"
Afirmar ((Llamadas-Compose) -contains 'logs --tail 60 backend') 'mostro el registro del backend'

Escenario 'L14 seed: los tres seeders dentro del contenedor, con NODE_ENV=development'
Nuevo-Estado @{ appdb = @{ users = 0 } }
$global:S.Corriendo['pos-local-db'] = $true
$c = Correr $local @{ Accion = 'seed' }
Afirmar ($c -eq 0) "codigo 0 (fue: $c)"
Afirmar ((Llamadas-Compose) -contains 'run --rm --no-deps -e NODE_ENV=development backend sh -c node dist/common/seeders/seed-users.js && node dist/common/seeders/seed-productos.js && node dist/common/seeders/seed-demo.js') 'llamada exacta de los seeders'
Nuevo-Estado @{} $false $false
$c = Correr $local @{ Accion = 'seed' }
Afirmar ($c -eq 1) "sin el entorno arriba: codigo 1 (fue: $c)"

Write-Host ''
Write-Host ("RESULTADO: {0} afirmaciones correctas, {1} falladas" -f $global:Pasadas, $global:Falladas) -ForegroundColor $(if ($global:Falladas) { 'Red' } else { 'Green' })
if (-not $global:Falladas) { Remove-Item -Recurse -Force -LiteralPath $Trabajo -ErrorAction SilentlyContinue }
exit $(if ($global:Falladas) { 1 } else { 0 })
