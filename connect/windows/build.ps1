param(
    [string]$Output = "$PSScriptRoot\output",
    [ValidateSet('Teste','Producao')][string]$Perfil = 'Teste'
)
$ErrorActionPreference = 'Stop'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $csc)) { throw 'Compilador .NET Framework x64 indisponivel' }
$staging = $Perfil -eq 'Teste'
$define = if ($staging) { '/define:NEOPEP_STAGING' } else { '/define:NEOPEP_PRODUCTION' }
$profile = if ($staging) { 'staging' } else { 'production' }
$commit = (& git -C $PSScriptRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Commit nao identificado' }
New-Item -ItemType Directory -Force $Output | Out-Null
$client = Join-Path $Output 'NeoPepConnect.exe'
$setup = Join-Path $Output 'NeoPepConnectSetup.exe'
$archive = Join-Path $Output 'whatsapp-runtime.zip'
$bundle = Join-Path $env:TEMP ('neopep-runtime-' + [Guid]::NewGuid().ToString('N'))
$runtimeResources = @()
try {
    if ($staging) {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        $nodeVersion = & $node -p '[process.platform,process.arch,process.versions.node].join()'
        if ($nodeVersion -ne 'win32,x64,24.22.1') { throw "Runtime incompativel: $nodeVersion" }
        $signature = Get-AuthenticodeSignature $node
        if ($signature.Status -ne 'Valid') { throw "Assinatura do Node.js invalida: $($signature.Status)" }
        $lab = Join-Path (Split-Path $PSScriptRoot) 'whatsapp-lab'
        if (!(Test-Path (Join-Path $lab 'node_modules'))) { throw 'Execute npm ci no laboratorio antes de compilar.' }
        $bridge = Join-Path $bundle 'bridge'
        New-Item -ItemType Directory -Force $bridge | Out-Null
        Copy-Item $node (Join-Path $bundle 'node.exe')
        foreach ($name in @('windows-bridge.mjs','whatsapp-provider.mjs','package.json','package-lock.json','node_modules')) {
            Copy-Item (Join-Path $lab $name) $bridge -Recurse
        }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        Remove-Item $archive -ErrorAction SilentlyContinue
        [IO.Compression.ZipFile]::CreateFromDirectory($bundle,$archive)
        $runtimeResources = @("/resource:$archive,whatsapp-runtime.zip")
    }
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 $define "/out:$client" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:System.Web.Extensions.dll "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\Connect.cs" "$PSScriptRoot\WhatsApp.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o cliente' }
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 $define "/out:$setup" /r:System.Windows.Forms.dll /r:System.IO.Compression.FileSystem.dll "/resource:$client,NeoPepConnect.exe" @runtimeResources "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\Installer.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador' }
    $hash = (Get-FileHash -Algorithm SHA256 $setup).Hash.ToLowerInvariant()
    [ordered]@{
        version='0.2.1'; profile=$profile; connect_enabled=$staging; commit=$commit
        run_id=$env:GITHUB_RUN_ID; run_attempt=$env:GITHUB_RUN_ATTEMPT; file='NeoPepConnectSetup.exe'
        bytes=(Get-Item $setup).Length; sha256=$hash; platform='win-x64'; built_at=(Get-Date).ToUniversalTime().ToString('o')
        node=if ($staging) { '24.22.1' } else { $null }
    } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'manifest.json')
} finally {
    Remove-Item $bundle -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $archive -Force -ErrorAction SilentlyContinue
}
