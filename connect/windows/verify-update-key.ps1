param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'NeoPep Connect'),
    [ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$SigningThumbprint
)
$ErrorActionPreference = 'Stop'
function Read-Pin([string]$path) {
    $assembly = [Reflection.Assembly]::Load([IO.File]::ReadAllBytes($path))
    $stream = $assembly.GetManifestResourceStream('NeoPepUpdatePublisher')
    if ($null -eq $stream) { throw 'Este binário não tem chave de atualização incorporada.' }
    $reader = New-Object IO.StreamReader($stream)
    try {
        [xml]$xml = $reader.ReadToEnd()
        $modulus = [Convert]::ToBase64String([Convert]::FromBase64String($xml.RSAKeyValue.Modulus))
        $exponent = [Convert]::ToBase64String([Convert]::FromBase64String($xml.RSAKeyValue.Exponent))
        return "<RSAKeyValue><Modulus>$modulus</Modulus><Exponent>$exponent</Exponent></RSAKeyValue>"
    } finally { $reader.Dispose() }
}
$client = Join-Path $InstallDir 'NeoPepConnect.exe'
$version = (Get-Item -LiteralPath $client).VersionInfo
if ($version.FileMajorPart -ne 0 -or $version.FileMinorPart -ne 2 -or $version.FileBuildPart -ne 3) {
    throw 'A instalação verificada deve ser a versão 0.2.3.'
}
$pin = Read-Pin $client
if ($pin -cne (Read-Pin (Join-Path $InstallDir 'NeoPepUpdate-0.2.3.exe'))) {
    throw 'O cliente e o auxiliar não confiam na mesma chave.'
}
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $fingerprint = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($pin))).Replace('-','').ToLowerInvariant()
} finally { $sha.Dispose() }
if (!$SigningThumbprint) {
    [pscustomobject]@{Version='0.2.3'; PublicKeySha256=$fingerprint; PrivateKeyVerified=$false}
    return
}
$certificate = Get-Item -LiteralPath ("Cert:\CurrentUser\My\"+$SigningThumbprint)
$private = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($certificate)
if ($null -eq $private) { throw 'O certificado informado não tem chave privada acessível nesta conta.' }
$public = New-Object Security.Cryptography.RSACryptoServiceProvider
$public.PersistKeyInCsp = $false
try {
    $public.FromXmlString($pin)
    $challenge = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($challenge) } finally { $rng.Dispose() }
    $algorithm = [Security.Cryptography.HashAlgorithmName]::SHA256
    $padding = [Security.Cryptography.RSASignaturePadding]::Pkcs1
    $signature = $private.SignData($challenge,$algorithm,$padding)
    if (!$public.VerifyData($challenge,$signature,$algorithm,$padding)) {
        throw 'A chave do certificado não corresponde à chave incorporada no 0.2.3.'
    }
    [pscustomobject]@{Version='0.2.3'; PublicKeySha256=$fingerprint; PrivateKeyVerified=$true}
} finally { $private.Dispose(); $public.Dispose() }
