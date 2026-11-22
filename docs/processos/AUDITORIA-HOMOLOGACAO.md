# Revisão dos avisos de segurança do staging

Projeto `qnuluspqfazdppciermw` em 20/11/2026. Consultas ao catálogo e ao Advisor em modo somente leitura.

## RLS

As 48 ocorrências são tabelas privadas com RLS habilitada e sem política. Nenhuma concedia SELECT, INSERT, UPDATE ou DELETE a `anon` ou `authenticated`. Nenhum desses papéis tinha USAGE no schema `neo_private`. O acesso do aplicativo passa pelas RPCs e pelos papéis de servidor. Preserve o bloqueio direto. Criação de política só é pertinente quando houver um fluxo direto explicitamente autorizado, com teste de isolamento.

`activity`, `admin_members`, `agent_catalog_knowledge`, `agent_drafts`, `agent_knowledge`, `agent_runtime_attempts`, `agent_settings`, `agents`, `ai_attempts`, `ai_consent_events`, `ai_integrations`, `ai_jobs`, `app_errors`, `community_avatars`, `community_files`, `community_materials`, `community_members`, `community_moderators`, `community_posts`, `community_preferences`, `community_push_jobs`, `community_reports`, `community_settings`, `community_uploads`, `event_push_jobs`, `library_uploads`, `library_visits`, `member_access_controls`, `platform_settings`, `push_devices`, `push_jobs`, `rate_limits`, `shop_addresses`, `shop_carts`, `shop_orders`, `shop_payment_environments`, `shop_payment_integrations`, `shop_payments`, `shop_photos`, `shop_products`, `shop_promotions`, `shop_settings`, `support_attachments`, `support_message_reports`, `support_messages`, `support_push_jobs`, `support_reads`, `support_threads`.

## SECURITY DEFINER

O Advisor emitiu 43 avisos sobre 42 funções distintas. Todas tinham `search_path` fixado no catálogo. `rls_auto_enable()` é a única executável por `anon` e gerou dois avisos. Está vinculada a um gatilho DDL. Revise a remoção dos grants explícitos e implícitos de `PUBLIC`, `anon` e `authenticated` somente após aprovar a mudança e verificar que o gatilho continua operando em uma transação com rollback.

Para as 41 outras RPCs, mantenha os grants exigidos pelo cliente e valide controles internos com usuários fictícios. Teste autorização por ação em RPCs multiplexadas, propriedade e troca de ID nas APIs de mídia, pedidos, arquivos e conversas, isolamento das mutações administrativas e acesso estrito de servidor às filas. O ensaio transacional anterior verificou o catálogo multiagente e os papéis históricos. A análise de catálogo não determina se cada ação das RPCs está corretamente autorizada.

| Função | Tipo | Grant de execução para anon |
| --- | --- | --- |
| `neo_admin_access()` | Verificação de acesso | Não |
| `neo_admin_summary()` | RPC autenticada | Não |
| `neo_agent(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community_activity(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community_avatar(p_path text)` | RPC autenticada | Não |
| `neo_community_avatar_access(p_path text)` | Verificação de acesso | Não |
| `neo_community_chat(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community_enter()` | RPC autenticada | Não |
| `neo_community_file(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community_file_access(p_path text, p_upload boolean)` | Verificação de acesso | Não |
| `neo_community_inbox()` | RPC autenticada | Não |
| `neo_community_inbox_v2()` | RPC autenticada | Não |
| `neo_community_inbox_v3()` | RPC autenticada | Não |
| `neo_community_member()` | RPC autenticada | Não |
| `neo_community_members(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_community_photo_access(p_path text)` | Verificação de acesso | Não |
| `neo_community_photo_upload(p_path text)` | RPC autenticada | Não |
| `neo_community_settings(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_complete_onboarding(p_profile jsonb, p_settings jsonb, p_health boolean, p_terms boolean)` | RPC autenticada | Não |
| `neo_export_account_metadata()` | RPC autenticada | Não |
| `neo_has_consent(p_purpose text)` | RPC autenticada | Não |
| `neo_heartbeat()` | RPC autenticada | Não |
| `neo_is_moderator()` | Verificação de acesso | Não |
| `neo_library(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_library_media_access(p_path text, p_upload boolean)` | Verificação de acesso | Não |
| `neo_migrate_records(p_rows jsonb, p_migration_id text)` | RPC autenticada | Não |
| `neo_multiagent(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_platform(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_push_device(p_action text, p_subscription jsonb, p_timezone text)` | RPC autenticada | Não |
| `neo_report_error(p_code text)` | RPC autenticada | Não |
| `neo_set_consent(p_purpose text, p_granted boolean)` | RPC autenticada | Não |
| `neo_shop(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_shop_address(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_shop_export()` | RPC autenticada | Não |
| `neo_shop_photo(p_path text, p_upload boolean)` | RPC autenticada | Não |
| `neo_support(p_action text, p_payload jsonb)` | RPC autenticada | Não |
| `neo_support_access(p_thread uuid)` | Verificação de acesso | Não |
| `neo_support_attachment_access(p_path text, p_upload boolean)` | Verificação de acesso | Não |
| `neo_support_attachment_unused(p_path text)` | RPC autenticada | Não |
| `neo_support_export()` | RPC autenticada | Não |
| `rls_auto_enable()` | Gatilho DDL | Sim |
