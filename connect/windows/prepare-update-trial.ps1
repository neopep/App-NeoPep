param(
    [Parameter(Mandatory=$true)][string]$Output,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$SigningThumbprint
)
$ErrorActionPreference = 'Stop'
$repo = (& git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
$commit = (& git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -or $commit -notmatch '^[0-9a-f]{40}$') { throw 'Commit nao identificado' }
if (git -C $repo status --porcelain) { throw 'Use um checkout limpo e revisado' }
$destination = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)
$repoPath = (Resolve-Path $repo).Path.TrimEnd('\') + '\'
if (($destination.TrimEnd('\')+'\').StartsWith($repoPath,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path $destination)) {
    throw 'Escolha uma pasta nova fora do checkout'
}
$cert = Get-Item ("Cert:\CurrentUser\My\" + $SigningThumbprint)
if ($cert.Subject -ne 'CN=NeoPep Connect Teste Update Signing' -or !$cert.HasPrivateKey -or
    $cert.NotBefore -gt (Get-Date) -or $cert.NotAfter -lt (Get-Date)) { throw 'Certificado de assinatura Teste invalido' }
$private = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
$public = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPublicKey($cert)
try {
    if ($null -eq $private -or $null -eq $public -or $public.KeySize -lt 3072 -or
        !($private -is [System.Security.Cryptography.RSACng]) -or
        $private.Key.ExportPolicy -ne [System.Security.Cryptography.CngExportPolicies]::None) {
        throw 'Use chave RSA CNG nao exportavel de ao menos 3072 bits'
    }
    New-Item -ItemType Directory $destination | Out-Null
    $publicFile = Join-Path $destination 'publisher-public.xml'
    $parameters = $public.ExportParameters($false)
    $modulus = [Convert]::ToBase64String($parameters.Modulus)
    $exponent = [Convert]::ToBase64String($parameters.Exponent)
    Set-Content -LiteralPath $publicFile -Encoding ASCII -Value "<RSAKeyValue><Modulus>$modulus</Modulus><Exponent>$exponent</Exponent></RSAKeyValue>"
    foreach ($version in @('0.2.2','0.2.3')) {
        $candidate = Join-Path $destination $version
        & (Join-Path $PSScriptRoot 'build.ps1') -Perfil Teste -Version $version -PublisherPublicKey $publicFile -Output $candidate
        $setup = Join-Path $candidate 'NeoPepConnectSetup.exe'
        $built = Get-Content -LiteralPath (Join-Path $candidate 'manifest.json') -Raw | ConvertFrom-Json
        $hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
        $bytes = (Get-Item -LiteralPath $setup).Length
        if ($bytes -gt 52428800 -or $built.version -ne $version -or $built.profile -ne 'staging' -or
            $built.commit -ne $commit -or !$built.updater_trust_configured -or $built.bytes -ne $bytes -or $built.sha256 -ne $hash -or
            (Get-Item -LiteralPath $setup).VersionInfo.FileVersion -ne "$version.0") { throw "Candidato inconsistente: $version" }
        $artifact = "ensaio-$version-" + $commit.Substring(0,12)
        $canonical = [Text.Encoding]::UTF8.GetBytes(@('neopep-connect/v1',$version,'staging','stable',
          $bytes.ToString([Globalization.CultureInfo]::InvariantCulture),$hash,$artifact) -join "`n")
        $algorithm = [System.Security.Cryptography.HashAlgorithmName]::SHA256
        $padding = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
        $signature = $private.SignData($canonical,$algorithm,$padding)
        if (!$public.VerifyData($canonical,$signature,$algorithm,$padding)) { throw 'Falha na verificacao do manifesto' }
        [ordered]@{
            version=$version; profile='staging'; channel='stable'; bytes=$bytes; sha256=$hash; artifact=$artifact
            signature=[Convert]::ToBase64String($signature)
        } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $candidate 'release-manifest.json')
        Write-Output "$version  $hash  $bytes bytes"
    }
    Get-FileHash -LiteralPath $publicFile -Algorithm SHA256
} finally {
    if ($private) { $private.Dispose() }
    if ($public) { $public.Dispose() }
}
