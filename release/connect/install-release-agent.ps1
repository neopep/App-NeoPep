param(
 [Parameter(Mandatory=$true)][ValidatePattern('\A[A-Fa-f0-9]{40}\z')][string]$SigningThumbprint,
 [Parameter(Mandatory=$true)][ValidatePattern('\A[a-f0-9]{40}\z')][string]$WorkflowBlob,
 [ValidatePattern('\A[1-9][0-9]{0,19}\z')][string]$BootstrapRunId,
 [ValidatePattern('\A[a-f0-9]{40}\z')][string]$BootstrapSourceSha,
 [ValidatePattern('\A(0|[1-9][0-9]{0,7})(\.(0|[1-9][0-9]{0,7})){2}\z')][string]$BootstrapVersion
)
$ErrorActionPreference='Stop'
if (($BootstrapRunId -or $BootstrapSourceSha -or $BootstrapVersion) -and
    (!$BootstrapRunId -or !$BootstrapSourceSha -or !$BootstrapVersion)) {
 throw 'Para importar um build anterior, informe RunId, SourceSha e Version juntos.'
}
$path = Join-Path $env:LOCALAPPDATA 'NeoPep Connect Release Agent'
New-Item -ItemType Directory -Force $path | Out-Null
$config = Join-Path $path 'agent.xml'
if(Test-Path -LiteralPath $config){throw 'O agente já está configurado. Revise a credencial existente antes de substituí-la.'}
$token = Read-Host 'Credencial de automação de Teste (64 caracteres hexadecimais)' -AsSecureString
if($token.Length -ne 64){throw 'Comprimento da credencial inválido.'}
foreach($file in @('run-release-agent.ps1','prepare-release.ps1')){
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $path $file)
}
$configuration=@{token=$token;thumbprint=$SigningThumbprint;workflowBlob=$WorkflowBlob;notBefore=[DateTime]::UtcNow.ToString('o')}
if($BootstrapRunId){
 $configuration.bootstrapRunId=$BootstrapRunId
 $configuration.bootstrapSourceSha=$BootstrapSourceSha
 $configuration.bootstrapVersion=$BootstrapVersion
}
$configuration | Export-Clixml -LiteralPath $config
$interactive=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal=New-ScheduledTaskPrincipal -UserId $interactive -LogonType Interactive -RunLevel Limited
$action=New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument ('-NoProfile -ExecutionPolicy RemoteSigned -NonInteractive -WindowStyle Hidden -File "'+(Join-Path $path 'run-release-agent.ps1')+'" -ConfigPath "'+$config+'"')
$trigger=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -StartWhenAvailable
Register-ScheduledTask -TaskName 'NeoPep Connect Release Agent Teste' -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
