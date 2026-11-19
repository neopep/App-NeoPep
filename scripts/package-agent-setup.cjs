// Reviewable deployment kit. No credentials are generated or embedded.
const fs=require('node:fs');
const sql=fs.readFileSync('supabase/migrations/202611140026_agent_workspace.sql','utf8');
fs.writeFileSync('supabase/setup/agent-workspace.sql',sql);
fs.writeFileSync('/workspace/NeoPeptideos-agente-atendimento.sql',sql);
fs.copyFileSync('docs/gerar-chave-protecao.html','/workspace/NeoPeptideos-gerar-chave-protecao.html');
fs.copyFileSync('docs/AGENTE-DE-ATENDIMENTO.md','/workspace/NeoPeptideos-guia-agente.md');
require('./package-edge-functions.cjs');
console.log('Kit do agente preparado; Supabase e chaves não foram alterados.');
