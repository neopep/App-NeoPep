param(
    [switch]$Apply,
    [switch]$RunNow
)
$ErrorActionPreference='Stop'
# Uma rotação revisada, por hash exato. Não gera token ou certificado novo.
$oldWorkflow='9809901068336c37f8d42442d81c58304bc82a6b'
$newWorkflow='3def75a277a54e9eda489e9068ea9ced42e5c723'
$expectedSources=@{
    'run-release-agent.ps1'='505af1b5b8c4ab8ee42a11e5bbdaefed47cdf5d7'
    'prepare-release.ps1'='267a39f3bf52cb4a8e8ef56f7732627720c8df95'
}
$folder=Join-Path $env:LOCALAPPDATA 'NeoPep Connect Release Agent'
$config=Join-Path $folder 'agent.xml'
$taskName='NeoPep Connect Release Agent Teste'
if($RunNow -and !$Apply){throw 'Use -RunNow somente junto com -Apply.'}
if(!(Test-Path -LiteralPath $config)){throw 'Agente de Teste não encontrado. Não instale uma segunda cópia.'}
$agent=Import-Clixml -LiteralPath $config
if($agent.profile -and [string]$agent.profile -cne 'staging'){throw 'O cofre não pertence ao Teste.'}
if(!($agent.token -is [Security.SecureString]) -or !$agent.thumbprint){throw 'Cofre original não corresponde ao agente existente.'}
$previous=[string]$agent.workflowBlob
if($previous -cne $oldWorkflow -and $previous -cne $newWorkflow){
    throw 'Hash anterior desconhecido: revisar a origem local antes de atualizar.'
}
function Assert-Blob([string]$file,[string]$expected){
    if(!(Test-Path -LiteralPath $file)){throw 'Script do agente ausente.'}
    $bytes=[IO.File]::ReadAllBytes($file)
    # Git checkout no Windows pode converter LF em CRLF. Compare o blob normalizado
    # somente quando todas as quebras forem uma sequência CRLF válida.
    $source=[Text.Encoding]::UTF8.GetString($bytes)
    if($source.Contains("`r")){
        if($source.Replace("`r`n",'').Contains("`r")){throw 'Quebras de linha inesperadas no script.'}
        $bytes=[Text.Encoding]::UTF8.GetBytes($source.Replace("`r`n","`n"))
    }
    $prefix=[Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
    $payload=New-Object byte[] ($prefix.Length+$bytes.Length)
    [Array]::Copy($prefix,0,$payload,0,$prefix.Length)
    [Array]::Copy($bytes,0,$payload,$prefix.Length,$bytes.Length)
    $sha=[Security.Cryptography.SHA1]::Create()
    try{$actual=[BitConverter]::ToString($sha.ComputeHash($payload)).Replace('-','').ToLowerInvariant()}
    finally{$sha.Dispose();[Array]::Clear($payload,0,$payload.Length)}
    if($actual -cne $expected){throw 'O script local difere do commit revisado: '+(Split-Path $file -Leaf)}
}
# Conferência do workflow diretamente no repositório privado autenticado.
if($env:GH_TOKEN -or $env:GITHUB_TOKEN){throw 'Use a sessão protegida do GitHub CLI, não tokens em variáveis de ambiente.'}
$remote=& gh api 'repos/neopep/NeoPep-Connect-Build-Privado/contents/.github/workflows/neopep-connect-release.yml?ref=main' --jq '.sha'
if($LASTEXITCODE -ne 0 -or [string]$remote -cne $newWorkflow){throw 'Workflow privado não corresponde ao hash novo autorizado.'}
foreach($name in $expectedSources.Keys){
    Assert-Blob (Join-Path $PSScriptRoot $name) $expectedSources[$name]
}
$scheduled=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if($scheduled.State -eq 'Running'){throw 'O assinador está executando. Aguarde a conclusão antes da rotação.'}
if($scheduled.State -eq 'Disabled'){throw 'Agente já desabilitado. Verifique antes de continuar.'}
Write-Host 'Verificadas a identidade do workflow e as duas versões revisadas do assinador de Teste.'
if(!$Apply){Write-Host 'Pré-visualização concluída; nenhuma alteração feita. Use -Apply para atualizar o agente já existente.';return}
$stamp=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$backup=Join-Path $folder ('backup-confianca-'+$stamp)
New-Item -Path $backup -ItemType Directory -ErrorAction Stop | Out-Null
$files=@('agent.xml','run-release-agent.ps1','prepare-release.ps1')
foreach($name in $files){Copy-Item -LiteralPath (Join-Path $folder $name) -Destination (Join-Path $backup $name) -ErrorAction Stop}
$disabled=$false
try{
    Disable-ScheduledTask -TaskName $taskName -ErrorAction Stop | Out-Null
    $disabled=$true
    # Não reescreva token, certificado, notBefore, sessões nem recibos.
    $agent.workflowBlob=$newWorkflow
    $configNew=$config+'.rotating'
    $agent | Export-Clixml -LiteralPath $configNew
    foreach($name in $expectedSources.Keys){
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $folder ($name+'.rotating')) -ErrorAction Stop
    }
    foreach($name in $expectedSources.Keys){
        Move-Item -Force -LiteralPath (Join-Path $folder ($name+'.rotating')) -Destination (Join-Path $folder $name) -ErrorAction Stop
    }
    Move-Item -Force -LiteralPath $configNew -Destination $config -ErrorAction Stop
    Write-Host 'Agente de Teste atualizado com hash revisado; cofre, certificado e recibos preservados.'
}catch{
    foreach($name in $files){
        $src=Join-Path $backup $name
        if(Test-Path -LiteralPath $src){Copy-Item -Force -LiteralPath $src -Destination (Join-Path $folder $name)}
    }
    throw
}finally{
    if($disabled){Enable-ScheduledTask -TaskName $taskName -ErrorAction Stop | Out-Null}
}
if($RunNow){Start-ScheduledTask -TaskName $taskName -ErrorAction Stop;Write-Host 'Assinador iniciado para verificar builds privados pendentes.'}
Write-Host ('Cópia de recuperação protegida em '+$backup)
