# Supabase — inventário de referência da issue #24

Dados históricos da auditoria somente leitura relatada na issue. A sessão não conseguiu renovar a consulta autenticada. Compare os catálogos antes de planejar qualquer execução.

**Tabelas privadas:** staging 83, produção 45. **38 novas em staging**:
```text
account_geo
agent_catalog_knowledge
agent_runtime_attempts
agents
audience_observations
campaign_impressions
campaign_plans
campaign_push_delivery
campaign_push_opt_in
campaign_wa_confirmation
campaign_wa_groups
campaign_wa_publications
campaign_wa_reminder_seen
campaigns
connect_accounts
connect_audit
connect_config
connect_devices
connect_group_accounts
connect_release_evidence
connect_releases
connect_sessions
connect_tasks
connect_update_events
connect_wa_connections
connect_wa_selected_groups
engagement_events
operations_audit
operations_quality
operations_review
signup_notice_reads
signup_notice_rollout
system_ai_calls
system_ai_prices
system_monitor_alerts
system_monitor_limits
system_monitor_runs
system_monitor_snapshots
```

**Funções públicas novas:** 38. Assinaturas:
```text
neo_admin_audience(p_from date, p_to date, p_users uuid[])
neo_admin_engagement(p_from date, p_to date, p_area text)
neo_admin_geo(p_users uuid[])
neo_admin_operations(p_section text, p_days integer, p_review jsonb)
neo_admin_signup_export(p_query text, p_new boolean, p_from timestamp with time zone, p_until timestamp with time zone, p_before timestamp with time zone, p_before_id uuid, p_batch timestamp with time zone)
neo_admin_signups(p_action text, p_query text, p_new boolean, p_from timestamp with time zone, p_until timestamp with time zone, p_before timestamp with time zone, p_before_id uuid, p_batch timestamp with time zone)
neo_admin_system(p_action text, p_payload jsonb)
neo_ai_claim_before_multiagent(p_actor uuid, p_message uuid)
neo_ai_finish_before_multiagent(p_job uuid, p_lease uuid, p_body text, p_handoff boolean, p_failed boolean)
neo_audience_self(p_action text, p_device jsonb, p_campaign jsonb)
neo_campaign_admin(p_action text, p_id uuid, p_data jsonb)
neo_campaign_image_allowed(p_path text, p_write boolean)
neo_campaign_push_claim()
neo_campaign_push_finish(p_id uuid, p_outcome text)
neo_campaign_push_preference(p_enabled boolean)
neo_campaign_visit(p_action text, p_impression uuid)
neo_campaign_wa(p_action text, p_id uuid, p_data jsonb)
neo_connect_admin(p_action text, p_data jsonb)
neo_connect_device(p_action text, p_device uuid, p_secret text, p_data jsonb)
neo_connect_release_allowed(p_path text)
neo_connect_release_stage(p_action text, p_data jsonb)
neo_connect_update(p_action text, p_device uuid, p_secret text, p_version text, p_outcome text)
neo_connect_update_admin(p_action text, p_data jsonb)
neo_connect_wa_list_connections()
neo_connect_wa_list_groups(p_connection uuid, p_after text, p_limit integer)
neo_connect_wa_replace_selection(p_device uuid, p_secret text, p_connection uuid, p_expected_revision bigint, p_label text, p_groups jsonb)
neo_connect_wa_set_status(p_device uuid, p_secret text, p_connection uuid, p_status text)
neo_engagement(p_action text, p_events jsonb)
neo_geo_control(p_action text)
neo_geo_observe(p_user uuid, p_country text, p_region text, p_city text)
neo_multiagent(p_action text, p_payload jsonb)
neo_multiagent_foundation(p_action text, p_payload jsonb)
neo_multiagent_test(p_actor uuid, p_agent uuid)
neo_multiagent_tested(p_actor uuid, p_agent uuid, p_agent_revision bigint, p_integration uuid, p_integration_revision bigint, p_model text)
neo_quality_observe(p_metric text, p_duration integer, p_revision text)
neo_support_before_multiagent(p_action text, p_payload jsonb)
neo_system_ai_record(p_call jsonb)
rls_auto_enable()
```

