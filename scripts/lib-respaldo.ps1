# Funciones comunes de respaldar-servidor.ps1 y cargar-respaldo.ps1 (se cargan con ". lib-respaldo.ps1").
# Compatible con Windows PowerShell 5.1. No se usa "2>&1" sobre ejecutables: en 5.1 convierte cada linea de stderr en un error.

function Paso($texto) { Write-Host ''; Write-Host "== $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "[OK]  $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "[!]   $texto" -ForegroundColor Yellow }
function Falla($texto) { Write-Host "[X]   $texto" -ForegroundColor Red; exit 1 }

# Llamar justo despues de un comando de docker: corta el script si devolvio error.
function Revisar($que) {
	if ($LASTEXITCODE -ne 0) { Falla "$que fallo (docker devolvio el codigo $LASTEXITCODE)." }
}

function Probar-Docker {
	docker info *> $null
	if ($LASTEXITCODE -ne 0) { Falla 'Docker no responde. Abre Docker Desktop, espera a que diga "Engine running" y repite.' }
}

function Contenedor-Corriendo($nombre) {
	$estado = docker inspect -f '{{.State.Running}}' $nombre 2>$null
	return (($LASTEXITCODE -eq 0) -and ("$estado".Trim() -eq 'true'))
}

# Una consulta que devuelve un solo valor (texto recortado). Si falla, devuelve '' y deja $LASTEXITCODE distinto de 0.
function Sql-Escalar($contenedor, $usuario, $base, $sql) {
	$r = docker exec $contenedor psql -U $usuario -d $base -At -c $sql
	return "$r".Trim()
}

# Espera a que el Postgres DEFINITIVO acepte conexiones por TCP. pg_isready por socket (el healthcheck del compose) puede dar
# "listo" mientras corre el servidor temporal de inicializacion (init.sql + seed-menu.sql); por TCP solo responde el definitivo.
function Esperar-Postgres($contenedor, $usuario, $base, $segundos = 180) {
	$limite = (Get-Date).AddSeconds($segundos)
	while ((Get-Date) -lt $limite) {
		docker exec $contenedor pg_isready -h 127.0.0.1 -U $usuario -d $base *> $null
		if ($LASTEXITCODE -eq 0) { return }
		Start-Sleep -Seconds 3
	}
	Falla "Postgres no respondio en $segundos s. Mira: docker logs $contenedor --tail 50"
}

# "tabla|filas" para CADA tabla del esquema public (conteo exacto). La consulta va en un archivo para evitar problemas de comillas.
function Obtener-Conteos($contenedor, $usuario, $base) {
	$tablas = @(docker exec $contenedor psql -U $usuario -d $base -At -c "select tablename from pg_tables where schemaname = 'public' order by 1")
	Revisar 'listar las tablas'
	$tablas = @($tablas | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
	if ($tablas.Count -eq 0) { Falla "La base $base no tiene tablas en el esquema public." }

	$partes = $tablas | ForEach-Object { "select '$_' || '|' || count(*) from public.""$_""" }
	$sql = ($partes -join "`nunion all`n") + "`norder by 1;`n"
	$tmp = Join-Path ([IO.Path]::GetTempPath()) ('conteos-' + [guid]::NewGuid().ToString('N') + '.sql')
	[IO.File]::WriteAllText($tmp, $sql, (New-Object Text.UTF8Encoding($false)))
	try {
		docker cp $tmp "${contenedor}:/tmp/conteos.sql" | Out-Null
		Revisar 'copiar conteos.sql al contenedor'
		$filas = @(docker exec $contenedor psql -U $usuario -d $base -At -f /tmp/conteos.sql)
		Revisar 'contar las filas'
		docker exec $contenedor rm -f /tmp/conteos.sql | Out-Null
	}
	finally {
		Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
	}
	return @($filas | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
}

# Devuelve las diferencias ("tabla: origen X / copia Y"); vacio = identicas.
function Comparar-Conteos($origen, $copia) {
	$a = @{}
	foreach ($l in $origen) { if ("$l".Trim()) { $p = "$l".Trim().Split('|'); $a[$p[0]] = [int64]$p[1] } }
	$b = @{}
	foreach ($l in $copia) { if ("$l".Trim()) { $p = "$l".Trim().Split('|'); $b[$p[0]] = [int64]$p[1] } }
	$dif = @()
	foreach ($t in (@($a.Keys) + @($b.Keys) | Sort-Object -Unique)) {
		if ($a[$t] -ne $b[$t]) { $dif += ('{0}: origen {1} / copia {2}' -f $t, $a[$t], $b[$t]) }
	}
	return $dif
}

function Hash-Archivo($ruta) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $ruta).Hash.ToLower() }

function Tamano($bytes) {
	if ($bytes -ge 1MB) { return ('{0:N1} MB' -f ($bytes / 1MB)) }
	if ($bytes -ge 1KB) { return ('{0:N0} KB' -f ($bytes / 1KB)) }
	return "$bytes B"
}
