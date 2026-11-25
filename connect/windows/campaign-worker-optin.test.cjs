'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'Connect.cs'), 'utf8');

test('opcao de homologacao aparece apenas no perfil Teste e exige consentimento', () => {
  assert.match(source, /if\s*\(!profile\.IsProduction\)\s*\{[\s\S]*?testCampaignWorker\.Text=/);
  assert.match(source, /testCampaignWorker\.CheckedChanged\s*\+=/);
  assert.match(source, /MessageBox\.Show\([\s\S]*?MessageBoxButtons\.YesNo/);
});

test('opcao e persistida no cofre DPAPI do perfil, sem alterar credenciais', () => {
  assert.match(source, /testCampaignWorker\.Checked\s*=\s*Value\(local,"campaign_worker_enabled"\)=="1"/);
  assert.match(source, /local\["campaign_worker_enabled"\]\s*=\s*testCampaignWorker\.Checked\?"1":"0"/);
  assert.match(source, /void Save\(\)\s*\{[\s\S]*?ProtectedData\.Protect\(/);
  assert.match(source, /void LoadVault\(\)[\s\S]*?ProtectedData\.Unprotect\(/);
});

test('worker bloqueia producao, preserva opt-in legado e exige servidor', () => {
  const gate = 'if(profile.IsProduction||(Value(local,"campaign_worker_enabled")!="1" && Environment.GetEnvironmentVariable("NEO_CONNECT_CAMPAIGN_WORKER")!="1"))return;';
  assert.ok(source.includes(gate));
  const worker = source.substring(source.indexOf('async Task TickCampaignDispatch()'));
  assert.match(worker, /CampaignDispatch\("heartbeat"/);
  assert.match(worker, /if\(gate==null\|\|!gate\.ContainsKey\("enabled"\)\|\|!Convert\.ToBoolean\(gate\["enabled"\]\)\|\|!ready\)return;/);
  assert.ok(worker.indexOf('CampaignDispatch("heartbeat"') < worker.indexOf('CampaignDispatch("claim"'));
  assert.match(worker, /window\.DispatchCampaignTextAsync\(/);
});
