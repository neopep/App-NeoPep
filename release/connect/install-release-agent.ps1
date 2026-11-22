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
# Gera credencial aleatoria de 256 bits. Ela fica somente no cofre DPAPI deste usuario.
# Apenas o digest SHA-256 (nao o token) deve ser configurado na Edge do Supabase Teste.
$random = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($random) } finally { $rng.Dispose() }
$clearToken = [BitConverter]::ToString($random).Replace('-','').ToLowerInvariant()
$token = ConvertTo-SecureString -String $clearToken -AsPlainText -Force
$digest = [Security.Cryptography.SHA256]::Create()
try { $tokenHash = [BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($clearToken))).Replace('-','').ToLowerInvariant() }
finally { $digest.Dispose(); [Array]::Clear($random,0,$random.Length); $clearToken=$null }
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

Write-Host 'Agente NeoPep Connect Teste criado. Configure SOMENTE o hash abaixo como secret da Edge:'
Write-Host ('NEO_CONNECT_AGENT_TOKEN_SHA256='+$tokenHash) -ForegroundColor Green
Write-Host 'Nao compartilhe o token original nem altere o agent.xml.'
