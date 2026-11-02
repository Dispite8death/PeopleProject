. "$PSScriptRoot/common.ps1"
$s=Read-Settings
$php=Join-Path $s.php 'php.exe'
$ini=Join-Path $LocalDir 'php.ini'
Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'app'),(Join-Path $ProjectRoot 'templates'),(Join-Path $ProjectRoot 'public'),$PSScriptRoot -Filter '*.php' -Recurse | ForEach-Object {
    & $php -c $ini -l $_.FullName
    if($LASTEXITCODE -ne 0){throw "PHP syntax failed: $($_.Name)"}
}
& (Join-Path $s.nginx 'nginx.exe') -p ($s.nginx.Replace('\','/')+'/') -c (Join-Path $LocalDir 'nginx.conf') -t
if($LASTEXITCODE -ne 0){throw 'nginx configuration check failed'}
& $php -c $ini (Join-Path $PSScriptRoot 'check-db.php')
if($LASTEXITCODE -ne 0){throw 'PDO connection check failed'}
$url="http://127.0.0.1:$($s.httpPort)"
$response=Invoke-WebRequest -Uri $url -UseBasicParsing
if($response.StatusCode -ne 200 -or $response.Content -notmatch 'app-config' -or $response.Content -match '<\?php'){throw 'PHP HTTP rendering failed'}
foreach($path in @('/config/local.json','/.local/admin.ini','/.env','/app/database.php','/scripts/check-db.php','/tests/demo.test.js','/unknown.php')) {
    try {$response=Invoke-WebRequest -Uri "$url$path" -UseBasicParsing;throw "Protected path is accessible: $path"}
    catch {if(!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 404){throw}}
}
try {Invoke-WebRequest -Uri "$url/api/v1/workspace" -UseBasicParsing|Out-Null;throw 'Unimplemented API returned success'}
catch {if(!$_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 501){throw}}
Write-Output 'HTTP rendering, private-path protection and API stub: OK'
if(Get-Command node -ErrorAction SilentlyContinue) {
    Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'public/assets/js') -Filter '*.js' | ForEach-Object {& node --check $_.FullName;if($LASTEXITCODE -ne 0){throw 'JavaScript syntax failed'}}
    & node --test (Join-Path $ProjectRoot 'tests/demo.test.js')
    if($LASTEXITCODE -ne 0){throw 'Demo scenario tests failed'}
}
