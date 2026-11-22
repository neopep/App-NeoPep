# Dependências e privilégios — 56 funções presentes somente em Homologação

**Consulta autenticada de catálogo:** 22/11/2026. Teste `qnuluspqfazdppciermw` e Produção `cpslafpzjtbpmoxxysaa`, somente SELECT. Relacionado à [matriz de assinaturas e hashes](MATRIZ-FUNCOES-56-124-20261122.md). Nenhum dado individual ou segredo extraído.

Foram verificadas **56 assinaturas**, com **41 funções `SECURITY DEFINER`** e **26 permissões efetivas de EXECUTE para `anon` ou `authenticated` no banco de Teste**. Essas permissões não devem ser importadas automaticamente. O manifesto de migrações da candidata exige isolamento e bloqueio de novas ativações.

**Interpretação das colunas:** dependências estáticas vêm de `pg_depend` (tipos/objetos), chamadas são **ocorrências textuais aproximadas** do nome em outras funções (podem conter falsos positivos e omitir SQL dinâmico), e gatilhos são apontamentos diretos no catálogo. A ausência de dependência **não prova independência**.

| Assinatura de Teste | SECURITY DEFINER | EXECUTE anon/auth/service no Teste | Dependências estáticas | Possíveis funções chamadoras | Gatilhos diretos |
|---|---|---|---|---|---|
| `neo_private.agent_runtime_hours(a neo_private.agents)` | não | não / não / não | `neo_private.agents` | `neo_private.enqueue_ai`, `public.neo_ai_claim`, `public.neo_ai_finish` | — |
| `neo_private.agent_runtime_job_valid(j neo_private.ai_jobs, t neo_private.support_threads)` | não | não / não / não | `neo_private.ai_jobs`, `neo_private.support_threads` | `public.neo_ai_finish`, `public.neo_support` | — |
| `neo_private.agent_runtime_knowledge(p_agent uuid)` | não | não / não / não | Não registrada | `neo_private.agent_runtime_job_valid`, `public.neo_ai_claim`, `public.neo_ai_finish`, `public.neo_multiagent_test`, `public.neo_support` | — |
| `neo_private.agent_runtime_mode(t neo_private.support_threads, a neo_private.agents)` | não | não / não / não | `neo_private.agents`, `neo_private.support_threads` | `neo_private.agent_runtime_job_valid`, `neo_private.enqueue_ai`, `public.neo_ai_claim`, `public.neo_support` | — |
| `neo_private.agent_runtime_model_valid(a neo_private.agents, i neo_private.ai_integrations)` | não | não / não / não | `neo_private.agents`, `neo_private.ai_integrations` | `neo_private.agent_runtime_job_valid`, `public.neo_ai_claim`, `public.neo_support` | — |
| `neo_private.agent_runtime_prompt(a neo_private.agents, knowledge text)` | não | não / não / não | `neo_private.agents` | `public.neo_ai_claim`, `public.neo_multiagent_test` | — |
| `neo_private.agent_runtime_reserve(a neo_private.agents)` | não | não / não / não | `neo_private.agents` | `public.neo_ai_claim`, `public.neo_multiagent_test` | — |
| `neo_private.campaign_admin_allowed()` | SIM | não / não / não | Não registrada | `public.neo_campaign_admin`, `public.neo_campaign_image_allowed`, `public.neo_campaign_wa`, `public.neo_connect_admin`, `public.neo_connect_device`, `public.neo_connect_release_allowed`, `public.neo_connect_update_admin` | — |
| `neo_private.campaign_destination(p_kind text, p_id uuid)` | não | não / não / não | Não registrada | `neo_private.campaign_matches`, `public.neo_campaign_admin`, `public.neo_campaign_visit`, `public.neo_campaign_wa` | — |
| `neo_private.campaign_display_state(c neo_private.campaigns, t timestamp with time zone)` | não | não / não / não | `neo_private.campaigns` | `neo_private.connect_candidates`, `public.neo_campaign_admin` | — |
| `neo_private.campaign_matches(c neo_private.campaigns, p_account uuid, p_now timestamp with time zone)` | não | não / não / não | `neo_private.campaigns` | `public.neo_campaign_push_claim`, `public.neo_campaign_visit` | — |
| `neo_private.campaign_push_on_display()` | não | não / não / não | Não registrada | Não identificados | — |
| `neo_private.campaign_wall_time(p_value text, p_timezone text)` | não | não / não / não | Não registrada | `public.neo_campaign_admin`, `public.neo_campaign_wa` | — |
| `neo_private.clear_operations_quality()` | SIM | não / não / não | Não registrada | Não identificados | `neo_private.audience_observations.neo_clear_quality_on_revocation` |
| `neo_private.connect_candidates(t neo_private.connect_tasks)` | não | não / não / não | `neo_private.connect_tasks` | `public.neo_connect_device` | — |
| `neo_private.connect_mark_uncertain()` | não | não / não / não | Não registrada | `public.neo_connect_admin`, `public.neo_connect_device` | — |
| `neo_private.connect_wa_assert_device(p_device uuid, p_secret text)` | não | não / não / não | Não registrada | `public.neo_connect_wa_replace_selection`, `public.neo_connect_wa_set_status` | — |
| `neo_private.record_operations_audit()` | SIM | não / não / não | Não registrada | Não identificados | `neo_private.admin_members.neo_operations_audit`, `neo_private.agent_settings.neo_operations_audit`, `neo_private.agents.neo_operations_audit`, `neo_private.ai_integrations.neo_operations_audit`, `neo_private.community_settings.neo_operations_audit`, `neo_private.platform_settings.neo_operations_audit`, `neo_private.shop_payment_environments.neo_operations_audit`, `neo_private.shop_products.neo_operations_audit`, `neo_private.shop_promotions.neo_operations_audit`, `neo_private.shop_settings.neo_operations_audit`, `neo_private.system_ai_prices.neo_operations_audit`, `neo_private.system_monitor_limits.neo_operations_audit` |
| `public.neo_admin_audience(p_from date, p_to date, p_users uuid[])` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_engagement(p_from date, p_to date, p_area text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_geo(p_users uuid[])` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_operations(p_section text, p_days integer, p_review jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_signup_export(p_query text, p_new boolean, p_from timestamp with time zone, p_until timestamp with time zone, p_before timestamp with time zone, p_before_id uuid, p_batch timestamp with time zone)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_signups(p_action text, p_query text, p_new boolean, p_from timestamp with time zone, p_until timestamp with time zone, p_before timestamp with time zone, p_before_id uuid, p_batch timestamp with time zone)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_admin_system(p_action text, p_payload jsonb)` | SIM | não / SIM / SIM | Não registrada | Não identificados | — |
| `public.neo_ai_claim_before_multiagent(p_actor uuid, p_message uuid)` | SIM | não / não / não | Não registrada | `public.neo_ai_claim` | — |
| `public.neo_ai_finish_before_multiagent(p_job uuid, p_lease uuid, p_body text, p_handoff boolean, p_failed boolean)` | SIM | não / não / não | Não registrada | `public.neo_ai_finish` | — |
| `public.neo_audience_self(p_action text, p_device jsonb, p_campaign jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_campaign_admin(p_action text, p_id uuid, p_data jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_campaign_image_allowed(p_path text, p_write boolean)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_campaign_push_claim()` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_campaign_push_finish(p_id uuid, p_outcome text)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_campaign_push_preference(p_enabled boolean)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_campaign_visit(p_action text, p_impression uuid)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_campaign_wa(p_action text, p_id uuid, p_data jsonb)` | SIM | não / SIM / não | Não registrada | `public.neo_connect_device` | — |
| `public.neo_connect_admin(p_action text, p_data jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_device(p_action text, p_device uuid, p_secret text, p_data jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_release_allowed(p_path text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_release_stage(p_action text, p_data jsonb)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_connect_update(p_action text, p_device uuid, p_secret text, p_version text, p_outcome text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_update_admin(p_action text, p_data jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_wa_list_connections()` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_wa_list_groups(p_connection uuid, p_after text, p_limit integer)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_wa_replace_selection(p_device uuid, p_secret text, p_connection uuid, p_expected_revision bigint, p_label text, p_groups jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_connect_wa_set_status(p_device uuid, p_secret text, p_connection uuid, p_status text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_engagement(p_action text, p_events jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_geo_control(p_action text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_geo_observe(p_user uuid, p_country text, p_region text, p_city text)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_multiagent(p_action text, p_payload jsonb)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_multiagent_foundation(p_action text, p_payload jsonb)` | SIM | não / não / não | Não registrada | `public.neo_multiagent` | — |
| `public.neo_multiagent_test(p_actor uuid, p_agent uuid)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_multiagent_tested(p_actor uuid, p_agent uuid, p_agent_revision bigint, p_integration uuid, p_integration_revision bigint, p_model text)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.neo_quality_observe(p_metric text, p_duration integer, p_revision text)` | SIM | não / SIM / não | Não registrada | Não identificados | — |
| `public.neo_support_before_multiagent(p_action text, p_payload jsonb)` | SIM | não / não / não | Não registrada | `public.neo_support` | — |
| `public.neo_system_ai_record(p_call jsonb)` | SIM | não / não / SIM | Não registrada | Não identificados | — |
| `public.rls_auto_enable()` | SIM | não / não / não | Não registrada | Não identificados | — |

## Decisões de segurança

1. Para as 42 assinaturas previstas nos sete lotes, conferir direitos efetivos com as roles oficiais **no clone restaurado**, após aplicação em modo isolado. RLS e `SECURITY DEFINER` são verificações separadas.
2. **Não ativar** as sete funções de runtime de multiagentes, as duas de testes, as quatro renomeadas e `public.rls_auto_enable()` apenas para igualar contagens; usar plano de ativação separado.
3. Investigar gatilhos/cron antes de liberar `campaign_push_on_display`, `connect_mark_uncertain`, `record_operations_audit` e APIs de campanhas, push e Connect. Não aceitar enfileiramento automático nem distribuição Windows de Teste na origem oficial.
4. As funções `SECURITY DEFINER` no schema exposto exigem comprovar autorização por conta, `EXECUTE` mínimo, `search_path` controlado, respostas privadas e testes de cross-account. Manter as ACL exclusivas da Produção.
5. Não inferir chamadas feitas por código Edge/Deno apenas a partir de `pg_depend`: cruzar com `supabase/functions`, `dist/cloud.js` e os contratos públicos antes da liberação.

**Bloqueio:** validação de restore real (banco + Storage) e Orders API sandbox pendentes. Este relatório é read-only e não habilita funcionalidades.
