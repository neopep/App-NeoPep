const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FINANCE = 'public.neo_shop_v36(p_action text, p_payload jsonb)';
const ADMIN = 'public.neo_agent(p_action text, p_payload jsonb)';
const baseline = [
  { kind: 'meta', id: 'server', definition: { version: '17', cron: true } },
  { kind: 'cron', id: 'neo-push-dispatch',
    definition: { schedule: '* * * * *', active: true, command_hash: 'cron' } },
  { kind: 'routine', id: ADMIN,
    definition: { body_hash: 'original', definer: true, authenticated: true, service_role: true, acl: ['postgres=X', 'service_role=X'] } },
  { kind: 'routine', id: FINANCE,
    definition: { body_hash: 'financial-original', definer: true, authenticated: true, service_role: true, acl: ['postgres=X', 'service_role=X'] } },
  { kind: 'relation', id: 'neo_private.community_preferences',
    definition: { rls: true, acl: null } },
  { kind: 'column', id: 'neo_private.community_preferences.push_enabled',
    definition: { default_hash: 'production-true' } },
  { kind: 'policy', id: 'neo_private.community_preferences.owners',
    definition: { using_hash: 'allowed-users-only' } },
  { kind: 'bucket', id: 'neo-library', definition: { public: false } }
];

function assess(edited, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neopep-invariants-'));
  try {
    const before = path.join(dir, 'before.jsonl');
    const after = path.join(dir, 'after.jsonl');
    const write = (destination, rows) => fs.writeFileSync(destination,
      rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    write(before, baseline);
    write(after, edited);
    const run = spawnSync('python3',
      ['release/production/verify-invariants.py', before, after, ...extra],
      { encoding: 'utf8' });
    if (run.error) throw run.error;
    return { ok: run.status === 0, output: run.stdout + run.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function modify(kind, id, field, value) {
  return baseline.map(row => row.kind === kind && row.id === id
    ? { ...row, definition: { ...row.definition, [field]: value } }
    : structuredClone(row));
}

test('catálogo idêntico é aprovado, sem autorizar deploy', () => {
  assert.equal(assess(baseline).ok, true);
});

test('alteração de rotina administrativa preexistente é bloqueada', () => {
  const result = assess(modify('routine', ADMIN, 'body_hash', 'troca'));
  assert.equal(result.ok, false);
  assert.match(result.output, /public.neo_agent/);
});

test('revogação efetiva de service_role é bloqueada', () => {
  const result = assess(modify('routine', ADMIN, 'service_role', false));
  assert.equal(result.ok, false);
  assert.match(result.output, /Objeto instalado alterado/);
});

test('lote financeiro exige autorização e protege ACL mesmo quando liberado', () => {
  const changed = modify('routine', FINANCE, 'body_hash', 'novo-corpo');
  assert.equal(assess(changed).ok, false);
  assert.equal(assess(changed, ['--allow-finance-routine-change']).ok, true);
  const privileges = modify('routine', FINANCE, 'service_role', false);
  assert.equal(assess(privileges, ['--allow-finance-routine-change']).ok, false);
  const acl = modify('routine', FINANCE, 'acl', ['postgres=X']);
  assert.equal(assess(acl, ['--allow-finance-routine-change']).ok, false);
});

test('remoção de política existente é bloqueada', () => {
  const result = assess(baseline.filter(row => row.kind !== 'policy'));
  assert.equal(result.ok, false);
  assert.match(result.output, /Objeto instalado removido/);
});

test('alterar valor padrão de push oficial é bloqueado', () => {
  const result = assess(modify('column', 'neo_private.community_preferences.push_enabled', 'default_hash', 'false'));
  assert.equal(result.ok, false);
});

test('cron alterado ou ausente é bloqueado', () => {
  assert.equal(assess(modify('cron', 'neo-push-dispatch', 'schedule', '*/2 * * * *')).ok, false);
  assert.equal(assess(baseline.filter(row => row.kind !== 'cron')).ok, false);
});

test('bucket novo público ou com nome desconhecido é bloqueado', () => {
  assert.equal(assess([...baseline, { kind: 'bucket', id: 'neo-connect-releases', definition: { public: true } }]).ok, false);
  assert.equal(assess([...baseline, { kind: 'bucket', id: 'unexpected', definition: { public: false } }]).ok, false);
  assert.equal(assess([...baseline, { kind: 'bucket', id: 'neo-connect-releases', definition: { public: false } }]).ok, true);
});

test('novos cron, migrations ou schemas são bloqueados', () => {
  for (const kind of ['cron', 'migration', 'schema']) {
    assert.equal(assess([...baseline, { kind, id: 'extra', definition: {} }]).ok, false);
  }
});

test('tabelas e rotinas novas aditivas podem ser auditadas', () => {
  const addition = [
    { kind: 'relation', id: 'neo_private.new_safe_table', definition: { rls: true } },
    { kind: 'routine', id: 'public.neo_new_safe()', definition: { authenticated: true, service_role: false } }
  ];
  assert.equal(assess([...baseline, ...addition]).ok, true);
});
