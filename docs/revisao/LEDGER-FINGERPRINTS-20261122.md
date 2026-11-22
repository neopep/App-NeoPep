# Reconciliação do histórico de migrações — comparação autenticada

**Data:** 22/11/2026. **Escopo:** read-only, comparando `list_migrations` Supabase com arquivos Git no commit `d0c161d` da candidata. **Não reparar nem importar o ledger automaticamente.**

## Resumo

- Produção `cpslafpzjtbpmoxxysaa`: **0 migrações registradas** na lista consultada, apesar de já existir um schema com 45 tabelas privadas e funções oficiais.
- Teste `qnuluspqfazdppciermw`: **16 versões** presentes no ledger.
- **4 versões do Teste sem arquivo de mesmo identificador no Git.** Uma alternativa pelo nome não comprova equivalência semântica ou hash.
- No Git há fontes de multiagentes `202611200001` e `202611200002`, sem registro correspondente no ledger da homologação. Também existem SQLs de preparação financeira posteriores (não executados na produção).
- Os sete lotes `release/production/batches` **não** gravam no ledger. Seus IDs e hash de SQL de entrada precisam de registro auditável separado, aprovado após ensaio de restauração.

## Versões registradas no Teste

| Version | Nome reportado | Fonte no repositório/pendência | Resolução |
|---|---|---|---|
| `20261121170551` | `admin_signup_notices` | `supabase/migrations/20261121170551_admin_signup_notices.sql` | Arquivo versionado com mesmo número |
| `20261121181510` | `admin_audience` | `supabase/migrations/20261121181510_admin_audience.sql` | Arquivo versionado com mesmo número |
| `20261121183535` | `product_engagement` | `supabase/migrations/20261121183535_product_engagement.sql` | Arquivo versionado com mesmo número |
| `20261121184939` | `admin_system_monitor` | `supabase/migrations/20261121184939_admin_system_monitor.sql` | Arquivo versionado com mesmo número |
| `20261121190211` | `admin_operations` | `supabase/migrations/20261121190211_admin_operations.sql` | Arquivo versionado com mesmo número |
| `20261121192900` | `staging_audit_hardening` | `supabase/migrations/20261121192900_staging_audit_hardening.sql` | Arquivo versionado com mesmo número |
| `20261121195231` | `admin_campaigns` | `supabase/migrations/20261121195231_admin_campaigns.sql` | Arquivo versionado com mesmo número |
| `20261121195245` | `campaign_push` | `supabase/migrations/20261121195245_campaign_push.sql` | Arquivo versionado com mesmo número |
| `20261121200721` | `campaign_editor_completion` | `supabase/migrations/20261121200721_campaign_editor_completion.sql` | Arquivo versionado com mesmo número |
| `20261121231451` | `campaign_whatsapp` | `supabase/migrations/20261121231451_campaign_whatsapp.sql` | Arquivo versionado com mesmo número |
| `20261121233733` | `neopep_connect` | `supabase/migrations/20261121233733_neopep_connect.sql` | Arquivo versionado com mesmo número |
| `20261122003342` | `neopep_connect_pause_where` | `supabase/migrations/20261122003342_neopep_connect_pause_where.sql` | Arquivo versionado com mesmo número |
| `20261122022149` | `neopep_connect_updates` | tests/fixtures/connect/update-channel.sql (equivalência a provar) | SEM arquivo com mesmo número |
| `20261122040259` | `neopep_connect_release_admin` | verificar definição remota e migrations Connect; sem correspondência 1:1 | SEM arquivo com mesmo número |
| `20261122044929` | `neopep_connect_whatsapp_groups` | tests/fixtures/connect/whatsapp-grupos.sql (equivalência a provar) | SEM arquivo com mesmo número |
| `20261122151856` | `neopep_connect_release_verified_drafts` | `supabase/migrations/20261122152200_neopep_connect_release_verified_drafts.sql (IDs distintos)` | SEM arquivo com mesmo número |

## Arquivos SQL com versão recente no Git que não estão registrados pelo mesmo ID no ledger do Teste

- `supabase/migrations/202611200001_multiagent_foundation.sql`
- `supabase/migrations/202611200002_multiagent_runtime.sql`
- `supabase/migrations/20261122152200_neopep_connect_release_verified_drafts.sql`
- `supabase/migrations/20261122190100_shop_checkout_retry.sql`

## Método para reconciliar sem dados perdidos

1. Obter catálogo completo com `release/production/catalog.sql`, inclusive `pg_depend`, migrações, cron, `pg_proc`, grants, RLS, constraints, triggers, índices e Storage. Usar conexões read-only separadas.
2. Gerar baseline de **estado real atual** da produção com fingerprints, não apenas nome/número de versão. O projeto oficial tem schema e dados apesar do ledger vazio; **não** rodar migrações de instalação antiga sobre ele.
3. Para cada versão de Teste, conferir objetos esperados, corpo das funções, ownership, SECURITY DEFINER, políticas, triggers, tabelas, dados introduzidos e diferença entre fontes reconstituídas e catálogo remoto. Arquivo com mesmo nome não prova instalação idêntica; quatro versões exigem arqueologia adicional.
4. Associar cada lote SQL aprovado ao catálogo ANTES e DEPOIS no clone autorizado; registrar hashes SHA-256, horários, executor e evidência de recuperação. Preservar esse recibo externo sem inventar versão histórica do Supabase.
5. Apenas quando o esquema oficial, ACL e rollback forem aprovados, definir se/quando reconciliar formalmente o ledger pela ferramenta oficial. Não inserir manualmente linhas do teste nem registrar migrações não executadas como aplicadas.
6. Não modificar `main`, produção, Edge, Auth, cron ou Storage nesta fase.

## Bloqueios

- Origem de `20261122040259` e equivalência exata dos demais SQLs Connect de teste não comprovadas.
- Restaurabilidade de backup e Storage oficiais não demonstrada.
- Integração multiagente das 14 rotinas quarentenadas depende de autorização e testes específicos.
- Homologação Orders API em sandbox, Auth, Edge, Vercel ainda pendentes.

**Status de publicação: NO-GO.**
