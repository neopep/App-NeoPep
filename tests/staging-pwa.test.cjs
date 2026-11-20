const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

test('staging installs at the root and keeps the former launch and worker routes', (t) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'neopep-staging-pwa-'));
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  for (const file of [
    'scripts/build-staging.cjs', 'release/multiagent-staging/configure-frontend.cjs',
    'dist/index.html', 'dist/admin/index.html', 'dist/excluir-conta/index.html',
    'dist/sw.js', 'dist/manifest.webmanifest'
  ]) {
    const dest = path.join(work, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
  }
  fs.writeFileSync(path.join(work, 'fetch.cjs'), 'global.fetch = async () => ({ ok: true });');
  execFileSync(process.execPath, ['--require', './fetch.cjs', 'scripts/build-staging.cjs'], {
    cwd: work, env: {
      ...process.env, VERCEL: '1', VERCEL_GIT_COMMIT_REF: 'staging/permanente',
      NEO_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture'
    }
  });
  const read = (file) => fs.readFileSync(path.join(work, 'dist', file), 'utf8');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ['/', '/', '/']);
  assert.equal(manifest.name, 'NeoPep Teste');
  assert.equal(manifest.short_name, 'NeoPep');
  assert.equal(read('neo/index.html'), read('index.html'));
  const window = {};
  vm.runInNewContext(read('config.js'), { window });
  assert.equal(window.NEO_CONFIG.authRedirectPath, '/neo/');
  assert.equal(window.NEO_CONFIG.legacyPushScope, '/neo/');
  const cache = (scope) => vm.runInNewContext(read('sw.js') + '\nCACHE', {
    URL, self: { registration: { scope }, addEventListener() {} }
  });
  assert.notEqual(cache('https://test.example/'), cache('https://test.example/neo/'));
  const { rewrites, headers } = JSON.parse(fs.readFileSync('vercel.json'));
  assert.ok(rewrites.some(rule => rule.source === '/neo/sw.js' && rule.destination === '/sw.js'));
  assert.ok(headers.some(rule => rule.source === '/neo/sw.js' &&
    rule.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-cache'))));
});
