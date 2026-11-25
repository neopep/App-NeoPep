# Etapa 014 no Supabase Teste

A migração dirigida exige o projeto `qnuluspqfazdppciermw` e as dependências de editor, despacho, allowlist e mídia rica instaladas. A Central registra o agrupamento sobre `neo_private.campaigns` com canal de revisão. Cada publicação referencia um `editor_id` estável. As revisões, o contrato de mídia e os lotes continuam nas tabelas já usadas pelo Connect. O vínculo editorial é independente da linha de revisão que o RPC legado usa internamente.

A migração adota as revisões estruturadas WhatsApp pelo ID canônico e mantém campanhas manuais no fluxo anterior. As três novas tabelas usam RLS e acesso indireto por RPC. A RPC confere administrador, a conta proprietária e o emissor de Teste. Os gatilhos serializam revisão e despacho para publicações vinculadas, inclusive sob chamadas de clientes antigos. A solicitação existente de publicação rica ainda confere a allowlist, dispositivo, sessão, blocos e autorizações de envio. A Etapa 014 não altera pausas, flags, integração Windows ou filas existentes.

## Aplicação controlada

1. Obter contagens de campanhas manuais, estruturas de revisão, lotes e mensagens somente no projeto de Teste. Executar `preflight.sql` no mesmo projeto. Conferir o SHA-256 da migração, ausência da versão no ledger e CI verde do SHA web.
2. Aplicar `20261125143000_campaign_central.sql` uma vez, no Supabase de Teste. A transação falha inteira se não conseguir obter as travas. Registrar a versão efetiva no ledger.
3. Executar `postflight.sql` e confirmar que as contagens antigas não mudaram. Verificar a adoção no mesmo ID e os grants. Publicar a revisão web no projeto `app-neopep-staging`.
4. A regressão de envio roda em banco isolado com dados artificiais. A homologação manual pode criar rascunhos e consultar histórico em Teste. Agendamento e publicação real exigem confirmação explícita do operador para o destino já autorizado.

## Reversão

Restaurar o deployment web anterior de Teste e executar `rollback.sql` para retirar o acesso ao novo contrato. Manter tabelas, vínculos, auditoria, travas e recibos. Conferir pendências pelo contrato existente e cancelar somente o que ainda aguarda execução. O rollback preserva resultados já processados, que não podem ser desfeitos. Reativar depois com `grant execute on function public.neo_campaign_central_v1(text,jsonb) to authenticated` após nova revisão.

## Evidências e limites

O ensaio PostgreSQL cria um agrupamento vazio, adota uma revisão anterior, rejeita acesso de outra conta, salva e duplica em datas independentes, valida confirmação, bloqueia envio quando offline, simula três agendamentos distintos e confirma idempotência e preservação de aceite no cancelamento. O navegador com RPCs simuladas exercita criação, editor, salvamento, reabertura e duplicação em desktop, iPhone 13 e Pixel 7. O histórico da Central acompanha os estados e recibos expostos pelo Connect, sem inferir entrega. O filtro de Agenda usa uma lista cronológica por data de São Paulo. Safari físico, PWA instalada e sessão real do Connect continuam pendentes de homologação.
