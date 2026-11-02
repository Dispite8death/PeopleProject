$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not ('Pokemon.NativePath' -as [type])) {
    Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; namespace Pokemon { public static class NativePath { [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern uint GetShortPathName(string path, StringBuilder output, uint size); [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern uint QueryDosDevice(string device, StringBuilder output, int size); [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder output, ref int size); }}'
}
function Get-NativePath([string]$Path) {
    $buffer=New-Object Text.StringBuilder 4096
    $length=[Pokemon.NativePath]::GetShortPathName($Path,$buffer,4096)
    if($length -gt 0) {return $buffer.ToString()}
    return $Path
}
$mappingFile=Join-Path $ProjectRoot '.local/drive.json'
$mappedDrives=@{}
foreach($letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray()) {
    $device=New-Object Text.StringBuilder 4096
    if([Pokemon.NativePath]::QueryDosDevice("${letter}:",$device,4096) -gt 0 -and $device.ToString().StartsWith('\??\')) {$mappedDrives[[string]$letter]=$device.ToString().Substring(4)}
}
$drive=$null
foreach($key in ($mappedDrives.Keys|Sort-Object)) {if($mappedDrives[$key] -eq $ProjectRoot){$drive=$key;break}}
if(!$drive -and (Test-Path -LiteralPath $mappingFile)) {$drive=(Get-Content -LiteralPath $mappingFile -Raw -Encoding UTF8|ConvertFrom-Json).drive}
if($drive -and !$mappedDrives.ContainsKey($drive) -and (Test-Path "${drive}:\")) {throw "Project drive ${drive}: is used by another volume. No mapping changed."}
if($drive -and $mappedDrives.ContainsKey($drive) -and $mappedDrives[$drive] -ne $ProjectRoot) {throw "Project drive ${drive}: belongs to another directory. No mapping changed."}
if(!$drive) {foreach($candidate in @('P','Q','R','S','T','U','V','W','X','Y','Z')) {if(!(Test-Path "${candidate}:\") -and !$mappedDrives.ContainsKey($candidate)) {$drive=$candidate;break}}}
if(!$drive){throw 'No free drive letter for the project Unicode-path alias.'}
if(!$mappedDrives.ContainsKey($drive)) {& subst.exe "${drive}:" $ProjectRoot;if($LASTEXITCODE -ne 0){throw 'Could not create project drive alias.'}}
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot '.local')|Out-Null
[IO.File]::WriteAllText($mappingFile,(@{drive=$drive}|ConvertTo-Json))
$RuntimeProjectRoot="${drive}:\"
$LocalDir = Join-Path $RuntimeProjectRoot '.local'
$SettingsPath = Join-Path $LocalDir 'settings.json'
function Read-Settings {
    if (!(Test-Path -LiteralPath $SettingsPath)) { throw 'Run scripts/setup.ps1 first.' }
    Get-Content -LiteralPath $SettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Write-Utf8([string]$Path,[string]$Value) {
    [IO.File]::WriteAllText($Path,$Value,(New-Object Text.UTF8Encoding($false)))
}
function Test-Port([int]$Port) {
    $client = New-Object Net.Sockets.TcpClient
    try { $task=$client.ConnectAsync('127.0.0.1',$Port); if (!$task.Wait(300)) {return $false}; return $client.Connected } catch {return $false} finally {$client.Dispose()}
}
function Find-Port([int]$Start) {
    for($port=$Start; $port -lt $Start+50; $port++) {
        $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,$port)
        try {$listener.Start();return $port} catch {} finally {$listener.Stop()}
    }
    throw 'No available port in range.'
}
function Wait-Port([int]$Port) {
    for($i=0;$i -lt 80;$i++) {if(Test-Port $Port){return};Start-Sleep -Milliseconds 250}
    throw "Port $Port did not become available. See .local/logs."
}
function Quote-Arg([string]$Value) { '"' + $Value.Replace('"','\"') + '"' }
function Get-ExecutablePath($Process) {
    $buffer=New-Object Text.StringBuilder 4096
    $size=4096
    if(![Pokemon.NativePath]::QueryFullProcessImageName($Process.Handle,0,$buffer,[ref]$size)){throw 'Could not verify process executable.'}
    return $buffer.ToString()
}
function Get-OwnedProcess([string]$Name) {
    $file=Join-Path $LocalDir "run/$Name.json"
    if (!(Test-Path -LiteralPath $file)) {return $null}
    $record=Get-Content -LiteralPath $file -Raw -Encoding UTF8|ConvertFrom-Json
    $proc=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if($proc -and (Get-ExecutablePath $proc) -eq $record.path -and $proc.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.started) {return $proc}
    return $null
}
function Start-Owned([string]$Name,[string]$Exe,[string[]]$Arguments,[string]$WorkingDirectory) {
    $proc=Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LocalDir "logs/$Name-out.log") -RedirectStandardError (Join-Path $LocalDir "logs/$Name-err.log")
    Write-Utf8 (Join-Path $LocalDir "run/$Name.json") (@{pid=$proc.Id;path=(Get-ExecutablePath $proc);started=$proc.StartTime.ToUniversalTime().Ticks.ToString()}|ConvertTo-Json)
    return $proc
}
function Lock-Project {
    try {return [IO.File]::Open((Join-Path $LocalDir 'run/control.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
    catch {throw 'Another project start/stop operation is running.'}
}
