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
    await db.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'multiagent-postgres.sql'), 'utf8'));
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
    assert.equal(first.status, 'inactive');
    assert.equal(second.status, 'inactive');
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

    await db.exec('reset role');
    const runtime = fs.readFileSync(path.join(migrations, '202611200002_multiagent_runtime.sql'), 'utf8');
    await db.exec(runtime);
    await db.exec(runtime);
    await as(db, 'authenticated', member);
    await assert.rejects(rpc(db, 'neo_support', 'agent_select', { thread_id: thread, agent_id: first.id }), { code: '42501' });
    await assert.rejects(rpc(db, 'neo_multiagent_test', admin, first.id), { code: '42501' });

    await as(db, 'authenticated', admin);
    await rpc(db, 'neo_complete_onboarding',
      { ...core.defaultProfile(), name: 'Equipe', height: 174, initialWeight: 80, goal: 75, consent: true },
      core.blank().settings, true, true);
    const firstBefore = (await call('read', { agent_id: first.id })).agent;
    const secondBefore = (await call('read', { agent_id: second.id })).agent;
    await assert.rejects(save(secondBefore, { status: 'active' }), /modelo validado/);
    const active = (await save(firstBefore, { status: 'active', mode: 'suggest', daily_limit: 2 })).agent;
    assert.equal(active.status, 'active');
    await call('knowledge_save', { ...knowledge, agent_id: second.id, title: 'Exclusivo da loja' });
    const options = await rpc(db, 'neo_support', 'open', { thread_id: thread });
    assert.ok(options.agent_choices.some(row => row.id===first.id));
    assert.ok(!options.agent_choices.some(row => row.id===second.id));
    await rpc(db, 'neo_support', 'agent_select', { thread_id: thread, agent_id: first.id });

    await as(db, 'authenticated', member);
    const withoutConsent = await rpc(db, 'neo_support', 'open', {});
    assert.equal(withoutConsent.ai_opt_in, false);
    assert.equal(withoutConsent.ai_provider, 'openai');
    assert.equal(withoutConsent.agent_choices, undefined);
    await assert.rejects(rpc(db, 'neo_support', 'ai_consent', { thread_id: thread, granted: true, provider: 'gemini' }), /provedor alterado/);
    await rpc(db, 'neo_support', 'ai_consent', { thread_id: thread, granted: true, provider: 'openai' });
    const selectedMessage = '00000000-0000-4000-8000-000000000106';
    const selectedSend = await rpc(db, 'neo_support', 'send', { thread_id: thread, id: selectedMessage, body: 'Mensagem autorizada' });
    assert.equal(selectedSend.agent_dispatch, true);

    await as(db, 'service_role');
    await assert.rejects(rpc(db, 'neo_multiagent_test', member, first.id), { code: '42501' });
    const isolated = await rpc(db, 'neo_multiagent_test', admin, first.id);
    assert.match(isolated.instructions, /Compartilhado/);
    assert.doesNotMatch(isolated.instructions, /Exclusivo da loja|Conteúdo original/);
    const selectedJob = await rpc(db, 'neo_ai_claim', member, selectedMessage);
    assert.equal(selectedJob.integration_id, integration);
    assert.equal(selectedJob.model, 'test-model');
    assert.match(selectedJob.instructions, /Ajude com materiais/);
    assert.doesNotMatch(selectedJob.instructions, /Exclusivo da loja/);
    assert.deepEqual(selectedJob.messages.map(x=>x.content), ['Mensagem autorizada']);
    assert.equal(await rpc(db, 'neo_ai_claim', member, selectedMessage), null);
    await assert.rejects(rpc(db, 'neo_multiagent_test', admin, first.id), /daily limit/);
    const otherTest = await rpc(db, 'neo_multiagent_test', admin, second.id);
    assert.match(otherTest.instructions, /Exclusivo da loja/);
    assert.equal((await rpc(db, 'neo_ai_finish', selectedJob.id, selectedJob.lease, 'Resposta revisável', false, false)).drafted, true);
    assert.equal((await rpc(db, 'neo_ai_finish', selectedJob.id, selectedJob.lease, 'Resposta duplicada', false, false)).published, false);

    await as(db, 'authenticated', admin);
    const withDraft = await rpc(db, 'neo_support', 'open', { thread_id: thread });
    assert.equal(withDraft.agent_id, first.id);
    assert.equal(withDraft.agent_draft.body, 'Resposta revisável');
    const approved = await rpc(db, 'neo_support', 'agent_approve', { thread_id: thread, draft_id: withDraft.agent_draft.id });
    assert.ok(approved);
    await rpc(db, 'neo_support', 'agent_approve', { thread_id: thread, draft_id: withDraft.agent_draft.id });
    await as(db, 'authenticated', member);
    assert.equal((await rpc(db, 'neo_support', 'open', {})).messages.filter(row=>row.body==='Resposta revisável').length, 1);

    await as(db, 'service_role');
    await rpc(db, 'neo_multiagent_tested', admin, second.id, otherTest.agent_revision,
      otherTest.integration_id, otherTest.integration_revision, otherTest.model);
    await as(db, 'authenticated', admin);
    const readySecond = (await call('read', { agent_id: second.id })).agent;
    assert.equal(readySecond.integration_validated, true);
    await save(readySecond, { status: 'active', mode: 'auto' });
    await rpc(db, 'neo_support', 'agent_select', { thread_id: thread, agent_id: second.id });
    await rpc(db, 'neo_support', 'agent_mode', { thread_id: thread, mode: 'auto' });

    await as(db, 'authenticated', member);
    const revokedMessage = '00000000-0000-4000-8000-000000000107';
    assert.equal((await rpc(db, 'neo_support', 'open', {})).ai_opt_in, false);
    await rpc(db, 'neo_support', 'send', { thread_id: thread, id: revokedMessage, body: 'Antes do novo consentimento' });
    await as(db, 'service_role');
    assert.equal(await rpc(db, 'neo_ai_claim', member, revokedMessage), null);
    await as(db, 'authenticated', member);
    await rpc(db, 'neo_support', 'ai_consent', { thread_id: thread, granted: true, provider: 'openai' });
    const automaticMessage = '00000000-0000-4000-8000-000000000108';
    await rpc(db, 'neo_support', 'send', { thread_id: thread, id: automaticMessage, body: 'Nova mensagem permitida' });
    await as(db, 'service_role');
    const automatic = await rpc(db, 'neo_ai_claim', member, automaticMessage);
    assert.equal(automatic.model,'other-model');
    assert.match(automatic.instructions,/Exclusivo da loja/);
    assert.doesNotMatch(automatic.instructions,/Ajude com materiais/);
    assert.deepEqual(automatic.messages.map(x=>x.content), ['Nova mensagem permitida']);
    await as(db, 'authenticated', admin);
    await rpc(db, 'neo_agent', 'save', { tone: 'Atualização do agente padrão' });
    await as(db, 'service_role');
    assert.equal((await rpc(db, 'neo_ai_finish', automatic.id, automatic.lease, 'Encaminhado à equipe', true, false)).published,true);
    assert.equal((await rpc(db, 'neo_ai_finish', automatic.id, automatic.lease, 'Duplicada', false, false)).published,false);
    await as(db, 'authenticated', member);
    assert.equal((await rpc(db, 'neo_support', 'open', {})).ai_opt_in,false);
    await as(db, 'authenticated', admin);
    assert.equal((await rpc(db, 'neo_support', 'open', { thread_id: thread })).agent_mode,'manual');
    await rpc(db, 'neo_support', 'agent_mode', { thread_id: thread, mode: 'auto' });
    await rpc(db, 'neo_support', 'agent_select', { thread_id: thread, agent_id: defaultAgent });
    assert.equal((await rpc(db, 'neo_support', 'open', { thread_id: thread })).agent_mode,'manual');
  } finally {
    await db.close();
  }
});
