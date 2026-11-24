# Plano de execução final — NeoPep #010.06 · Estoque e conciliação financeira
Data: 24/11/2026 · Proprietário: «Vamos avançar e finalizar» · **Implementação ainda não iniciada.**

## Fontes obrigatórias e linha de base
- `AGENTS.md`, `docs/planejamento/ESPECIFICACAO-LOJA-010-011.md`, `docs/planejamento/PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO.md` e `MARCO-ZERO`.
- Branch homologada em Teste: `homologacao/loja-010-04-010-05@43e31dfcc703e08192acc93d596c566cfd783260`; [PR #53](https://github.com/neopep/App-NeoPep/pull/53), deploy Vercel de Teste READY `dpl_Fb2oKfv8sFgWUx2945BjmFetetif`. Não modificar estado aprovado das duas etapas sem regressão/aceite.
- Supabase Teste `qnuluspqfazdppciermw`: migrações existentes no ledger `20261124164148/shop_cost_foundation`, `20261124170927/shop_cost_editor`, `20261124172822/shop_financial_dashboard`. **Não reaplicar** por diferença de número local no Git.
- Leitura remota de abertura: 1 produto, estoque 100, 0 pedidos, pagamentos, aquisições, movimentos e snapshots. Testar com fixtures isoladas, não adulterar saldo do produto real nem criar pagamentos reais. Produção `cpslafpzjtbpmoxxysaa` intocada.
- Checkout, `mercadopago-create`, `mercadopago-webhook`, o sistema existente de reserva/cancelamento e os contratos ativos do Mercado Pago são protegidos. Não editar seus arquivos/configurações sem exceção documental separada e autorização explícita.

## Regras financeiras e estoque a formalizar antes de gravar custos
1. **Reserva:** estoque `shop_products.stock` é saldo disponível, debitado na criação do pedido. Aprovação com reserva viva não debita outra vez. A expiração/cancelamento elegível libera conforme o fluxo existente; aprovação tardia pode precisar reservar novamente. Não criar segunda fonte de verdade nem baixar em duplicidade.
2. **Movimentos:** auditar toda variação de estoque com identidade de evento determinística, `before/delta/after`, vínculo produto/pedido/linha, motivo e estado de reserva; garantir que dois caminhos não façam movimentos divergentes. Movimentos novos devem ser idempotentes, serializados, com ordem de travas verificada. Se instrumentação exigir alterar uma função antiga de pedidos/pagamentos, apresentar alternativa via gatilho de instrumentação banco (sem provocar alteração de saldo) e testes de compatibilidade, sem tocar webhook.
3. **Custo médio ponderado móvel (proposta):** custo em BRL de aquisição = `unit_cost_minor × taxa histórica`; custo total / quantidade de unidades com custo conhecido, com registro imutável de mudanças de política, precisão decimal e tratamento de aquisições `cost_only` (não repor estoque) versus `acquisition` (repor). Antes de usar custo médio para CMV, definir saldo inicial com custo desconhecido, devoluções, estoque zero, ajuste de inventário e unidades sem custo — se não houver cobertura, snapshot com custo NULL e dashboard indica não disponível, não zero.
4. **Snapshot por linha paga:** para pedido real, capturar exatamente uma vez por `(order_id,line_position)` com `policy_version`, custo unitário BRL ou NULL, `reservation_movement_id` quando existir; preservar histórico após mudanças de aquisição/câmbio. Não retrocalcular pedidos antigos sem base documental. A trigger fundacional só aceita `paid`, `environment='production'`, `stock_released=false`; respeitá-la. **A data da captura e a ordem reserva→pagamento precisam de política explícita**; não fabricar custo da data de venda.
5. **Reconciliação:** registrar e diferenciar pedido criado, reservado, pendente, pago, em revisão, cancelado, expirado, reembolsado parcial/integral, chargeback, enviado e entregue; data de pedido versus evento do provedor versus liquidação. Reembolso financeiro não implica reposição física. Valores de taxas, impostos, embalagem e frete próprio desconhecidos => lucro líquido indisponível; nunca deduzir uma despesa duas vezes. Frete cobrado ao comprador não é custo do frete pago pela Loja.
6. **Diferenciação:** `test_paid` não conta em receita real/CMV; `paid_review`, partial refund e chargeback não entram automaticamente em receita final. Dados desconhecidos devem mostrar cobertura e avisos transparentes; evitar total histórico enganoso.
7. **Segurança:** contratos financeiros somente admin real `neo_private.admin_members`; `public.neo_admin_access()` é muito amplo para moderadores. `SECURITY DEFINER` em public exige guarda `auth.uid()`, search_path fixo, revoke/grant mínimos, RLS/ACL e testes de negativas.

## Etapas de implementação — execução integral, com gates
### 010.06.1 Inventário e decisões
Comparar funções/RPCs SQL e definições instaladas no Supabase Teste. Gerar matriz de transições e eventos de estoque/custo, verificar lock order, triggers, idempotência, cobertura dos snapshots e modelos de taxa. Documentar decisões com exemplos BRL/USD, custo conhecido/zero/desconhecido e reembolso parcial.

### 010.06.2 SQL aditivo privado e captura
Desenvolver migração(s) incremental(is) e scripts de preflight/rollback dirigidos para histórico imutável de custo médio, movimentos e snapshot idempotente, ligados aos contratos já aplicados; nenhuma alteração destrutiva de pedidos/custos anteriores. Evitar nova RPC pública desnecessária. Não criar segundo estoque. Se atualização de `neo_shop` for indispensável, demonstrar que mantém contratos, teste regressivo e preservar código de pagamento. Manter scripts no Git sem aplicar remotamente ainda.

### 010.06.3 Conciliação/dash
Contratos de leitura para auditoria por período/produto/pedido com cobertura, divergências, eventos financeiros e tratamento de despesas conhecidas; integrar ao Gerenciar existente sem duplicar o dashboard nem mostrar lucro líquido quando incompleto. Cuidado com `shop_financial_dashboard_v1`: modificar só mediante novo contrato compatível/versionado, sem quebrar versões já instaladas.

### 010.06.4 Testes automatizados
PostgreSQL 17 isolado, transações concorrentes, 2 compras disputando última unidade, criação de pedido/repetição de pagamento, reserva→expiração→pagamento tardio, duplicação do webhook por RPC/evento simulado, aprovação com idempotência, reembolso parcial/integral, chargeback, devolução física opcional e double-release, mudança de câmbio, custo desconhecido, valor zero explícito, ajuste manual com revisão obsoleta, sessão admin/moderador/membro, restore/reversal e rollback não destrutivo. Build, npm check, suite Loja/PWA, Chromium desktop/iPhone emulado. Não executar pagamento real e não alterar dados de produto existente.

### 010.06.5 Preparação Teste e QA
Integrar sobre branch `homologacao/loja-010-04-010-05` conservando editor+dashboard. Documentar exatamente migrations SQL novas, hashes, ordem, dependências de ledger; verificar Supabase Teste; aplicar DDL **somente com autorização explícita**, executar QA em Teste com dados controlados e log de reconciliação. Publicar frontend apenas no Vercel **Teste** `app-neopep-staging` com commit SHA/READY/URL verificáveis. Proteger alias e artefato anterior e produção.

### 010.06.6 Fechamento
Criar PR draft, evidência de testes, checklist 010.01–010.06, blockers, decisão de custo, matriz de divergências, estado de rollback. Registrar três controles distintos: tecnicamente concluído, aceito pelo proprietário e publicado em Produção. **Não marcar #010 terminado nem publicar Produção sem validação e decisão explícitas.**

## Gate para encerramento #010
- Invariantes de saldo e movimentações preservados, sem duplo débito/liberação.
- Snapshot de cada item pago real idempotente, custo médio documentado e histórico imutável.
- Usuário sem permissão não acessa custo/margem/movimentos.
- Dashboard funciona com custos conhecidos e reconhece dados incompletos.
- Checkout/pagamento e webhook Mercado Pago inalterados; regressões passam.
- Nenhuma migração aplicada em Produção sem release específico.
- QA Teste com artefato READY, SHA, UI e sessão real, aceite do proprietário posterior à execução.
- PR/commit/ledger/rollback rastreáveis e registro de publicação correspondente.

## Regra adicional obrigatória — economia de deploys
- O proprietário informou que há **poucos deploys disponíveis na Vercel**. Consulte [POLITICA-ECONOMIA-DEPLOYS.md](POLITICA-ECONOMIA-DEPLOYS.md) antes de preparar ou executar qualquer publicação.
- Na etapa #010.06, **não realizar deploy automático** a cada commit/erro. Testar localmente todos os componentes, corrigir em lote e fazer build final idêntico ao de Vercel antes de solicitar um único deploy controlado de Teste.
- Quando a implantação exigir alteração de branch que ativa builds automaticamente, ajustar o bloqueio/ignorar builds primeiro e comprovar. Não criar previews de PR desnecessários nem redeploys idênticos.
- Não prometer limite mensal, quantidade restante ou custo sem verificar informações específicas no painel Vercel.
## Execução registrada em 24/11/2026

| Subetapa | Estado |
|---|---|
| 010.06.1 | Inventário e média móvel documentados |
| 010.06.2 | Instrumentação e snapshots implementados e validados localmente |
| 010.06.3 | Auditoria, despesas comprovadas e devolução física integradas localmente |
| 010.06.4 | Build/check, 33 testes Loja/PWA, PostgreSQL 17 concorrente e emulações aprovados |
| 010.06.5 | Autorização para aplicação em Teste, QA real e confirmação do deploy pendentes |
| 010.06.6 | Candidata versionada. Divergência legada de reembolso, aceite e publicação pendentes |

[Evidências, dependências e fronteira de reversão](https://github.com/neopep/App-NeoPep/blob/5a534891be186dc6e54c643e1b09d4347964a1bd/docs/planejamento/EXEC-2026-11-24-010-06.md).
