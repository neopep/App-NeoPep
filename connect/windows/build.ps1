param(
  [string]$Output = "$PSScriptRoot\output",
  [ValidateSet('Teste','Producao')][string]$Perfil = 'Teste'
)
$ErrorActionPreference = 'Stop'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $csc)) { throw 'Compilador .NET Framework x64 indisponível' }
New-Item -ItemType Directory -Force $Output | Out-Null
$client = Join-Path $Output 'NeoPepConnect.exe'
$setup = Join-Path $Output 'NeoPepConnectSetup.exe'
$define = if ($Perfil -eq 'Producao') { '/define:NEOPEP_PRODUCTION' } else { '/define:NEOPEP_STAGING' }

& $csc /nologo /target:winexe /platform:x64 /codepage:65001 $define "/out:$client" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:System.Web.Extensions.dll "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\Connect.cs"
if ($LASTEXITCODE) { throw 'Falha ao compilar o cliente' }
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 $define "/out:$setup" /r:System.Windows.Forms.dll "$PSScriptRoot\ConnectProfile.cs" "/resource:$client,NeoPepConnect.exe" "$PSScriptRoot\Installer.cs"
if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador' }

$hash = (Get-FileHash -Algorithm SHA256 $setup).Hash.ToLowerInvariant()
[ordered]@{
  version = '0.1.2'
  profile = if ($Perfil -eq 'Teste') { 'staging' } else { 'production' }
  connect_enabled = ($Perfil -eq 'Teste')
  bytes = (Get-Item $setup).Length
  sha256 = $hash
  platform = 'win-x64'
  built_at = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'manifest.json')
