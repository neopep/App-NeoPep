# 010.02 — Verificação inicial de ambientes e decisões de política

Data: 2026-11-24. Estado: **EM_ANDAMENTO**. Autorização do proprietário para iniciar 010.02 registrada na conversa. Escopo nesta rodada: consultas somente leitura, sem deploy, migração, webhook ou pedidos reais.

## Verificação remota efetivamente realizada

Projetos identificados via conector Supabase: Teste `qnuluspqfazdppciermw` (neopep-staging, ACTIVE_HEALTHY, PostgreSQL 17.12) e Produção `cpslafpzjtbpmoxxysaa` (neopep, ACTIVE_HEALTHY, PostgreSQL 17.11).

Consulta a `pg_proc` para assinaturas e hashes MD5 de `pg_get_functiondef`:

| Função | Teste | Produção | Resultado |
|---|---|---|---|
| `public.neo_shop(text,jsonb)` | `8c37ba1b5bded7bebf742d015ab84076` | mesmo hash | Definição igual |
| `neo_private.shop_expire()` | `5f1ce62841962a938b87bfa28ec1535b` | `dbc5cf64f893f63676cb61ea70e5f403` | Definições diferentes |
| `public.neo_shop_payment_claim_v2(uuid,uuid)` | `92cc1ec183d4d32880d9d2af23ee6824` | `ebbb15fb6e416bc77f2e513000fff0ed` | Definições diferentes |
| `public.neo_shop_payment_event_v2(uuid,text,text,bigint,text,text)` | `5f60585620f4c0d334f3d4a9cf078074` | `f7bff35c5f41a7ccef99f2c7f61fb18b` | Definições diferentes |
| `public.neo_shop_payment_release(uuid,uuid,boolean)` | `6bfeaaa03ed128c6168c00c711e71524` | `8b0c91297afc296a4753e43d0d99dade` | Definições diferentes |

**Interpretação restrita:** hashes diferentes provam diferenças de definição instalada, não falhas operacionais nem a causa exata. Não executar correções automáticas nem copiar funções entre ambientes. Investigar diffs de corpos, permissões, cron e migrações em etapa de revisão segura.

Uma consulta adicional envolvendo catálogo e cron retornou erro em Teste; a consulta em Produção retornou 0 jobs com comando contendo 'shop'. Isso **não prova ausência de rotinas agendadas por outras nomenclaturas**, nem permite concluir o estado de Teste. Repetir consultas menores e com tratamento de permissões.

## Políticas propostas para decisão explícita (não implementadas)

1. **Estoque:** manter `shop_products.stock` como saldo disponível e a reserva na criação do pedido. Aprovação normal não deve baixar novamente. Movimento idempotente com saldo antes/depois, evento e referência ao pedido. Reposição por cancelamento/estorno depende de estado e retorno físico.
2. **Custo:** propor custo médio ponderado móvel em BRL, entradas por lote e distinção rigorosa entre custo desconhecido e custo zero informado. Validar com cenários antes de adoção.
3. **USD:** guardar valor, moeda, taxa BRL/USD, fonte e data do câmbio usados na entrada; não recalcular custos históricos por câmbio atual.
4. **Snapshots:** congelar custo atribuível a cada item de venda em momento a definir, considerando reserva e aprovação tardia. Não inventar custo para pedidos anteriores.
5. **Lucro:** mostrar margem/lucro como indisponível ou parcial se custo, taxas ou devoluções forem desconhecidos; separar venda real de `test_paid`.
6. **Segurança:** dados financeiros e movimentos privados, autorização administrativa no servidor, revisão concorrente para ajustes manuais, trilha auditável e integração futura com #011.

## Pendências antes de encerrar 010.02

- Conferir corpos e grants das funções instaladas, triggers, extensões/cron, Edge implantadas e migrações efetivas nos dois ambientes, sem escrita.
- Definir com proprietário: custo médio versus FIFO; custo unitário versus lote; despesas incluídas; tratamento de devoluções; data de corte; política de arredondamento; momento do snapshot; fontes e regras de câmbio.
- Documentar exemplos numéricos e testes de consistência; aprovar política antes de iniciar 010.03.
- Preservar PRs #41–#49, webhook Mercado Pago e fluxos financeiros existentes. **Sem merge/deploy/migração.**

Referência: `docs/planejamento/DIAGNOSTICO-010-01-ESTOQUE-FINANCEIRO.md` na PR #49; esta atualização não significa que a PR documental tenha sido mesclada.
