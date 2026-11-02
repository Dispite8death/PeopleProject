param([switch]$SkipDownload)
. "$PSScriptRoot/common.ps1"
foreach($dir in @('downloads','runtime','data','logs','run','sessions')) {New-Item -ItemType Directory -Force -Path (Join-Path $LocalDir $dir)|Out-Null}
if(Test-Path -LiteralPath $SettingsPath) {Write-Output 'Already configured. Existing configuration and database were preserved.';exit 0}
$archives=@(
 @{name='php';url='https://downloads.php.net/~windows/releases/archives/php-8.5.12-1-nts-Win32-vs17-x64.zip';hash='2a36a2edcb7a5b9252f638fd5e4cf84d7f6e066092654220dc0b63e5cf4e9723';folder='php'},
 @{name='nginx';url='https://nginx.org/download/nginx-1.31.8.zip';hash='fbb1501009be34655cc238d460714cf20391b639013f4c73859813d7938783fd';folder=''},
 @{name='mariadb';url='https://downloads.mariadb.org/rest-api/mariadb/11.8.9/mariadb-11.8.9-winx64.zip';hash='830c46727d9278eae212ae3eca44eeb9e71b2a68704e95f344a64fba7b1963f5';folder=''}
)
foreach($a in $archives) {
    $zip=Join-Path $LocalDir "downloads/$($a.name).zip"
    if(!(Test-Path -LiteralPath $zip)) {if($SkipDownload){throw "Missing $zip"};Invoke-WebRequest -Uri $a.url -OutFile $zip}
    if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $a.hash) {throw "Checksum mismatch: $($a.name)"}
    $destination=Join-Path $LocalDir "runtime/$($a.folder)"
    Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force
}
$s=@{httpPort=(Find-Port 8080);fcgiPort=(Find-Port 9070);dbPort=(Find-Port 3307);php=(Join-Path $LocalDir 'runtime/php');nginx=(Join-Path $LocalDir 'runtime/nginx-1.31.8');mariadb=(Join-Path $LocalDir 'runtime/mariadb-11.8.9-winx64')}
# The project-only SUBST drive avoids nginx's unsupported Cyrillic/short-name paths.
$runtimeRoot=$RuntimeProjectRoot
$runtimeLocal=Join-Path $runtimeRoot '.local'
$replacements=@{'@ROOT@'=$runtimeRoot;'@LOCAL@'=$runtimeLocal;'@PHP@'=$s.php;'@NGINX@'=$s.nginx;'@HTTP@'=[string]$s.httpPort;'@FCGI@'=[string]$s.fcgiPort}
foreach($pair in @(@('nginx.conf.template','nginx.conf'),@('php.ini.template','php.ini'))) {
    $text=Get-Content -LiteralPath (Join-Path $ProjectRoot "config/$($pair[0])") -Raw -Encoding UTF8
    foreach($key in $replacements.Keys) {$text=$text.Replace($key,$replacements[$key].Replace('\','/'))}
    Write-Utf8 (Join-Path $LocalDir $pair[1]) $text
}
& (Join-Path $s.php 'php.exe') -c (Join-Path $LocalDir 'php.ini') -v
if($LASTEXITCODE -ne 0){throw 'PHP cannot start; check Visual C++ x64 Runtime.'}
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
function New-Secret { $bytes=New-Object byte[] 24; $rng.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant() }
$rootSecret=New-Secret
$appSecret=New-Secret
$dbDir=Join-Path $LocalDir 'data/mariadb'
if(Test-Path -LiteralPath (Join-Path $dbDir 'mysql')) {throw 'Existing database found without settings; preserve it and recover configuration manually.'}
$initSql=Join-Path $LocalDir 'run/init.sql'
$sql="CREATE DATABASE IF NOT EXISTS pokemon_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`nCREATE USER IF NOT EXISTS 'pokemon_app'@'127.0.0.1' IDENTIFIED BY '$appSecret';`nGRANT ALL PRIVILEGES ON pokemon_local.* TO 'pokemon_app'@'127.0.0.1';`nALTER USER 'root'@'localhost' IDENTIFIED BY '$rootSecret';`nCREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$rootSecret';`nALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '$rootSecret';`nCREATE USER IF NOT EXISTS 'root'@'::1' IDENTIFIED BY '$rootSecret';`nALTER USER 'root'@'::1' IDENTIFIED BY '$rootSecret';`n"
Write-Utf8 $initSql $sql
$install=Join-Path $s.mariadb 'bin/mariadb-install-db.exe'
& $install "--datadir=$dbDir" "--port=$($s.dbPort)" --skip-networking
if($LASTEXITCODE -ne 0){throw 'MariaDB initialization failed.'}
$dbConfig="[mysqld]`nbasedir=""$($s.mariadb.Replace('\','/'))""`ndatadir=""$($dbDir.Replace('\','/'))""`nbind-address=127.0.0.1`nport=$($s.dbPort)`ncharacter-set-server=utf8mb4`ncollation-server=utf8mb4_unicode_ci`nskip-name-resolve`nlog-error=""$($LocalDir.Replace('\','/'))/logs/mariadb.log""`npid-file=""$($LocalDir.Replace('\','/'))/run/mariadb.pid""`n"
Write-Utf8 (Join-Path $LocalDir 'my.ini') $dbConfig
$admin="[client]`nuser=root`npassword=$rootSecret`nhost=127.0.0.1`nport=$($s.dbPort)`n"
Write-Utf8 (Join-Path $LocalDir 'admin.ini') $admin
$localConfig=@{mode='demo';apiBase='/api/v1';timezone='Asia/Magadan';database=@{host='127.0.0.1';port=$s.dbPort;name='pokemon_local';user='pokemon_app';password=$appSecret}}
Write-Utf8 (Join-Path $ProjectRoot 'config/local.json') ($localConfig|ConvertTo-Json -Depth 4)
Write-Utf8 $SettingsPath ($s|ConvertTo-Json)
# init-file runs before the server accepts connections; secrets never appear in process arguments.
$proc=Start-Owned 'mariadb' (Join-Path $s.mariadb 'bin/mariadbd.exe') @((Quote-Arg "--defaults-file=$(Join-Path $LocalDir 'my.ini')"),(Quote-Arg "--init-file=$initSql"),'--console') $s.mariadb
Wait-Port $s.dbPort
& (Join-Path $s.php 'php.exe') -c (Join-Path $LocalDir 'php.ini') (Join-Path $PSScriptRoot 'check-db.php')
if($LASTEXITCODE -ne 0){throw 'Database connection check failed; inspect local logs.'}
Remove-Item -LiteralPath $initSql
Write-Output "Configured. Run scripts/start.ps1. HTTP port: $($s.httpPort)"
