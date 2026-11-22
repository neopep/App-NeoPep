param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$agent = Import-Clixml -LiteralPath $ConfigPath
$folder = Split-Path -Parent $ConfigPath
$repo = 'neopep/NeoPep-Connect-Build-Privado'
# Garante acesso ao GitHub CLI mesmo quando instalado depois da abertura do terminal.
$ghDirectory=Join-Path $env:ProgramFiles 'GitHub CLI'
if(Test-Path -LiteralPath (Join-Path $ghDirectory 'gh.exe')){ $env:Path=$ghDirectory+';'+$env:Path }
$workflow = 'neopep-connect-release.yml'
$records = Join-Path $folder 'receipts'
New-Item -ItemType Directory -Force $records | Out-Null
function Get-Runs {
    if ($env:GH_TOKEN -or $env:GITHUB_TOKEN) { throw 'Use o cofre de credenciais do GitHub CLI.' }
    $configuration = if($env:GH_CONFIG_DIR){$env:GH_CONFIG_DIR}else{Join-Path $env:APPDATA 'GitHub CLI'}
    $hosts = Join-Path $configuration 'hosts.yml'
    if ((Test-Path -LiteralPath $hosts) -and (Select-String -LiteralPath $hosts -Pattern '^\s*oauth_token\s*:\s*\S' -Quiet)) {
        throw 'GitHub CLI configurado com token em arquivo.'
    }
    $result = & gh api "repos/$repo/actions/workflows/$workflow/runs?per_page=100"
    if ($LASTEXITCODE) { throw 'GitHub inacessível.' }
    return ($result | ConvertFrom-Json).workflow_runs
}
function Write-Receipt([string]$path,[string]$state) {
    @{state=$state;utc=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 -LiteralPath ($path+'.new')
    Move-Item -Force -LiteralPath ($path+'.new') -Destination $path
}
$hasFailure=$false
try { $runs = @(Get-Runs | Sort-Object created_at) }
catch { Write-Receipt (Join-Path $folder 'agent.json') 'AGUARDANDO_GITHUB'; exit 1 }
$waiting=$false
$prepared=$false
foreach ($run in $runs) {
    if ($run.display_title -cnotmatch '\AConnect Teste ((?:0|[1-9][0-9]{0,7})(?:\.(?:0|[1-9][0-9]{0,7})){2}) ([a-f0-9]{40})\z') { continue }
    $version=$Matches[1]
    $sha=$Matches[2]
    $allowedBootstrap = ([string]$agent.bootstrapRunId -ceq [string]$run.id -and
                         [string]$agent.bootstrapSourceSha -ceq $sha -and
                         [string]$agent.bootstrapVersion -ceq $version)
    if ([DateTime]$run.created_at -lt [DateTime]$agent.notBefore -and !$allowedBootstrap) { continue }
    if ([string]$run.id -notmatch '\A[1-9][0-9]{0,19}\z' -or [string]$run.run_attempt -notmatch '\A[1-9][0-9]{0,8}\z') { continue }
    $path=Join-Path $records ("$($run.id)-$($run.run_attempt).json")
    if ($run.status -ne 'completed') { $waiting=$true; continue }
    if ($run.conclusion -ne 'success') { Write-Receipt $path 'BUILD_ERROR'; $hasFailure=$true; continue }
    if (Test-Path -LiteralPath $path) {
        $receipt = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($receipt.state -eq 'RASCUNHO_PRONTO') { $prepared=$true; continue }
    }
    try {
        Write-Receipt $path 'AGUARDANDO_ASSINATURA'
        & (Join-Path $PSScriptRoot 'prepare-release.ps1') -RunId ([string]$run.id) -SourceSha $sha -Version $version -SigningThumbprint $agent.thumbprint -WorkflowBlob $agent.workflowBlob -AgentToken $agent.token
        Write-Receipt $path 'RASCUNHO_PRONTO'
        $prepared=$true
    } catch {
        $phase = $_.Exception.Message
        if($phase -notmatch '\AERROR_(PROVENIENCIA|ASSINATURA|STORAGE|RASCUNHO)\z'){$phase='ERROR'}
        Write-Receipt $path $phase
        $hasFailure=$true
    }
}
$summary = if($hasFailure){'ERROR'}elseif($waiting){'AGUARDANDO_BUILD'}elseif($prepared){'RASCUNHO_PRONTO'}else{'AGUARDANDO_BUILD'}
Write-Receipt (Join-Path $folder 'agent.json') $summary
if($hasFailure){exit 1}
