. "$PSScriptRoot/common.ps1"
$s=Read-Settings
$lock=Lock-Project
try {
    $components=@(
      @{name='mariadb';port=$s.dbPort;exe=(Join-Path $s.mariadb 'bin/mariadbd.exe');args=@((Quote-Arg "--defaults-file=$(Join-Path $LocalDir 'my.ini')"),'--console');dir=$s.mariadb},
      @{name='php';port=$s.fcgiPort;exe=(Join-Path $s.php 'php-cgi.exe');args=@('-c',(Quote-Arg (Join-Path $LocalDir 'php.ini')),'-b',"127.0.0.1:$($s.fcgiPort)");dir=$ProjectRoot},
      @{name='nginx';port=$s.httpPort;exe=(Join-Path $s.nginx 'nginx.exe');args=@('-p',(Quote-Arg ($s.nginx.Replace('\','/')+'/')),'-c',(Quote-Arg (Join-Path $LocalDir 'nginx.conf')));dir=$s.nginx}
    )
    foreach($c in $components) {
        $owned=Get-OwnedProcess $c.name
        if($owned) {if(!(Test-Port $c.port)){throw "$($c.name) is running but not ready. Check logs."};continue}
        if(Test-Port $c.port){throw "Port $($c.port) is occupied by another process. Nothing was stopped. Update local ports/configuration."}
        if($c.name -eq 'nginx') {
            & $c.exe -p ($s.nginx.Replace('\','/')+'/') -c (Join-Path $LocalDir 'nginx.conf') -t
            if($LASTEXITCODE -ne 0){throw 'nginx configuration is invalid.'}
        }
        $null=Start-Owned $c.name $c.exe $c.args $c.dir
        Wait-Port $c.port
    }
    Write-Output "POKEMON: http://127.0.0.1:$($s.httpPort)"
} finally {$lock.Dispose()}
