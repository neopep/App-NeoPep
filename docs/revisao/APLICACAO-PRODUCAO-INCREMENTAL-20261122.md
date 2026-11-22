# NeoPep — execução incremental no Supabase de Produção

**Data:** 22/11/2026 · **Solicitação do proprietário:** implementar no ambiente oficial as novas funcionalidades desenvolvidas no Teste, sem reinstalar o app e sem substituir usuários, pagamentos e arquivos existentes.

**Ambiente alterado:** somente banco **cpslafpzjtbpmoxxysaa**, `postgres` (Supabase oficial). O projeto de Teste `qnuluspqfazdppciermw` **não foi alterado** nesta execução. Vercel, Edge Functions, Auth, secrets, cron e Git `main` **não foram alterados**. A versão web oficial **ainda não foi publicada**.

## Migrações efetivamente concluídas em Produção

Cada aplicação foi autorizada pelo pedido de implementação, executada via Supabase `apply_migration` com transação, `lock_timeout=3s`, `statement_timeout` limitado e preflight conferindo o banco `postgres` e objetos ausentes. Os nomes/versões abaixo foram retornados pelo ledger oficial **após** as operações:

| Versão oficial | Migração aplicada | Origem do plano | Resultado |
|---|---|---|---|
| `20261122230935` | `neo_release_signup_notices_incremental` | Lote 01: avisos de cadastro | Sucesso |
| `20261122230954` | `neo_release_audience_observations_incremental` | Lote 02a: audiência | Sucesso |
| `20261122231007` | `neo_release_engagement_incremental` | Lote 02b: engajamento | Sucesso |
| `20261122231047` | `neo_release_multiagent_foundation_inert_incremental` | Lote 03: base de agentes; runtime original preservado | Sucesso |
| `20261122231117` | `neo_release_admin_operations_monitor_incremental` | Lote 04: monitoramento, operações, telemetria | Sucesso |
| `20261122231143` | `neo_release_campaigns_whatsapp_inert_incremental` | Lote 05: campanhas, imagens, WhatsApp | Sucesso |
| `20261122231242` | `neo_release_connect_production_schema_paused_incremental` | Lote 06: Connect, atualização, grupos | Sucesso |

**NÃO reaplicar essas migrações na Produção.** A ausência histórica do ledger foi substituída por **7 entradas próprias de Produção**. As 16 versões do Teste não foram copiadas ou executadas como baseline.

## Adaptações documentadas

- Lotes 01 e 02: fontes SQL do Git, removidos marcadores externos de transação para a execução atômica da ferramenta, com verificação de objetos ausentes antes do DDL.
- Lote 03: fonte `202611200001_multiagent_foundation.sql`, parte inicial do runtime `202611200002_multiagent_runtime.sql` **até a âncora** `-- Keep the installed wrappers intact`, e `multiagentes-inertes.sql`. Não substituir `neo_agent`, `neo_ai_claim`, `neo_ai_finish`, `neo_support` e triggers oficiais. A inatividade de agentes adicionais é imposta no banco.
- Lote 04: fontes de monitoramento e operações; da migração `20261121192900_staging_audit_hardening.sql`, somente a região a partir de `alter table neo_private.system_ai_calls add column agent_id`, com as substituições controladas do manifesto, entre elas `staging` → `production`. A política oficial de mensagens foi excluída do delta selecionado.
- Lote 05: cinco fontes do manifesto de campanhas; adicionado `campanhas-inertes.sql`. Foi criado bucket privado `neo-campaign-images`. Nenhum agendamento ou campanha ativa de Teste foi importado. O claim da fila foi revogado de `service_role`.
- Lote 06: sete fontes do manifesto de Connect; **sete literais de perfil SQL** `'staging'` foram adaptados para `'production'` nos arquivos `tests/fixtures/connect/update-channel.sql` e `20261122152200_neopep_connect_release_verified_drafts.sql`. A referência documental ao projeto de Teste no fixture de grupos foi retirada da consulta SQL. Adicionado `connect-inerte.sql` que mantém a base pausada, releases em `draft` e revoga `EXECUTE` dos endpoints de Connect de todos os papéis aplicativos/serviço. Bucket privado `neo-connect-releases` criado **sem copiar instaladores**.
- **Financeiro 07 não foi executado**, assim como alterações opcionais de Edge `mercadopago-create` e `mercadopago-webhook`. Os pagamentos, Auth e notificações oficiais permanecem como origem de verdade.

## Pós-voo consultado diretamente no Supabase oficial

| Verificação SQL agregada | Resultado |
|---|---:|
| Tabelas totais em `public` e `neo_private` | **90** (antes 52; +38) |
| Funções totais em `public` e `neo_private` | **177** (antes 135; +42) |
| Tabelas públicas sem RLS | **0** |
| Contas existentes em `auth.users` | **8** (preservadas em contagem) |
| Pedidos existentes em `neo_private.shop_orders` | **18** (preservados em contagem) |
| Objetos Storage | **34** (preservados em contagem) |
| Buckets Storage | **9**, todos privados (antes 7) |
| Agentes `active` | **0** |
| Campanhas `active` | **0** |
| `connect_config.paused` | **true** |
| `authenticated` e `service_role` com `EXECUTE` de `neo_connect_admin` | **false** |
| `service_role` com `EXECUTE` de `neo_campaign_push_claim` | **false** |

A leitura de contagens **não é uma prova de restauração** nem atesta que cada linha pessoal esteja semanticamente idêntica; essas operações foram aditivas e não contiveram importação dos registros do Teste. O advisor de segurança retorna achados esperados sobre tabelas internas com RLS sem policy, além de outros avisos que precisam revisão individual; não declarar ausência de vulnerabilidades apenas pelo número de policies.

## Itens NÃO concluídos: importantes para não confundir schema com lançamento integral

1. **Frontend:** as últimas melhorias dos PRs #22 e #23 já foram integradas à branch do PR #25; o PR continua aberto, sem merge. O **CI técnico de 515649c6 passou**, o gate de liberação pública permanece NO-GO.
2. **IA:** faltam 14 funções de Teste que não foram ativadas e existem oito rotinas oficiais com contratos diferentes. Não trocar o worker/claim/finish/consentimentos nem ativar agentes adicionais sem compatibilidade validada.
3. **Campanhas e push:** bases SQL estão instaladas, mas as restrições de inatividade e revogações permanecem. A integração das Edge Functions e a ativação do canal são tarefas separadas, com teste de consentimento, isolamento, fila e cron oficiais.
4. **Connect Windows:** schema e controles instalados, mas o canal permanece pausado e as funções de dispositivo foram revogadas. Não distribuir executáveis/credenciais do Teste ou marcar Connect operacional.
5. **Publicação plena:** SMTP, CAPTCHA, Auth de novas contas, domínio Vercel, redeploy, PWA móvel, pagamentos ativos, permissões e privacidade exigem validação real. A captura Vercel mostra `app-neopep-staging` Ready, não o deployment oficial `app-neopep`.
6. **Backup:** o backup lógico e os objetos foram exportados em etapa anterior, mas o teste de restauração real foi adiado a pedido do proprietário. O risco precisa ser registrado, não considerado encerrado.

## Decisão de mudança

**Banco aditivo instalado. Aplicativo público ainda NO-GO**, enquanto dependências/flags e a publicação Vercel não forem homologadas. Não reaplicar migrações históricas, não copiar usuários ou dados de Teste e não confundir 90 tabelas com 90 funcionalidades prontas. Preservar o estado atual da Produção até release seguro e específico do frontend/Edge.
