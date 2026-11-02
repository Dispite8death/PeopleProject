. "$PSScriptRoot/common.ps1"
$s=Read-Settings
$lock=Lock-Project
try {
    $nginx=Get-OwnedProcess 'nginx'
    if($nginx) {
        $pidFile=Join-Path $LocalDir 'run/nginx.pid'
        if(!(Test-Path $pidFile) -or [int](Get-Content $pidFile) -ne $nginx.Id){throw 'nginx PID identity mismatch; refusing to signal.'}
        & (Join-Path $s.nginx 'nginx.exe') -p ($s.nginx.Replace('\','/')+'/') -c (Join-Path $LocalDir 'nginx.conf') -s quit
        if(!$nginx.WaitForExit(10000)){throw 'nginx did not exit; no forced termination was performed.'}
    }
    $php=Get-OwnedProcess 'php'
    if($php){Stop-Process -Id $php.Id; $php.WaitForExit(5000)|Out-Null}
    $db=Get-OwnedProcess 'mariadb'
    if($db){
        & (Join-Path $s.mariadb 'bin/mariadb-admin.exe') "--defaults-file=$(Join-Path $LocalDir 'admin.ini')" shutdown
        if($LASTEXITCODE -ne 0 -or !$db.WaitForExit(15000)){throw 'MariaDB graceful shutdown failed. Data process was not killed.'}
    }
    Write-Output 'Project processes stopped.'
} finally {$lock.Dispose()}
