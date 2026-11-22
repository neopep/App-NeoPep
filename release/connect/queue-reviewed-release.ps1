param(
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
@{event_type='connect-release-reviewed';client_payload=@{source_sha=$SourceSha;version=$Version}} |
 ConvertTo-Json -Compress | & gh api --method POST "repos/$repo/dispatches" --input -
if($LASTEXITCODE){throw 'Não foi possível agendar o build privado.'}