**Funções privadas novas:** 18. Assinaturas:
```text
agent_runtime_hours(a neo_private.agents)
agent_runtime_job_valid(j neo_private.ai_jobs, t neo_private.support_threads)
agent_runtime_knowledge(p_agent uuid)
agent_runtime_mode(t neo_private.support_threads, a neo_private.agents)
agent_runtime_model_valid(a neo_private.agents, i neo_private.ai_integrations)
agent_runtime_prompt(a neo_private.agents, knowledge text)
agent_runtime_reserve(a neo_private.agents)
campaign_admin_allowed()
campaign_destination(p_kind text, p_id uuid)
campaign_display_state(c neo_private.campaigns, t timestamp with time zone)
campaign_matches(c neo_private.campaigns, p_account uuid, p_now timestamp with time zone)
campaign_push_on_display()
campaign_wall_time(p_value text, p_timezone text)
clear_operations_quality()
connect_candidates(t neo_private.connect_tasks)
connect_mark_uncertain()
connect_wa_assert_device(p_device uuid, p_secret text)
record_operations_audit()
```

**Outras diferenças auditadas:** 293 colunas adicionais; 1 alteração em coluna comum `neo_private.community_preferences.push_enabled`: **default `false` em staging, `true` em produção**. Não alterar preferência de usuário/ambiente implicitamente. 124 funções existentes com fingerprints SQL divergentes (**pode incluir diferenças semânticas e/ou formatação; comparar definição e efeito real; NÃO substituir todas às cegas**). 13 triggers adicionais, 70 índices adicionais, 3 políticas novas em Storage, 1 policy existente com diferenças textuais porém aparenta equivalência de filtro em `public.neo_message_events`. **Catalogar e testar novas FKs, constraints, grants, cron, views, índices, triggers, políticas e SECURITY DEFINER individualmente**. Schema da produção tem `pg_cron` mas staging não; produção possui cron real `neo-push-dispatch`, ativo **a cada minuto**; mantê-lo e testar que novas funções de push NÃO disparam vazamentos ou duplicidades. Não normalizar extensões por cópia.

**Buckets privados:** staging inclui `neo-campaign-images` e `neo-connect-releases` que faltam na produção. Criá-los com as respectivas limitações de MIME, tamanho e policies **somente quando o fluxo for liberado**; nunca copiar arquivos do teste ou abrir acesso público. Buckets comuns: `neo-community`, `neo-community-avatars`, `neo-community-files`, `neo-library`, `neo-private`, `neo-shop-products`, `neo-support`; preservar objetos originais e permissões.
**Produção tem dados reais** e não deve ser semeada com fixtures sintéticas do staging.

**Edge Functions em STAGING:** `ai-reply`, `push-dispatch`, `agent-integrations`, `platform-integrations`, `connect-update`, `connect-release-draft`. As quatro primeiras têm `verify_jwt=true`; `connect-release-draft` usa `verify_jwt=false` mas valida credenciais no handler. Revisar CORS/autorização.
**Edge Functions em PRODUÇÃO:** `auth-settings`, `delete-account`, `mercadopago-webhook`, `push-dispatch`, `ai-reply`, `shop-integrations`, `platform-integrations`, `mercadopago-create`, `agent-integrations`. Versões das quatro funções em comum e `verify_jwt` diferem; **PRESERVAR as funções exclusivas de produção** e seus contratos/credenciais. Planejar reconciliação por função, sem downgrade e sem mudar `verify_jwt` inadvertidamente; testar gateway + validação interna. Conectar `connect-update`/`connect-release-draft` só depois da configuração de canal de produção, assinador autorizado, Storage e testes; NÃO usar chave privada de Teste.

**Segurança Advisor:** no momento produção registra `rls_enabled_no_policy` nas 45 tabelas privadas (RLS fechada, frequentemente intencional), aviso `authenticated_security_definer_function_executable` para 41 funções e aviso de proteção de senhas vazadas desativada. Staging tem o mesmo tipo de avisos em maior volume. Revisar cada privilégio efetivo e plano de remediação, sem apagar grants legítimos ou criar política permissiva. Referências:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
