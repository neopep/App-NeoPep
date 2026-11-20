const fs = require('node:fs');
const vm = require('node:vm');
const { staging, verifyStagingKey, writeConfig } = require('../release/multiagent-staging/configure-frontend.cjs');

async function prepare() {
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL === '1' && !['staging', 'staging/permanente'].includes(branch)) {
    throw new Error('Branch inválida para a publicação de homologação.');
  }

  const key = process.env.NEO_STAGING_SUPABASE_PUBLISHABLE_KEY || '';
  const vapid = process.env.NEO_STAGING_VAPID_PUBLIC_KEY || '';
  await verifyStagingKey(key);
  if (vapid && !/^[A-Za-z0-9_-]{87}$/.test(vapid)) throw new Error('Chave VAPID pública inválida.');

  writeConfig('dist', key);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('dist/config.js', 'utf8'), context);
  const base = context.window.NEO_CONFIG;
  const config = {
    ...base,
    appDisplayName: 'NeoPep Teste',
    pushVapidPublicKey: vapid,
    providers: {
      ...base.providers,
      google: process.env.NEO_STAGING_GOOGLE_ENABLED === '1',
      apple: process.env.NEO_STAGING_APPLE_ENABLED === '1'
    }
  };
  fs.writeFileSync('dist/config.js', `window.NEO_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`);

  const manifestPath = 'dist/manifest.webmanifest';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  Object.assign(manifest, { id: '/neo/', name: 'NeoPep Teste', short_name: 'NeoPep', start_url: '/neo/', scope: '/neo/' });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  for (const path of ['dist/index.html', 'dist/admin/index.html', 'dist/excluir-conta/index.html']) {
    const html = fs.readFileSync(path, 'utf8')
      .replace(/<title>([^<]*?)(?: — Homologação)?<\/title>/, (_, title) => '<title>' + title.replace(/NeoPep(?! Teste)/, 'NeoPep Teste') + '</title>')
      .replace('name="apple-mobile-web-app-title" content="NeoPep"', 'name="apple-mobile-web-app-title" content="NeoPep Teste"')
      .replaceAll('https://*.supabase.co', staging)
      .replaceAll('wss://*.supabase.co', staging.replace('https:', 'wss:'));
    fs.writeFileSync(path, html);
  }
  const serviceWorker = 'dist/sw.js';
  const worker = fs.readFileSync(serviceWorker, 'utf8')
    .replace("const CACHE='neopeptideos-shell-", "const CACHE='staging-neopeptideos-shell-")
    .replace("key.startsWith('neopeptideos-shell-')", "key.startsWith('staging-neopeptideos-shell-')");
  fs.writeFileSync(serviceWorker, worker);
}

prepare().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
