param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference='Stop'
$agent = Import-Clixml -LiteralPath $ConfigPath
$folder = Split-Path -Parent $ConfigPath
$profile=if($agent.profile){[string]$agent.profile}else{'staging'}
if($profile -cnotin @('staging','production')){throw 'Perfil inválido.'}
$label=if($profile -ceq 'production'){'Producao'}else{'Teste'}
$titlePattern='\AConnect '+$label+' ((?:0|[1-9][0-9]{0,7})(?:\.(?:0|[1-9][0-9]{0,7})){2}) ([a-f0-9]{40})\z'
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
$latestState='AGUARDANDO_BUILD'
try { $runs = @(Get-Runs | Sort-Object created_at) }
catch { Write-Receipt (Join-Path $folder 'agent.json') 'AGUARDANDO_GITHUB'; exit 1 }
foreach ($run in $runs) {
    if ($run.display_title -cnotmatch $titlePattern) { continue }
    $version=$Matches[1]
    $sha=$Matches[2]
    $allowedBootstrap = ([string]$agent.bootstrapRunId -ceq [string]$run.id -and
                         [string]$agent.bootstrapSourceSha -ceq $sha -and
                         [string]$agent.bootstrapVersion -ceq $version)
    if ([DateTime]$run.created_at -lt [DateTime]$agent.notBefore -and !$allowedBootstrap) { continue }
    if ([string]$run.id -notmatch '\A[1-9][0-9]{0,19}\z' -or [string]$run.run_attempt -notmatch '\A[1-9][0-9]{0,8}\z') { continue }
    $path=Join-Path $records ("$($run.id)-$($run.run_attempt).json")
    if ($run.status -ne 'completed') { $latestState='AGUARDANDO_BUILD'; continue }
    if ($run.conclusion -ne 'success') { Write-Receipt $path 'BUILD_ERROR'; $latestState='BUILD_ERROR'; continue }
    if (Test-Path -LiteralPath $path) {
        $receipt = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($receipt.state -in @('DRAFT_PRONTO','RASCUNHO_PRONTO')) { $latestState='DRAFT_PRONTO'; continue }
    }
    try {
        Write-Receipt $path 'BUILD_VALIDADO'
        Write-Receipt $path 'AGUARDANDO_ASSINATURA_LOCAL'
        $options=@{Profile=$profile}
        if($profile -ceq 'production'){$options.AuthenticodeThumbprint=$agent.authenticodeThumbprint}
        & (Join-Path $PSScriptRoot 'prepare-release.ps1') -RunId ([string]$run.id) -SourceSha $sha -Version $version -SigningThumbprint $agent.thumbprint -WorkflowBlob $agent.workflowBlob -AgentToken $agent.token @options
        Write-Receipt $path 'DRAFT_PRONTO'
        $latestState='DRAFT_PRONTO'
    } catch {
        $phase = $_.Exception.Message
        if($phase -notmatch '\AERROR_(PROVENIENCIA|ASSINATURA|STORAGE|RASCUNHO)\z'){$phase='ERROR'}
        Write-Receipt $path $phase
        $latestState=$phase
    }
}
# O build mais recente define o estado geral. Historico de falhas permanece por recibo.
Write-Receipt (Join-Path $folder 'agent.json') $latestState
if($latestState -in @('BUILD_ERROR','ERROR','ERROR_PROVENIENCIA','ERROR_ASSINATURA','ERROR_STORAGE','ERROR_RASCUNHO')){exit 1}
