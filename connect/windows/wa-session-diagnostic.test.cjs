'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const source=readFileSync('connect/windows/WhatsApp.cs','utf8');
const profile=readFileSync('connect/windows/ConnectProfile.cs','utf8');

test('diagnóstico diferencia leitura DPAPI, credencial e processamento de eventos sem apagar cofre',()=>{
 assert.match(source,/string phase="LEITURA";[\s\S]*?string existing=OpenVault\(\);[\s\S]*?phase="INICIALIZACAO"/);
 assert.match(source,/string phase="ENVELOPE";[\s\S]*?phase="CREDENCIAL";/);
 assert.match(source,/phase="ESTADO";/);
 assert.match(source,/phase="GRUPOS";/);
 assert.match(source,/RecordSafeDiagnostic\(phase,error\)/);
 assert.match(source,/ShowSafeFailure\(code\)/);
 assert.match(source,/O diagnóstico não apaga o cofre/);
 assert.doesNotMatch(source,/error\.Message|error\.StackTrace|error\.ToString\(\)/);
});

test('diagnóstico armazena apenas fase e classe controladas, sem conteúdo da sessão',()=>{
 const fn=source.split('static string SafeDiagnosticKind(Exception error)')[1].split('    DateTime? groupReadAt;')[0];
 assert.match(fn,/error is CryptographicException/);
 assert.match(fn,/error is UnauthorizedAccessException/);
 assert.match(fn,/error is IOException/);
 assert.match(fn,/DateTime\.UtcNow\.ToString\("u"\)\+" "\+code/);
 assert.match(fn,/whatsapp-diagnostico\.log/);
 assert.doesNotMatch(fn,/json\.Serialize|localVault|vault\+|group_jid|sendStatus|File\.Delete|WriteVault\(/);
});

test('conexões Teste e Produção permanecem isoladas e envio em Produção proibido',()=>{
 assert.match(profile,/IsProduction\?Path\.Combine\(InstallFolder,"profiles","production"\):InstallFolder/);
 assert.match(profile,/IsProduction\?Encoding\.UTF8\.GetBytes\("NeoPepConnect\/production\/v1"\):null/);
 assert.match(source,/if\(environment\.IsProduction\)sendStatus\.Text="Produção: envio bloqueado/);
 assert.match(source,/!environment\.IsProduction&&ready&&!sendingText/);
 assert.match(source,/if\(environment\.IsProduction\|\|!ready/);
 assert.match(source,/!environment\.IsProduction&&!closing/);
});
