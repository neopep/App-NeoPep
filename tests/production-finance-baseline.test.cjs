const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Hashes Git de arquivos da branch main ANTES deste rollout.
// Não dependem de acesso à rede nem de tokens de banco / Mercado Pago.
const expected = {
  'supabase/functions/mercadopago-create/index.ts': '5e9fc48cc1f84cb1074ec159ac8d64e7b73bc3f6',
  'supabase/functions/mercadopago-webhook/index.ts': '9886398a06a76d414ad12ff745dc8eef5f1eaea4'
};

function gitBlobHash(path) {
  const content = fs.readFileSync(path);
  return crypto.createHash('sha1')
    .update('blob ' + content.length + '\0')
    .update(content)
    .digest('hex');
}

test('Edge financeiras ativas permanecem idênticas ao main oficial', () => {
  for (const [file, hash] of Object.entries(expected)) {
    assert.equal(gitBlobHash(file), hash,
      'Edge financeira desviou do baseline oficial: ' + file);
  }
});

test('propostas financeiras permanecem isoladas, não elegíveis a migração automática', () => {
  const manifest = JSON.parse(fs.readFileSync('release/production/batches/manifest.json', 'utf8'));
  const lot = manifest['07-financeiro'];
  assert.equal(lot.optional, true);
  assert.equal(lot.approval, 'SEPARATE_FINANCE_RELEASE_ONLY');
  assert.equal(lot.files.length, 1);
  assert.ok(lot.files.every(file => file.path?.startsWith('release/production/optional-finance/')));
  assert.equal(fs.existsSync('supabase/migrations/20261122190100_shop_checkout_retry.sql'), false);
  for (const name of ['mercadopago-create', 'mercadopago-webhook']) {
    const optional = 'release/production/optional-finance/' + name + '/index.ts';
    const active = 'supabase/functions/' + name + '/index.ts';
    assert.equal(fs.existsSync(optional), true);
    assert.notEqual(gitBlobHash(optional), gitBlobHash(active));
  }
});
