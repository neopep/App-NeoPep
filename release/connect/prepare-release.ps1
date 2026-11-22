param(
    [Parameter(Mandatory=$true)][ValidatePattern('\A[0-9]+\z')][string]$RunId,
    [Parameter(Mandatory=$true)][ValidatePattern('\A[a-f0-9]{40}\z')][string]$SourceSha,
    [Parameter(Mandatory=$true)][ValidatePattern('\A(0|[1-9][0-9]{0,7})(\.(0|[1-9][0-9]{0,7})){2}\z')][string]$Version,
    [Parameter(Mandatory=$true)][ValidatePattern('\A[A-Fa-f0-9]{40}\z')][string]$SigningThumbprint,
    [Parameter(Mandatory=$true)][ValidatePattern('\Asb_publishable_[A-Za-z0-9_-]+\z')][string]$PublishableKey
)
$ErrorActionPreference = 'Stop'
$repo = 'neopep/NeoPep-Connect-Build-Privado'
$origin = 'https://qnuluspqfazdppciermw.supabase.co'
$workflow = '.github/workflows/neopep-connect-release.yml'
$dir = Join-Path $env:TEMP ('neopep-release-'+[Guid]::NewGuid().ToString('N'))
$key = $null
$session = $null
$headers = $null
function Get-GitHubJson([string]$endpoint) {
    $result = & gh api $endpoint
    if ($LASTEXITCODE) { throw 'Não foi possível verificar o GitHub autenticado.' }
    return ($result | ConvertFrom-Json)
}
try {
    $source = Get-GitHubJson "repos/$repo"
    $run = Get-GitHubJson "repos/$repo/actions/runs/$RunId"
    if (!$source.private -or $source.full_name -cne $repo -or $run.repository.full_name -cne $repo -or
        $run.head_repository.full_name -cne $repo -or $run.head_branch -cne $source.default_branch -or
        $run.path -cne $workflow -or $run.event -cne 'workflow_dispatch' -or $run.conclusion -cne 'success') {
        throw 'Execução fora do workflow privado revisado ou build sem sucesso.'
    }
    $artifact = "connect-teste-$Version-$RunId-"+$run.run_attempt
    $items = Get-GitHubJson "repos/$repo/actions/runs/$RunId/artifacts?per_page=100"
    $matches = @($items.artifacts | Where-Object { $_.name -ceq $artifact -and !$_.expired })
    if ($matches.Count -ne 1) { throw 'Artefato ausente, duplicado ou expirado.' }
    & gh run download $RunId --repo $repo --name $artifact --dir $dir
    if ($LASTEXITCODE) { throw 'Download autenticado falhou.' }
    $setup = Join-Path $dir 'NeoPepConnectSetup.exe'
    $file = Get-Item -LiteralPath $setup
    $build = Get-Content -LiteralPath (Join-Path $dir 'manifest.json') -Raw | ConvertFrom-Json
    $hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($build.version -cne $Version -or $build.commit -cne $SourceSha -or $build.artifact -cne $artifact -or
        $build.profile -cne 'staging' -or $build.platform -cne 'win-x64' -or
        !$build.connect_enabled -or !$build.updater_trust_configured -or
        [string]$build.run_id -ne $RunId -or $build.run_attempt -ne $run.run_attempt -or
        $build.bytes -ne $file.Length -or $file.Length -gt 52428800 -or $file.Length -lt 1 -or
        $file.VersionInfo.FileVersion -ne "$Version.0" -or $build.sha256 -cne $hash) {
        throw 'O artefato não corresponde à versão e ao SHA de origem revisados.'
    }
    $cert = Get-Item -LiteralPath ("Cert:\CurrentUser\My\"+$SigningThumbprint)
    if ($cert.NotAfter -lt (Get-Date) -or $cert.NotBefore -gt (Get-Date)) { throw 'Certificado fora da validade.' }
    $key = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
    if (!($key -is [Security.Cryptography.RSACng]) -or $key.KeySize -lt 3072 -or
         $key.Key.ExportPolicy -ne [Security.Cryptography.CngExportPolicies]::None) { throw 'A assinatura exige chave CNG não exportável.' }
    $pub = $key.ExportParameters($false)
    $pin = '<RSAKeyValue><Modulus>'+[Convert]::ToBase64String($pub.Modulus)+'</Modulus><Exponent>'+[Convert]::ToBase64String($pub.Exponent)+'</Exponent></RSAKeyValue>'
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $pinHash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($pin))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($pinHash -cne $build.publisher_key_sha256) { throw 'A chave do custodiante diverge da chave pública do build.' }
    $canonical = [Text.Encoding]::UTF8.GetBytes(@('neopep-connect/v1',$Version,'staging','stable',
        $file.Length.ToString([Globalization.CultureInfo]::InvariantCulture),$hash,$artifact) -join "`n")
    $alg = [Security.Cryptography.HashAlgorithmName]::SHA256
    $padding = [Security.Cryptography.RSASignaturePadding]::Pkcs1
    $signature = $key.SignData($canonical,$alg,$padding)
    if (!$key.VerifyData($canonical,$signature,$alg,$padding)) { throw 'Verificação da assinatura falhou.' }
    $manifest = @{version=$Version;profile='staging';channel='stable';bytes=$file.Length;sha256=$hash;
        artifact=$artifact;signature=[Convert]::ToBase64String($signature)} | ConvertTo-Json -Compress
    Write-Host "Teste $Version | $SourceSha | $hash"
    if ((Read-Host 'Digite RASCUNHO para confirmar o envio') -cne 'RASCUNHO') { return }
    $credential = Get-Credential -Message 'Conta administrativa do NeoPep Teste'
    if (!$credential) { return }
    try {
        $session = Invoke-RestMethod -Method Post -Uri "$origin/auth/v1/token?grant_type=password" -Headers @{apikey=$PublishableKey} -ContentType 'application/json' -MaximumRedirection 0 -Body (@{email=$credential.UserName;password=$credential.GetNetworkCredential().Password}|ConvertTo-Json -Compress)
    } catch { throw 'Falha de autenticação no NeoPep Teste.' }
    if (!$session.access_token) { throw 'Sessão de Teste indisponível.' }
    $headers = @{apikey=$PublishableKey;Authorization='Bearer '+$session.access_token}
    $endpoint = "$origin/functions/v1/connect-release-draft"
    try {
        $upload = Invoke-RestMethod -Method Post -Uri ($endpoint+'?action=upload') -Headers $headers -ContentType 'application/json' -MaximumRedirection 0 -Body $manifest
        if (!$upload.exists) {
            $target = [uri]$upload.url
            if ($target.Scheme -cne 'https' -or $target.Host -cne 'qnuluspqfazdppciermw.supabase.co' -or !$target.IsDefaultPort -or
                $target.UserInfo -or $target.Fragment -or $target.AbsolutePath -cne "/storage/v1/object/upload/sign/neo-connect-releases/$Version/NeoPepConnectSetup.exe" -or
                $target.Query -cnotmatch '\A\?token=[A-Za-z0-9_.-]+\z') { throw 'Destino inválido.' }
            Invoke-WebRequest -UseBasicParsing -Method Put -Uri $target -InFile $setup -ContentType 'application/octet-stream' -TimeoutSec 300 -MaximumRedirection 0 -Headers @{'x-upsert'='false';apikey=$PublishableKey} | Out-Null
        }
        $draft = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -ContentType 'application/json' -TimeoutSec 120 -MaximumRedirection 0 -Body $manifest
    } catch { throw 'Falha de upload ou verificação no ambiente Teste. A versão continua sem aprovação. Uma nova tentativa verifica o objeto já existente.' }
    if ($draft.state -cne 'draft' -or $draft.version -cne $Version -or $draft.sha256 -cne $hash) { throw 'O servidor não confirmou o rascunho.' }
    Write-Host "Rascunho $Version verificado. A aprovação é feita no painel NeoPep Teste."
} finally {
    if ($key) { $key.Dispose() }
    $session = $headers = $credential = $manifest = $upload = $target = $null
    if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
}
