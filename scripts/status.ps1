. "$PSScriptRoot/common.ps1"
$s=Read-Settings
foreach($c in @(@('nginx',$s.httpPort),@('php',$s.fcgiPort),@('mariadb',$s.dbPort))) {
    $proc=Get-OwnedProcess $c[0]
    [pscustomobject]@{Component=$c[0];PID=if($proc){$proc.Id}else{$null};Owned=[bool]$proc;Port=$c[1];Listening=(Test-Port $c[1])}
}
Write-Output "URL: http://127.0.0.1:$($s.httpPort)"
