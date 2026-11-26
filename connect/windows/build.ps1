param(
    [string]$Output = "$PSScriptRoot\output",
    [ValidateSet('Teste')][string]$Perfil = 'Teste',
    [string]$PublisherPublicKey = '',
    [ValidatePattern('^(0|[1-9][0-9]{0,4})(\.(0|[1-9][0-9]{0,4})){2}$')][string]$Version = '0.2.8'
)
$ErrorActionPreference = 'Stop'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path $csc)) { throw 'Compilador .NET Framework x64 indisponivel' }
if (($Version.Split('.') | Where-Object { [int]$_ -gt 65534 })) { throw 'Versao incompativel com o perfil' }
$commit = (& git -C $PSScriptRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Commit nao identificado' }
New-Item -ItemType Directory -Force $Output | Out-Null
$client = Join-Path $Output 'NeoPepConnect.exe'
$setup = Join-Path $Output 'NeoPepConnectSetup.exe'
$archive = Join-Path $Output 'whatsapp-runtime.zip'
$bundle = Join-Path $env:TEMP ('neopep-runtime-' + [Guid]::NewGuid().ToString('N'))
$runtimeResources = @()
$trustResource = @()
$webview = Join-Path $env:TEMP ('neopep-webview-' + [Guid]::NewGuid().ToString('N'))
$webviewArchive = $webview+'.zip'
$webviewVersion='1.0.3179.45'
$webviewHash='70bd381c5d67f97a6a80294001cde125ab5b24b6d36098ad901d8e15efd752d0'
if ($PublisherPublicKey) {
    $key = (Resolve-Path $PublisherPublicKey).Path
    [xml]$publicXml = Get-Content $key -Raw
    $properties = @($publicXml.RSAKeyValue.ChildNodes | Where-Object { $_.NodeType -eq 'Element' } | ForEach-Object { $_.Name })
    if ($properties.Count -ne 2 -or $properties -notcontains 'Modulus' -or $properties -notcontains 'Exponent') {
        throw 'Apenas uma chave publica RSA XML e aceita'
    }
    $trustResource = @("/resource:$key,NeoPepUpdatePublisher")
}
$versionSource = Join-Path $env:TEMP ('neopep-version-' + [Guid]::NewGuid().ToString('N') + '.cs')
try {
    @"
[assembly: System.Reflection.AssemblyFileVersion("$Version.0")]
internal static class ConnectVersion {
    internal const string Number = "$Version";
    internal const string Runtime = "whatsapp-runtime-$Version";
}
"@ | Set-Content -Encoding UTF8 $versionSource
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
    foreach ($name in @('windows-bridge.mjs','whatsapp-provider.mjs','video-preview.mjs','video-preview-cli.mjs','package.json','package-lock.json','node_modules')) {
        Copy-Item (Join-Path $lab $name) $bridge -Recurse
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Remove-Item $archive -ErrorAction SilentlyContinue
    [IO.Compression.ZipFile]::CreateFromDirectory($bundle,$archive)
    $helper = Join-Path $Output 'NeoPepUpdate.exe'
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/out:$helper" /r:System.Web.Extensions.dll /r:System.Security.dll @trustResource "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\UpdateTrust.cs" "$PSScriptRoot\UpdateHelper.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar auxiliar de atualizacao' }
    $runtimeResources = @("/resource:$archive,whatsapp-runtime.zip", "/resource:$helper,NeoPepUpdate.exe")
    $webviewUri="https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$webviewVersion/microsoft.web.webview2.$webviewVersion.nupkg"
    Invoke-WebRequest -UseBasicParsing -Uri $webviewUri -OutFile $webviewArchive -MaximumRedirection 0 -TimeoutSec 90
    if((Get-FileHash -Algorithm SHA256 $webviewArchive).Hash.ToLowerInvariant() -cne $webviewHash){throw 'SDK WebView2 diverge do pacote fixado'}
    [IO.Compression.ZipFile]::ExtractToDirectory($webviewArchive,$webview)
    $wvCore=Join-Path $webview 'lib/net462/Microsoft.Web.WebView2.Core.dll'
    $wvForms=Join-Path $webview 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
    $wvLoader=Join-Path $webview 'runtimes/win-x64/native/WebView2Loader.dll'
    $wvReferences=@("/r:$wvCore","/r:$wvForms")
    $runtimeResources+=@("/resource:$wvCore,Microsoft.Web.WebView2.Core.dll","/resource:$wvForms,Microsoft.Web.WebView2.WinForms.dll","/resource:$wvLoader,WebView2Loader.dll")
    foreach($dependency in @($wvCore,$wvForms,$wvLoader)){Copy-Item -LiteralPath $dependency -Destination $Output -Force}
    $icon = Join-Path $PSScriptRoot 'neopep.ico'
    $brand = Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'dist/assets/icon-192.png'
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 /warnaserror:4014 "/win32icon:$icon" "/resource:$brand,NeoPepBrand" "/out:$client" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:System.Web.Extensions.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll @trustResource @wvReferences $versionSource "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\Turnstile.cs" "$PSScriptRoot\Connect.cs" "$PSScriptRoot\VideoPreview.cs" "$PSScriptRoot\ConnectTheme.cs" "$PSScriptRoot\WhatsApp.cs" "$PSScriptRoot\CampaignComposer.cs" "$PSScriptRoot\UpdateTrust.cs" "$PSScriptRoot\UpdateUi.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o cliente' }
    & $csc /nologo /target:winexe /platform:x64 /codepage:65001 "/win32icon:$icon" "/out:$setup" /r:System.Windows.Forms.dll /r:System.IO.Compression.FileSystem.dll "/resource:$client,NeoPepConnect.exe" @runtimeResources $versionSource "$PSScriptRoot\ConnectProfile.cs" "$PSScriptRoot\Installer.cs"
    if ($LASTEXITCODE) { throw 'Falha ao compilar o instalador' }
    $hash = (Get-FileHash -Algorithm SHA256 $setup).Hash.ToLowerInvariant()
    [ordered]@{
        version=$Version; profile='staging'; supported_profiles=@('staging','production'); connect_enabled=$true; commit=$commit
        updater_trust_configured=($trustResource.Count -gt 0)
        run_id=$env:GITHUB_RUN_ID; run_attempt=$env:GITHUB_RUN_ATTEMPT; file='NeoPepConnectSetup.exe'
        bytes=(Get-Item $setup).Length; sha256=$hash; platform='win-x64'; built_at=(Get-Date).ToUniversalTime().ToString('o')
        node='24.22.1'; authenticode=(Get-AuthenticodeSignature $setup).Status.ToString()
    } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Output 'manifest.json')
} finally {
    Remove-Item $versionSource -Force -ErrorAction SilentlyContinue
    Remove-Item $bundle -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $archive,$webviewArchive -Force -ErrorAction SilentlyContinue
    Remove-Item $webview -Recurse -Force -ErrorAction SilentlyContinue
}
