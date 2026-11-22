# Catálogo Supabase comparado com conexão autenticada — 22/11/2026

**Status:** auditoria de metadados SOMENTE LEITURA, sem DDL, sem copiar dados/secretos e sem deploy. Esta análise complementa o [PR #25](https://github.com/neopep/App-NeoPep/pull/25) e a [issue #24](https://github.com/neopep/App-NeoPep/issues/24). **Não atesta que a restauração foi testada nem concede GO.**

## Destinos verificados

- **Teste:** `qnuluspqfazdppciermw` (Supabase Staging).
- **Produção:** `cpslafpzjtbpmoxxysaa` (Supabase oficial).
- Métodos: `SELECT` read-only do `pg_catalog`, `information_schema`, `pg_policies` e `storage.buckets` via conexão Supabase. Nomes de objetos e hash de definições, sem linhas de usuários, pedidos, tokens ou segredos.

## Delta observado

| Objeto | Teste | Produção | Somente Teste | Somente Produção | Definições divergentes |
|---|---:|---:|---:|---:|---:|
| Tabelas (public + neo_private) | 90 | 52 | 38 | 0 | 0 metadados RLS/kind |
| Colunas | 689 | 396 | 293 | 0 | 1 default |
| Restrições | 405 | 227 | 178 | 0 | 0 |
| Índices | 149 | 79 | 70 | 0 | 0 |
| Triggers | 32 | 19 | 13 | 0 | 0 |
| Políticas (public/neo_private/storage) | 36 | 33 | 3 | 0 | 1 definição |
| Rotinas (public + neo_private) | 191 | 135 | 56 | 0 | 124 hashes de definição |
| Grants nas tabelas (public + neo_private) | 680 | 435 | 273 | 28 | n/a |

**Aviso sobre hashes:** diferenças textuais de corpos SQL não implicam necessariamente mudança funcional, nem autorizam substituição automática. Comparar os efeitos e as dependências das rotinas críticas, em especial `neo_shop*`, Auth, IA, push e Storage.

## Novas tabelas (38)

```
neo_private.agents
neo_private.campaigns
neo_private.account_geo
neo_private.connect_audit
neo_private.connect_tasks
neo_private.campaign_plans
neo_private.connect_config
neo_private.connect_devices
neo_private.system_ai_calls
neo_private.connect_accounts
neo_private.connect_releases
neo_private.connect_sessions
neo_private.operations_audit
neo_private.system_ai_prices
neo_private.engagement_events
neo_private.operations_review
neo_private.campaign_wa_groups
neo_private.operations_quality
neo_private.signup_notice_reads
neo_private.system_monitor_runs
neo_private.campaign_impressions
neo_private.campaign_push_opt_in
neo_private.audience_observations
neo_private.connect_update_events
neo_private.signup_notice_rollout
neo_private.system_monitor_alerts
neo_private.system_monitor_limits
neo_private.agent_runtime_attempts
neo_private.campaign_push_delivery
neo_private.connect_group_accounts
neo_private.connect_wa_connections
neo_private.agent_catalog_knowledge
neo_private.campaign_wa_confirmation
neo_private.campaign_wa_publications
neo_private.connect_release_evidence
neo_private.system_monitor_snapshots
neo_private.campaign_wa_reminder_seen
neo_private.connect_wa_selected_groups
```

## Alterações necessárias em tabelas JÁ existentes

São **9 colunas novas** em 3 tabelas comuns, além de novas tabelas. Estas modificações precisam ser incluídas explicitamente no delta aditivo e testadas contra dados legados:

| Tabela existente | Colunas novas em Teste |
|---|---|
| `neo_private.ai_attempts` | `agent_id uuid`, `input_tokens bigint`, `output_tokens bigint`, `cost_microusd bigint` |
| `neo_private.ai_jobs` | `agent_id uuid`, `knowledge_revision text` |
| `neo_private.support_threads` | `agent_id uuid`, `planned_agent_id uuid`, `runtime_consent_provider text` |

**Default que deve ser tratado como divergência intencional:** `neo_private.community_preferences.push_enabled` é `false` no Teste e `true` na Produção. **Não copiar o default do Teste sem decisão explícita sobre push e consentimentos**, e nunca sobrescrever preferências de usuários.

## Políticas e permissões críticas

As três políticas presentes somente no Teste são do `storage.objects`:
- `campaign_images_read`;
- `campaign_images_upload`;
- `connect_release_download`.

Há uma política em `public.neo_message_events` chamada `neo_message_events_own` com hash divergente. Comparar a definição real, o escopo de conta e os roles antes de atualizar.

**28 grants extras existem SOMENTE na Produção:** `service_role` tem privilégios explícitos nas sete tabelas públicas `neo_photos`, `neo_records`, `neo_consents`, `neo_profiles`, `neo_consent_events`, `neo_message_events`, `neo_migration_receipts` (SELECT/INSERT/UPDATE/DELETE). **Preservar esses grants**; não impor paridade cega substituindo ACLs.

## Ordem segura de migração a preparar

1. Inventário final com fingerprints e **baseline** do esquema oficial atual, sem reaplicar migrações de instalação.
2. Migrações aditivas por dependência: tabelas/índices/RLS/grants de cadastros e métricas; públicos e engajamento; multiagente (colunas nas três tabelas existentes, validação de FKs e runtime); campanhas e push com flags inertes; WhatsApp manual; Connect com distribuição Windows desativada; Storage e Edge somente nos canais aprovados.
3. Revisar uma a uma as **124 rotinas divergentes** segundo o risco, especialmente Auth, pagamentos, exclusão de conta, push e agentes. Não copiar `SECURITY DEFINER` ou privilégios automaticamente.
4. Corrigir os dois bloqueios financeiros da candidata e homologá-los com API Orders em sandbox; manter as versões oficiais de Edge e pagamentos até liberação aprovada.
5. Validar o backup restaurável do banco **e** dos objetos Storage em destino isolado; comprovar ensaio de migrações/rollback antes de DDL na origem real.
6. Executar CI `Production Candidate CI`, `release:check`, smoke tests em conta de administrador e usuário comum, isolamento entre contas e checagem Vercel READY antes de qualquer GO.

## Bloqueios ainda existentes

- `release/production/batches/manifest.json` contempla apenas os lotes sintéticos **01-cadastros** e **02-audiencia-engajamento**; **não** equivale a plano executável completo para os 38 objetos ausentes e compatibilidade das 124 funções.
- Catálogo completo de Supabase inclui `auth`, `storage`, Views e extensions além deste resumo. O script `release/production/catalog.sql` deve produzir a captura íntegra e auditável em ambiente com `psql` para reconciliação de ledger e dados não sensíveis.
- A prova de recuperação do banco/Storage, a homologação de pagamentos em sandbox e configuração Vercel/AUTH ainda não estão concluídas.
- O PR #25 é **draft / NO-GO**. PRs #22 e #23 continuam excluídos. Não alterar Supabase oficial ou main antes da aprovação dos lotes, com plano de reversão.

