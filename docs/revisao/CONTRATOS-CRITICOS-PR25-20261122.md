# Contratos críticos e privilégios — revisão independente do PR #25

**Data:** 22/11/2026 · **Destinos consultados:** Teste `qnuluspqfazdppciermw`; Produção `cpslafpzjtbpmoxxysaa`. **Método:** consultas autenticadas exclusivamente de leitura em `pg_proc`, `pg_namespace`, `pg_get_functiondef` e `has_function_privilege`, com cruzamento da matriz anterior. Não houve execução de RPCs de aplicação, SQL de escrita, acesso a segredos, deploy ou pagamentos. Esta evidência **não** comprova autorização dentro dos handlers, RLS ou interoperabilidade em tempo real.

## Resultado das permissões efetivas

| Dimensão das funções presentes nos dois ambientes | Teste | Produção | Diferenças |
|---|---:|---:|---:|
| Rotinas `public` e `neo_private` | 191 | 135 | 56 somente no Teste |
| Assinaturas compartilhadas | 135 | 135 | — |
| `service_role` com `EXECUTE` efetivo em rotinas compartilhadas | 72 a menos no Teste | 72 a mais na Produção | **72** |
| `authenticated` com `EXECUTE` efetivo | `neo_limit_writes()` sem EXECUTE | `neo_limit_writes()` com EXECUTE | **1** |
| `anon`, `SECURITY DEFINER`, owner, `proconfig` em compartilhadas | Sem diferenças encontradas nesses atributos | Sem diferenças encontradas nesses atributos | **0** |

As **72 divergências** de ACL da matriz anterior são reproduzíveis por `has_function_privilege('service_role', oid, 'EXECUTE')`: a versão **oficial concede acesso efetivo a `service_role`**, enquanto o Teste não. **Não importar as ACL do Teste para Produção**: Edge e integrações de pagamentos podem depender do privilégio oficial. O acesso à API via `authenticated` para `public.neo_limit_writes()` também é diferente e deve ser preservado até análise de consumidores. Hash/ACL textual e `EXECUTE` efetivo são conceitos distintos.

## Oito rotinas com divergência de contrato

| Rotina | Diferença funcional observada diretamente no código instalado | Decisão segura |
|---|---|---|
| `neo_private.community_default_notices()` | O `push_enabled` inicial é `true` na Produção e `false` no Teste | Preservar configuração oficial; alinhar consentimento antes de alterar |
| `neo_private.enqueue_ai()` | Produção consulta `agent_settings` e aplica cancelamento/seleção geral; Teste seleciona `support_threads.agent_id` para runtime de agente específico | Não substituir trigger sem testar fila, atribuição, consentimento e cancelamentos |
| `neo_private.push_dispatch_wake()` | Produção consulta segredo no Vault e chama o dispatch via `net.http_post`; Teste usa função inerte que retorna sem chamada | Preservar wake-up e cron oficial; não copiar a função inerte |
| `neo_private.support_push_wake()` | Produção realiza chamada autenticada ao dispatch para mensagens; Teste retorna `NEW` sem disparo | Preservar notificações atuais; ativação de campanhas separada |
| `public.neo_agent(text,jsonb)` | Na rotina de administração, o cancelamento oficial de jobs pendentes/em execução não filtra por `agent_id`; Teste filtra o agente específico | Há diferença de alcance do cancelamento; preservar oficial até teste com duas contas/agentes |
| `public.neo_ai_claim(uuid,uuid)` | O fluxo oficial usa `agent_settings`/integração; Teste usa catálogo `agents`, modo/runtime de agentes e procura candidatos de outra forma | Não trocar seletor/lease sem contrato de retorno e testes de concorrência |
| `public.neo_ai_finish(uuid,uuid,text,boolean,boolean)` | A versão de Teste usa `agents` e a oficial usa `agent_settings`/integrações; há diferença no processamento de finalização | Manter oficial; testar idempotência, lease, handoff e consentimento |
| `public.neo_support(text,jsonb)` | Produção é wrapper estendido sobre `neo_support_v72` e enriquece resposta; Teste inclui lógica própria de multagentes/runtimes e chama outras tabelas | Não sobrescrever atendimento oficial ou reduzir seu contrato |

**Cuidado com a evidência:** diferenças de corpo acima foram observadas em funções vivas; não significam que toda função esteja errada. O catálogo de `pg_depend` não identifica todas as chamadas dinâmicas. `neo_agent` e `neo_support` possuem `SECURITY DEFINER` e `EXECUTE` para `authenticated` nos dois projetos: deve-se comprovar autorização interna e isolamento cross-account antes de qualquer liberação. `service_role` oficial é relevante especialmente para Edge e operação administrativa.

## Correção de controle no próprio PR

- `release/production/catalog.sql` passou a registrar o `EXECUTE` **efetivo** de `service_role` em todas as rotinas catalogadas, além de `anon`, `authenticated`, corpo e ACL.
- `release/production/verify-invariants.py` agora rejeita **qualquer modificação ou exclusão de objeto já instalado**, inclusive rotinas, grants, atributos, RLS, triggers, policies, índices, constraints, Auth, cron e Storage. Classes de novos objetos são limitadas e novos buckets devem ser privados e autorizados.
- A única exceção programática exige `--allow-finance-routine-change` e se restringe ao `body_hash` de `public.neo_shop_v36(p_action text, p_payload jsonb)`; demais atributos seguem protegidos. A migração 07 tem seu próprio gate de fingerprint e checksum do manifesto.
- `tests/production-invariants.test.cjs` introduz cenários de regressão, incluídos em `Production Candidate CI`. O teste de inventário PGlite agora prepara a role `service_role`; o ensaio PostgreSQL com os sete lotes passa a sinalizar explicitamente a exceção financeira.
- **Limite:** isto é um pós-voo complementar, não uma prova de que SQL futuro seja seguro. Deltas esperados, RLS, gatilhos e permissões devem ser conferidos em banco isolado com dados sintéticos ou restauração aprovada.

## Próximas decisões para GO

1. Ensaiar os novos gates no CI e no PostgreSQL sintético. Confirmar ausência de falsos positivos.
2. Validar com usuários controlados todas as rotinas `SECURITY DEFINER` acessíveis a `authenticated`, especialmente `neo_agent`, `neo_support` e `neo_limit_writes`, com tentativas legítimas e cross-account.
3. Reconciliar as quatro versões de migração do Teste sem fonte Git 1:1; não preencher o ledger da Produção por cópia.
4. Homologar sandbox Mercado Pago (mesma chave de checkout, webhook duplicado, reembolso parcial/total, signature/HMAC e mismatch de conta).
5. Confirmar integrações Auth, Edge, cron e Vercel, e decisão independente de aplicação de DDL, deploy Edge, frontend e merge. O ensaio de restauração real foi adiado pelo proprietário: pendência **não comprovada**, sem bloqueio para estas tarefas de auditoria.

**Decisão atual: NO-GO.** Nenhuma alteração foi feita nas instâncias oficiais neste trabalho.
