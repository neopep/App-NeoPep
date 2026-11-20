const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const core = require('../dist/core.js');

const migrations = path.join(__dirname, '..', 'supabase', 'migrations');
const foundation = '202611200001_multiagent_foundation.sql';
const defaultAgent = '00000000-0000-4000-8000-000000000073';
const integration = '00000000-0000-4000-8000-000000000026';
const admin = '00000000-0000-4000-8000-000000000101';
const member = '00000000-0000-4000-8000-000000000102';
const message = '00000000-0000-4000-8000-000000000103';

async function rpc(db, name, ...args) {
  const placeholders = args.map((_, index) => '$' + (index + 1)).join(',');
  const { rows } = await db.query(`select ${name}(${placeholders}) as result`, args);
  return rows[0].result;
}

async function as(db, role, user = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec(`set role ${role}`);
}

test('multiagent foundation preserves a pending legacy job and isolates the administrative catalog', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role service_role;
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, created_at timestamptz default now(),
        raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to authenticated;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid, name text, bucket_id text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$
        select string_to_array($1, '/')
      $$;
      create schema vault;
      create table vault.decrypted_secrets(name text, decrypted_secret text);
    `);
    for (const file of fs.readdirSync(migrations).sort()) {
      if (file === foundation) break;
      await db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'));
    }

    await db.query('insert into auth.users(id) values ($1),($2)', [admin, member]);
    await db.query('insert into neo_private.admin_members(user_id) values ($1)', [admin]);
    const fakeCredential = { iv: 'synthetic-iv', data: 'synthetic-encrypted-value' };
    await db.query(`update neo_private.ai_integrations
      set model='test-model', encrypted_key=$2, validated_at=now(), validated_revision=revision
      where id=$1`, [integration, fakeCredential]);

    await as(db, 'authenticated', admin);
    await rpc(db, 'neo_agent', 'save', {
      enabled: true, mode: 'auto', tone: 'Tom original', instructions: 'Instrução original'
    });
    const oldSettings = await rpc(db, 'neo_agent', 'knowledge_save', {
      category: 'faq', title: 'Original', content: 'Conteúdo original'
    });
    await as(db, 'authenticated', member);
    await rpc(db, 'neo_complete_onboarding',
      { ...core.defaultProfile(), name: 'Teste', height: 174, initialWeight: 80, goal: 75, consent: true },
      core.blank().settings, true, true);
    const thread = (await rpc(db, 'neo_support', 'open', {})).thread_id;
    await rpc(db, 'neo_support', 'send', { thread_id: thread, id: message, body: 'Onde estão os materiais?' });
    await as(db, 'service_role');
    const claimed = await rpc(db, 'neo_ai_claim', member, message);
    assert.ok(claimed?.lease);

    await db.exec('reset role');
    const apply = () => db.exec(fs.readFileSync(path.join(migrations, foundation), 'utf8'));
    await apply();
    await as(db, 'anon');
    await assert.rejects(rpc(db, 'neo_multiagent'), { code: '42501' });
    await as(db, 'authenticated', member);
    await assert.rejects(rpc(db, 'neo_multiagent'), { code: '42501' });
    await as(db, 'service_role');
    await assert.rejects(rpc(db, 'neo_multiagent'), { code: '42501' });

    await as(db, 'authenticated', admin);
    await assert.rejects(db.query('select * from neo_private.agents'), { code: '42501' });
    const call = (action, payload = {}) => rpc(db, 'neo_multiagent', action, payload);
    const migrated = await call('read', { agent_id: defaultAgent });
    assert.equal(migrated.agent.is_default, true);
    assert.deepEqual(migrated.agent.settings, oldSettings.config);
    assert.equal(migrated.agent.model, 'test-model');
    assert.equal(migrated.agent.integration_validated, true);
    assert.equal(migrated.knowledge[0].id, oldSettings.knowledge[0].id);
    assert.equal(migrated.knowledge[0].content, 'Conteúdo original');
    assert.ok(!JSON.stringify(migrated).includes(fakeCredential.data));

    const first = (await call('create', { public_name: 'Biblioteca', admin_name: 'Materiais' })).agent;
    const second = (await call('create', { public_name: 'Loja', admin_name: 'Catálogo' })).agent;
    assert.notEqual(first.id, second.id);
    const save = (agent, settings) => call('save', {
      agent_id: agent.id, expected_revision: agent.settings.revision, settings
    });
    const updated = (await save(first, {
      instructions: 'Ajude com materiais.', integration_id: integration, mode: 'suggest', daily_limit: 12
    })).agent;
    await save(second, { instructions: 'Ajude com o catálogo.', integration_id: integration, model_override: 'other-model' });
    await assert.rejects(save(first, { tone: 'revisão antiga' }), { code: '40001' });
    await assert.rejects(save(updated, { status: 'active' }), /ativação/);
    await assert.rejects(save(updated, { tools: ['external'] }), /inválida/);
    const list = await call('list');
    assert.equal(list.length, 3);
    assert.equal(list.find(agent => agent.id === first.id).settings.instructions, 'Ajude com materiais.');
    const catalogAgent = list.find(agent => agent.id === second.id);
    assert.equal(catalogAgent.settings.instructions, 'Ajude com o catálogo.');
    assert.equal(catalogAgent.integration_id, updated.integration_id);
    assert.equal(catalogAgent.integration_validated, false);

    const knowledge = { category: 'faq', title: 'Referência', content: 'Material sintético' };
    const firstKnowledge = await call('knowledge_save', { ...knowledge, agent_id: first.id });
    const item = firstKnowledge.knowledge[0].id;
    await assert.rejects(call('knowledge_delete', { agent_id: second.id, item_id: item }), /escopo/);
    await call('knowledge_save', { ...knowledge, agent_id: second.id, title: 'Compartilhado', shared: true });
    assert.equal((await call('read', { agent_id: first.id })).knowledge.length, 2);
    assert.deepEqual((await call('read', { agent_id: second.id })).knowledge.map(row => row.shared), [true]);
    await call('plan_thread', { agent_id: first.id, thread_id: thread });

    await db.exec('reset role');
    await apply();
    const attribution = await db.query(`select t.agent_id, t.planned_agent_id, j.agent_id as job_agent,
      j.lease_token, j.attempts, j.state
      from neo_private.support_threads t join neo_private.ai_jobs j on j.thread_id = t.id
      where j.id=$1`, [claimed.id]);
    assert.deepEqual(attribution.rows[0], {
      agent_id: defaultAgent, planned_agent_id: first.id, job_agent: defaultAgent,
      lease_token: claimed.lease, attempts: 1, state: 'running'
    });
    const stored = await db.query('select encrypted_key, validated_revision from neo_private.ai_integrations where id=$1', [integration]);
    assert.deepEqual(stored.rows[0].encrypted_key, fakeCredential);
    assert.equal(Number(stored.rows[0].validated_revision), 1);

    await as(db, 'service_role');
    assert.equal((await rpc(db, 'neo_ai_finish', claimed.id, claimed.lease, 'Resposta original', false, false)).published, true);
    assert.equal((await rpc(db, 'neo_ai_finish', claimed.id, claimed.lease, 'Duplicada', false, false)).published, false);
    await as(db, 'authenticated', member);
    const opened = await rpc(db, 'neo_support', 'open', {});
    assert.equal(opened.messages.filter(row => row.body === 'Resposta original').length, 1);
    assert.equal(opened.planned_agent_id, undefined);
    await as(db, 'authenticated', admin);
    assert.equal((await call('list')).length, 3);
    assert.equal((await call('read', { agent_id: first.id })).knowledge.length, 2);
    await rpc(db, 'neo_agent', 'save', { mode: 'suggest' });
    await as(db, 'authenticated', member);
    const suggestionMessage = '00000000-0000-4000-8000-000000000104';
    await rpc(db, 'neo_support', 'send', { thread_id: thread, id: suggestionMessage, body: 'Como exporto um backup?' });
    await as(db, 'service_role');
    const suggestion = await rpc(db, 'neo_ai_claim', member, suggestionMessage);
    assert.equal((await rpc(db, 'neo_ai_finish', suggestion.id, suggestion.lease, 'Sugestão privada', false, false)).drafted, true);
    await as(db, 'authenticated', member);
    const memberView = await rpc(db, 'neo_support', 'open', {});
    assert.equal(memberView.agent_draft, undefined);
    assert.ok(!memberView.messages.some(row => row.body === 'Sugestão privada'));

    await as(db, 'authenticated', admin);
    await rpc(db, 'neo_agent', 'save', { mode: 'manual', tone: 'Atualizado' });
    const current = await call('read', { agent_id: defaultAgent });
    assert.equal(current.agent.settings.tone, 'Atualizado');
    assert.equal(current.agent.settings.mode, 'manual');
    await as(db, 'authenticated', member);
    const manualMessage = '00000000-0000-4000-8000-000000000105';
    await rpc(db, 'neo_support', 'send', { thread_id: thread, id: manualMessage, body: 'Preciso da equipe.' });
    await as(db, 'service_role');
    assert.equal(await rpc(db, 'neo_ai_claim', member, manualMessage), null);
  } finally {
    await db.close();
  }
});
