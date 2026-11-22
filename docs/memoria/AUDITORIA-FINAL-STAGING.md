# Auditoria final do NeoPep Teste

Revisão de MEM-20261121-017 a MEM-20261121-021 em 21/11/2026. Escopo da homologação: `staging/permanente`, `qnuluspqfazdppciermw` e `app-neopep-staging`.

| Requisito | Responsável | Situação anterior | Correção | Teste executado | Resultado | Pendência |
| --- | --- | --- | --- | --- | --- | --- |
| Configurações administrativas | `dist/admin/admin.js` | Painel ficava vazio quando o módulo opcional de pagamentos não carregava | Configurações essenciais montam sem esse módulo | Suíte original admin-ui | Os dois casos passaram | Conferência visual autenticada |
| Privacidade push | `dist/sw.js`, `push-dispatch` | Título e corpo recebidos podiam revelar conteúdo na tela bloqueada | Mensagens locais discretas, sem transmitir título e corpo no novo payload | Suíte original PWA, build e revisão da Edge | Os dois casos passaram, push-dispatch v3 em staging | Atualização real do SW em um dispositivo já instalado |
| CI | `.github/workflows/staging-ci.yml` | Nenhum fluxo dedicado | Node 22, dependências fixadas, auditoria, build, check, testes focados e suíte completa | Comandos locais e auditoria npm | 124 testes focados aprovados, zero vulnerabilidades na auditoria npm | Conferir execução no GitHub e tratar falhas herdadas da suíte geral |
| Advisors, SECURITY DEFINER, RLS e EXECUTE | Migração `20261121192900` | EXECUTE anônimo em rls_auto_enable, 1 política com initplan evitável, 38 FKs sem índice | Revogação direcionada, política equivalente e 3 índices | Advisors antes/depois, SQL com rollback, tabela descartável com RLS automática | EXECUTE anônimo removido, RLS automática preservada, 35 FKs sinalizadas, alerta de initplan resolvido | 62 tabelas privadas sem política de cliente, 52 funções autenticadas SECURITY DEFINER, 10 índices sem tráfego. Avaliar individualmente. Senhas vazadas dependem de Pro ou superior |
| Custos de IA | `ai-reply`, `_shared/ai-usage.ts`, `neo_system_ai_record` | Dimensão fixa de atendimento | Agente e funcionalidade derivados do job interno, ambiente explícito, dimensões separadas no painel | Deduplicação, cache, falha, múltiplos agentes e autorização | Aprovado com dados sintéticos, Edge ai-reply v5. Sem chamadas pagas | Conferir chamadas reais após autorização e tarifário versionado |
| Consumo Supabase | `dist/admin/admin.js` | Métricas internas sem referência explícita à franquia | Organização autenticada Free, cotas oficiais com fontes, medição interna e limites manuais separados | Inspeção autenticada do plano e fixtures sem dados | Referência conferida para banco, Storage, egress, Auth, Realtime e Edge | Conectar fontes de consumo oficial quando disponíveis |
| GitHub e Vercel | `api/admin-monitor.js` | Integração sob demanda, sem evidência ponta a ponta | Preservados guardas e tratamento de credencial ausente | Fixtures, status pelo conector GitHub, tentativa HTTPS | Autorização e proteção de projeto aprovadas em teste. Proxy CONNECT 403 impediu chamadas REST diretas | Sessão administrativa no domínio e token/ID de leitura da Vercel no backend para histórico |
| Origem aproximada | `api/staging-observe.js`, migração, `src/app.js` | Sem fonte confiável | Opt-in explícito, cabeçalhos nativos da Vercel, primeiro e último locais independentes, sem IP bruto ou GPS | SQL com rollback, autenticação, revogação/exclusão, código do endpoint | Implementado, desativado por ausência de configuração confirmada | Habilitar flag e chave de staging, validar cabeçalhos no domínio protegido |
| Amostras agendadas | `api/staging-observe.js`, `neo_system_observe` | Dependência do painel aberto | Rota autenticada registra sucesso e falha, preserva limites e alertas | Fixtures e SQL com rollback | Autorização e registro aprovados. Sem agendamento ativo | Configurar segredos de staging e agendamento diário compatível com o plano |
| Exportações | `neo_admin_signup_export`, `dist/admin/admin.js` | Limite de 5.000 cadastros | Consulta por cursor com até 250 linhas por chamada, limite por exportação de 20.000, CSV protegido e resumo imprimível em PDF | Filtros, cursor, autorização e CSV | Aprovado localmente e no banco com rollback | Dividir exportações acima de 20.000 por período. XLSX dedicado permanece pendente |
| Experiência | `src/app.js`, `src/cloud.js`, `neo_quality_observe` | Métricas técnicas próprias | LCP, CLS e INP via web-vitals e consentimento existente, agrupamento por navegador e dispositivo | Build, testes de privacidade e validação da API de qualidade | Suporte a métricas por navegador, coleta sem valores inventados | Validar coleta real em desktop e iPhone |
| Auditoria e lacunas | SQL de operações, painel e telemetria IA | Auditoria parcial, funis de uso e recomendações determinísticas | Rotinas e custos por dimensão ampliados. Coortes, recorrência e engajamento preservados | Testes de operações, permissões, coortes e IA | Aprovado para cenários cobertos | Pagamento confirmado precisa de evento autoritativo. Funil de cadastro antes de consentimento e operações externas seguem sem cobertura completa |
| Validação prática | DB de staging, workflow e domínio de teste | Fluxo autenticado pendente | Exercitados papéis sintéticos em transações reversíveis e suítes do app | SQL remoto, build, check, pacote portátil, testes focados e tentativa de navegador | Segurança da sessão SQL aprovada. Navegador retornou `Browser Use could not read requirements` | Sessões fictícias autenticadas de admin e participante em desktop e iPhone, incluindo cadastro, relatórios, revogação e monitor |

## Erros originais dos quatro casos corrigidos

Os testes originais foram preservados.

```text
✖ failing tests:

test at tests/admin-ui.test.cjs:6:1
✖ Configurações usa API autorizada e não oferece armazenamento de chaves no navegador (17.688663ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

    assert.ok(a.document.querySelector('#platformForm'))

      at TestContext.<anonymous> (tests/admin-ui.test.cjs:6:707)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: null,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/admin-ui.test.cjs:8:1
✖ controle de cadastro só habilita após consultar e bloqueia estado após falha (7.479497ms)
  TypeError [Error]: Cannot read properties of null (reading 'disabled')
      at TestContext.<anonymous> (tests/admin-ui.test.cjs:8:906)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)

test at tests/pwa.test.cjs:4:1
✖ push usa mensagem discreta e clique abre somente a área do app (5.526409ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

    assert.ok(!JSON.stringify(shown).includes('PRIVATE WEIGHT'))

      at TestContext.<anonymous> (tests/pwa.test.cjs:4:719)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/pwa.test.cjs:5:1
✖ notificação comunitária não repete conteúdo e abre a conversa (1.01692ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /nova postagem/. Input:

  'DADO PRIVADO'

      at TestContext.<anonymous> (tests/pwa.test.cjs:5:596)
      at async Test.run (node:internal/test_runner/test:1409:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'DADO PRIVADO',
    expected: /nova postagem/,
    operator: 'match',
    diff: 'simple'
  }

```

## Resultado da suíte completa

A suíte final executou 342 testes, com 280 aprovações e 62 falhas. A comparação dos nomes dos casos reprovados com a linha de base após as quatro correções confirmou as mesmas 62 falhas herdadas. As quatro correções passaram com os testes originais.
