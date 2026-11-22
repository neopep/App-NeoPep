const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const config = { window: {} };
vm.runInNewContext(read('dist/config.js'), config);
assert.equal(config.window.NEO_CONFIG.supabaseUrl, 'https://cpslafpzjtbpmoxxysaa.supabase.co');
assert.notEqual(config.window.NEO_CONFIG.connectTestEnabled, true);
assert.notEqual(config.window.NEO_CONFIG.campaignActivationEnabled, true);
const vercel = JSON.parse(read('vercel.json'));
assert.equal(vercel.buildCommand, 'npm run build');
assert.equal(vercel.outputDirectory, 'dist');
assert.equal(vercel.git.deploymentEnabled['release/preparacao-paridade-producao-20261122'], true); // Preview candidate, never main production.
assert.ok(vercel.rewrites.some(route => route.source === '/neo/:path*'));
assert.doesNotMatch(JSON.stringify(vercel.headers), /noindex/i);
assert.ok(!fs.existsSync(path.join(root, 'api/admin-monitor.js')));
assert.ok(!fs.existsSync(path.join(root, 'api/staging-observe.js')));
assert.ok(!fs.existsSync(path.join(root, 'supabase/functions/connect-release-draft')));
assert.doesNotMatch(read('dist/cloud.js'), /\/api\/(admin-monitor|staging-observe)|connect-release-draft/);
const manifest = JSON.parse(read('dist/manifest.webmanifest'));
for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], './');
assert.equal(manifest.name, 'NeoPep');
assert.doesNotMatch(read('dist/index.html'), /noindex/i);
for (const entry of fs.readdirSync(path.join(root, 'dist'), { recursive: true })) {
 if (/\.(exe|msi|pfx|pem)$/i.test(entry)) assert.fail('Artefato restrito no frontend: ' + entry);
 if (entry.startsWith('vendor' + path.sep) || !/\.(html|js|webmanifest)$/i.test(entry)) continue;
 assert.doesNotMatch(read(path.join('dist', entry)),
  /qnuluspqfazdppciermw|teste\.app\.neopep\.com\.br|NeoPep Teste|sb_secret_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  'Referência de Teste ou material privado em ' + entry);
}
console.log('Configuração, rotas PWA legadas, isolamento da prévia e artefatos oficiais verificados.');
