param(
 [ValidateSet('staging','production')][string]$Profile='staging',
 [Parameter(Mandatory=$true)][ValidatePattern('\A[a-f0-9]{40}\z')][string]$SourceSha,
 [Parameter(Mandatory=$true)][ValidatePattern('\A(0|[1-9][0-9]{0,4})(\.(0|[1-9][0-9]{0,4})){2}\z')][string]$Version
)
$ErrorActionPreference='Stop'
if([version]$Version -le [version]'0.2.5'){throw 'O 0.2.5 existente usa importação. Selecione uma versão posterior já revisada.'}
$repo='neopep/NeoPep-Connect-Build-Privado'
$data=& gh api "repos/$repo"
if($LASTEXITCODE){throw 'O repositório privado está indisponível.'}
$remote=$data|ConvertFrom-Json
if(!$remote.private -or $remote.full_name -cne $repo){throw 'Build permitido somente no repositório privado de homologação.'}
$label=if($Profile -ceq 'production'){'Producao'}else{'Teste'}
$prior=& gh api --paginate --jq '.workflow_runs[] | select(.conclusion == "success" or .status == "queued" or .status == "in_progress") | .display_title' "repos/$repo/actions/workflows/neopep-connect-release.yml/runs?per_page=100"
if($LASTEXITCODE){throw 'Não foi possível conferir execuções anteriores.'}
$requested="Connect $label $Version $SourceSha"
$versionPrefix="Connect $label $Version "
if(@($prior | Where-Object { $_.StartsWith($versionPrefix,[StringComparison]::Ordinal) -and $_ -cne $requested }).Count){
 throw 'Esta versão já foi solicitada para outro commit no mesmo ambiente.'
}
if($prior -ccontains $requested){Write-Host 'A solicitação já existe.';return}
@{event_type='connect-release-reviewed';client_payload=@{profile=$Profile;source_sha=$SourceSha;version=$Version}} |
 ConvertTo-Json -Compress | & gh api --method POST "repos/$repo/dispatches" --input -
if($LASTEXITCODE){throw 'Não foi possível agendar o build privado.'}
