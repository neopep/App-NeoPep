const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='connect/windows/';
const profile=fs.readFileSync(path+'ConnectProfile.cs','utf8');
const client=fs.readFileSync(path+'Connect.cs','utf8');
const installer=fs.readFileSync(path+'Installer.cs','utf8');
const build=fs.readFileSync(path+'build.ps1','utf8');
const workflow=fs.readFileSync('.github/workflows/neopep-connect.yml','utf8');

test('Connect compila dois perfis isolados e aceita somente chaves publicáveis',()=>{
 const variants=profile.split('#else');
 assert.equal(variants.length,2);
 const production=variants[0],staging=variants[1].split('#endif')[0];
 assert.match(production,/#if NEOPEP_PRODUCTION/);
 assert.match(production,/EnvironmentCode = "production"/);
 assert.match(production,/ConnectEnabled = false/);
 assert.match(staging,/EnvironmentCode = "staging"/);
 assert.match(staging,/ConnectEnabled = true/);
 assert.match(production,/cpslafpzjtbpmoxxysaa\.supabase\.co/);
 assert.match(staging,/qnuluspqfazdppciermw\.supabase\.co/);
 const key=block=>block.match(/PublishableKey = "(sb_publishable_[A-Za-z0-9_-]+)"/)?.[1];
 assert.ok(key(production));
 assert.ok(key(staging));
 assert.notEqual(key(production),key(staging));
 assert.doesNotMatch(profile,/PublishableKey\s*=\s*\"(?:sb_secret_|eyJ)/);
 assert.match(production,/LocalFolderName = "NeoPep Connect Producao"/);
 assert.match(staging,/LocalFolderName = "NeoPep Connect"/);
 assert.notEqual(production.match(/MutexName = ([^\n]+)/)?.[1],staging.match(/MutexName = ([^\n]+)/)?.[1]);
});

test('Programa Windows elimina digitação de chave e preserva sessões de teste',()=>{
 assert.doesNotMatch(client,/key\.Text|Chave pública do Supabase|StagingPanel/);
 assert.match(client,/Headers\["apikey"\]=ConnectProfile\.PublishableKey/);
 assert.match(client,/LoadVault\(\);local\.Remove\("key"\)/);
 assert.match(client,/readonly TextBox email = new TextBox\(\), password = new TextBox\(\)/);
 assert.match(client,/!ConnectProfile\.ConnectEnabled/);
 assert.match(client,/ConnectProfile\.MutexName/);
 assert.match(installer,/ConnectProfile\.LocalFolder/);
 assert.match(installer,/ConnectProfile\.StartupRegistryName/);
 assert.match(installer,/ConnectProfile\.UninstallRegistryPath/);
 assert.match(installer,/ConnectProfile\.ShortcutName/);
});

test('Build exige perfil explícito e CI só publica o instalador staging',()=>{
 assert.match(build,/ValidateSet\('Teste','Producao'\)/);
 assert.match(build,/NEOPEP_PRODUCTION/);
 assert.match(build,/ConnectProfile\.cs/);
 assert.match(workflow,/Compilar perfil produção \(apenas validação, sem publicação\)/);
 assert.match(workflow,/if \(\$production\.profile -ne 'production' -or \$production\.connect_enabled\)/);
 assert.equal((workflow.match(/actions\/upload-artifact@/g)||[]).length,1);
 const upload=workflow.split('actions/upload-artifact@')[1];
 assert.match(upload,/connect\/NeoPepConnectSetup\.exe/);
 assert.doesNotMatch(upload,/connect-prod/);
});

test('WinForms mantém reautenticação e bridge bloqueado no perfil Produção',()=>{
 const whatsapp=fs.readFileSync(path+'WhatsApp.cs','utf8');
 assert.match(client,/await Tokens\("password".*false\)/);
 assert.match(client,/if\(!String\.IsNullOrEmpty\(Value\(local,"device"\)\)\)/);
 assert.match(client,/if\(!ConnectProfile\.ConnectEnabled\|\|!ConnectProfile\.IsValid\)throw/);
 assert.match(installer,/if\(ConnectProfile\.ConnectEnabled\)InstallRuntime\(\)/);
 assert.match(whatsapp,/Color\.FromArgb\(245,232,207\)/);
 assert.match(whatsapp,/!ConnectProfile\.ConnectEnabled\|\|forgetting/);
 assert.match(build,/commit=\$commit/);
 assert.match(build,/run_id=\$env:GITHUB_RUN_ID/);
 assert.match(build,/run_attempt=\$env:GITHUB_RUN_ATTEMPT/);
});
