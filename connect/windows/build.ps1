param([string]$Output = "$PSScriptRoot\output")
$ErrorActionPreference = 'Stop'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $csc)) { throw 'Compilador .NET Framework x64 indisponível' }
New-Item -ItemType Directory -Force $Output | Out-Null
$client = Join-Path $Output 'NeoPepConnect.exe'
$setup = Join-Path $Output 'NeoPepConnectSetup.exe'
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$client" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:System.Web.Extensions.dll "$PSScriptRoot\Connect.cs"
if ($LASTEXITCODE) { throw 'Falha ao compilar o cliente' }
& $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$setup" /r:System.Windows.Forms.dll "/resource:$client,NeoPepConnect.exe" "$PSScriptRoot\Installer.cs"
if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador' }
$hash = (Get-FileHash -Algorithm SHA256 $setup).Hash.ToLowerInvariant()
[ordered]@{ version='0.1.0'; bytes=(Get-Item $setup).Length; sha256=$hash; platform='win-x64'; built_at=(Get-Date).ToUniversalTime().ToString('o') } |
  ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'manifest.json')
