param([string]$Output = "$PSScriptRoot\output")
$ErrorActionPreference = 'Stop'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $csc)) { throw 'Compilador .NET Framework x64 indisponível' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$nodeVersion = & $node -p 'process.platform + ":" + process.arch + ":" + process.versions.node'
if ($nodeVersion -ne 'win32:x64:24.22.1') { throw "Runtime incompatível: $nodeVersion" }
$signature = Get-AuthenticodeSignature $node
if ($signature.Status -ne 'Valid') { throw "Assinatura do Node.js inválida: $($signature.Status)" }
$lab = Join-Path (Split-Path $PSScriptRoot) 'whatsapp-lab'
if (!(Test-Path (Join-Path $lab 'node_modules'))) { throw 'Execute npm ci no laboratório antes de compilar.' }
New-Item -ItemType Directory -Force $Output | Out-Null
$client = Join-Path $Output 'NeoPepConnect.exe'
$setup = Join-Path $Output 'NeoPepConnectSetup.exe'
$archive = Join-Path $Output 'whatsapp-runtime.zip'
$bundle = Join-Path $env:TEMP ('neopep-runtime-' + [Guid]::NewGuid().ToString('N'))
try {
    $bridge = Join-Path $bundle 'bridge'
    New-Item -ItemType Directory -Force $bridge | Out-Null
    Copy-Item $node (Join-Path $bundle 'node.exe')
    foreach ($name in @('windows-bridge.mjs','whatsapp-provider.mjs','package.json','package-lock.json','node_modules')) {
        Copy-Item (Join-Path $lab $name) $bridge -Recurse
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Remove-Item $archive -ErrorAction SilentlyContinue
    [IO.Compression.ZipFile]::CreateFromDirectory($bundle,$archive)
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$client" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:System.Web.Extensions.dll "$PSScriptRoot\Connect.cs" "$PSScriptRoot\WhatsApp.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o cliente' }
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$setup" /r:System.Windows.Forms.dll /r:System.IO.Compression.FileSystem.dll "/resource:$client,NeoPepConnect.exe" "/resource:$archive,whatsapp-runtime.zip" "$PSScriptRoot\Installer.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador' }
    $hash = (Get-FileHash -Algorithm SHA256 $setup).Hash.ToLowerInvariant()
    [ordered]@{ version='0.2.0'; bytes=(Get-Item $setup).Length; sha256=$hash; platform='win-x64'; node='24.22.1'; built_at=(Get-Date).ToUniversalTime().ToString('o') } |
      ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'manifest.json')
} finally {
    Remove-Item $bundle -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $archive -Force -ErrorAction SilentlyContinue
}
