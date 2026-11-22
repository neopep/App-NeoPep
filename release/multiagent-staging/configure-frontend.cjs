const fs = require('node:fs');
const path = require('node:path');

const staging = 'https://qnuluspqfazdppciermw.supabase.co';

function writeConfig(dist, key = '') {
  const config = {
    supabaseUrl: key ? staging : '', supabasePublishableKey: key, authRedirectPath: '/neo/',
    providers: { google: false, apple: false, email: true },
    pushVapidPublicKey: '', captchaSiteKey: '', captchaRequired: false,
    privacyContact: '', controllerName: 'NeoPep — homologação',
    cloudValidated: false, publicRegistration: false, previewRegistration: false, legalVersion: '2026-11-v1'
  };
  fs.writeFileSync(path.join(dist, 'config.js'), `window.NEO_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`);
}

async function verifyStagingKey(key) {
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Informe somente uma chave publishable do staging.');
  let response;
  try {
    response = await fetch(staging + '/auth/v1/settings', {
      headers: { apikey: key }, redirect: 'error', signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw new Error('A consulta HTTPS para conferir a chave do staging está indisponível.');
  }
  if (!response.ok) throw new Error('O staging recusou a consulta da chave publishable.');
}

async function main() {
  const key = (process.env.NEO_STAGING_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const dist = path.join(__dirname, 'frontend', 'dist');
  if (!fs.existsSync(path.join(dist, 'neo', 'config.js'))) throw new Error('Diretório de staging incompleto.');
  await verifyStagingKey(key);
  writeConfig(dist, key);
  writeConfig(path.join(dist, 'neo'), key);
  console.log('Frontend configurado somente para o staging.');
}
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { staging, verifyStagingKey, writeConfig };
