const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>fs.readFileSync('connect/windows/'+name+'.cs','utf8');
const profile=read('ConnectProfile'),client=read('Connect'),installer=read('Installer');
const build=fs.readFileSync('connect/windows/build.ps1','utf8');
const workflow=fs.readFileSync('.github/workflows/neopep-connect.yml','utf8');

test('um executável abre perfis fixos, com endpoints e chaves públicas distintos',()=>{
 assert.doesNotMatch(profile,/#if NEOPEP_/);
 assert.match(profile,/"https:\/\/cpslafpzjtbpmoxxysaa\.supabase\.co":"https:\/\/qnuluspqfazdppciermw\.supabase\.co"/);
 const keys=[...profile.matchAll(/"(sb_publishable_[A-Za-z0-9_-]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(keys).size,2);
 assert.doesNotMatch(profile,/sb_secret_|eyJ/);
 assert.match(client,/new Connect\(ConnectProfile\.Teste/);
 assert.match(client,/new Connect\(ConnectProfile\.Producao/);
 assert.match(client,/Headers\["apikey"\]=profile\.PublishableKey/);
 assert.match(client,/UploadStringTaskAsync\(profile\.Endpoint\(route\)/);
 assert.match(client,/AllowAutoRedirect=false/);
});

test('estado legado permanece em Teste e novos cofres são segregados por ambiente e conta',()=>{
 assert.match(profile,/IsProduction\?Path.Combine\(InstallFolder,"profiles","production"\):InstallFolder/);
 assert.match(profile,/Path.Combine\(LocalFolder,"accounts",account.ToString\("D"\)\)/);
 assert.match(client,/LoadVault\(\);local\.Remove\("key"\)/);
 assert.match(client,/ProtectedData\.Unprotect\(File.ReadAllBytes\(vault\),profile\.Entropy/);
 assert.match(client,/previousOwner!=id\.ToString/);
 assert.match(client,/Logout\(\)[\s\S]+?local.Remove\(key\)/);
 assert.match(installer,/ConnectProfile\.InstallFolder/);
 assert.match(installer,/ConnectProfile\.UninstallRegistryPath/);
});

test('instalador e atualizador são únicos e verificam o perfil emissor',()=>{
 const update=read('UpdateUi'),helper=read('UpdateHelper');
 assert.match(build,/supported_profiles=@\('staging','production'\)/);
 assert.match(build,/commit=\$commit/);
 assert.match(build,/run_id=\$env:GITHUB_RUN_ID/);
 assert.match(build,/authenticode=\(Get-AuthenticodeSignature/);
 assert.match(workflow,/if: github.event.repository.private/);
 assert.match(update,/TrustedDownload\(url,selected.Version,profile\)/);
 assert.match(helper,/ConnectProfile.FromCode\(args\[0\]\)/);
 assert.match(helper,/CheckApproval\(profile,credentials,manifest\)/);
 assert.match(helper,/UpdateTrust.Verify\(approval,current,profile.EnvironmentCode/);
 assert.match(update,/handedOff=true;ExitBoth\(\)/);
});

test('produção exige conexão WhatsApp explícita e mantém envios e processamento de fila bloqueados',()=>{
 const whatsapp=read('WhatsApp');
 assert.match(whatsapp,/!environment.IsProduction&&File.Exists\(vault\)\)ConnectSession\(\)/);
 assert.match(whatsapp,/if\(environment.IsProduction\|\|!ready/);
 assert.match(client,/if\(profile.IsProduction\)return;\s+var job=await RPC\("claim"/);
 assert.match(client,/whatsapp.Show\(this\)/);
});
