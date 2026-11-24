# Plano operacional de implementação — #010.05 Dashboard financeiro da Loja
Versão 1.0 · 24/11/2026 · **Não iniciado** · referência: PR #40, especificação Loja #010–#011, aceite expresso da 010.04.

## Situação inicial verificável
- Base do código de Teste: `staging/permanente@0970ae6` no Marco Zero; confirmar o SHA real imediatamente antes de começar. Não incorporar PRs de outros ajustes automaticamente.
- `dist/shop.js` possui `orderStats()`, `orderDashboard()` e `filteredOrders()` e exibe contagens e cartão "Total confirmado" obtidos da lista local de pedidos. O histórico carregado pode estar paginado/limitado; não transformar subtotal da lista em faturamento total.
- Supabase Teste `qnuluspqfazdppciermw`: fundação financeira aplicada (`20261124164148 / shop_cost_foundation`) e contrato do editor aplicado (`20261124170927 / shop_cost_editor`). Essa numeração remota difere do prefixo do arquivo SQL local; não reaplicar por engano.
- Consulta somente leitura de 24/11: `shop_sale_cost_snapshots=0`, `shop_acquisitions=0`. **Sem custo registrado/snapshot não há lucro confiável.**
- PR [#51](https://github.com/neopep/App-NeoPep/pull/51) continua como alteração isolada; #010.04 foi aprovada pelo proprietário, mas ainda requer homologação com sessões reais e publicação independente. O novo dashboard depende do modelo/contrato de custos, não deve assumir que o frontend 010.04 está instalado.
- Checkout, reservas, webhook Mercado Pago e pedidos da Loja estão protegidos: não modificar.

## Escopo de #010.05
1. **Diagnosticar antes de construir:** funções de pedido, item, status, desconto, taxas, frete, snapshots e a API/filtragem atuais; distinguir tabelas presentes do que já é efetivamente preenchido e documentar lacunas.
2. **Ampliar Gerenciar existente**, sem novo painel paralelo. Blocos: receita bruta de vendas reais; descontos/devoluções; receita comercial estimada; frete cobrado discriminado; unidades vendidas; CMV com cobertura; lucro bruto estimado e margem; estoque e alertas; custos/taxas/frete próprio/impostos quando houver fonte confirmada. Manter cartões atuais de pedidos.
3. **Apuração backend segura:** agregações limitadas ao administrador financeiro efetivo (`neo_private.admin_members`), nunca apenas `neo_admin_access()` quando ela incluir moderadores; checagem server-side em toda RPC; objetos privados e grants mínimos; tratar `SECURITY DEFINER` e RLS com testes negativos.
4. **Filtros:** período com fuso claro, produto, categoria, status, modo pagamento (test/production), estágio de atendimento; paginação para detalhes e totais calculados no servidor, não na lista parcial de pedidos.
5. **Matemática:** BRL centavos/NUMERIC com política de arredondamento consistente; `CMV = Σ custo_snapshot_unitário × quantidade elegível`. Se snapshots ausentes/incompletos, custo **desconhecido** e lucro/margem indisponíveis ou parciais, com cobertura %. Custo explicitamente 0 distingue-se de ausente. Não calcular lucro líquido sem taxas, frete próprio, impostos e devoluções adequadamente identificados.
6. **Venda elegível:** separar `paid`, `paid_review`, `test_paid`, pendente, cancelado, reembolso parcial/total, chargeback; não misturar receita de sandbox, operações em análise ou devoluções indevidas.
7. **UX:** cards responsivos com valores formatados em pt-BR, skeleton, erro, estado vazio, atalhos para pedidos/estoque, acessibilidade, tema claro/escuro existente; não copiar mudanças da PR #44 sem autorização.
8. **Integração #010.06:** se snapshots ainda não estão ativos, expor "CMV indisponível" e registrar explicitamente dependência para capturá-los no fluxo aprovado, sem implementar gatilhos de webhook por conta própria.

## Plano por microetapas
- **010.05.1 — Inventário dirigido:** mapa de contratos/tabelas/consultas, contagem de cobertura, regras de estados e brechas. Entrega: matriz fonte → métrica com exemplos e status demonstrável.
- **010.05.2 — Contrato de leitura administrativa:** RPC/view segura, prévia com dados sintéticos e auditoria de grants, sem conceder dados financeiros a moderadores ou usuários comuns.
- **010.05.3 — Componentes no Gerenciar:** reaproveitar `orderDashboard` e cards atuais, mantendo filtros, pedidos e estoque; evitar segunda consulta por cada card sem cache apropriado.
- **010.05.4 — Testes:** preços/descontos, estornos, pedidos testados, custo ausente, custo zero, câmbio histórico, paginação, dados grandes, responsividade, falta de permissão e duas sessões.
- **010.05.5 — Homologação/Teste:** migrações somente no Supabase Teste quando explicitamente autorizadas, ensaiar SQL e reversão, registrar versão remota, sessão admin/moderador, alias Vercel e evidências. Nenhum dado financeiro sintético deve adulterar saldos/pedidos existentes. Aceite do proprietário e publicação separados.

## Critérios de não regressão
- Não alterar funções `mercadopago-create`, `mercadopago-webhook`, criação, reserva, checkout nem cancelamento.
- Não alterar saldos com consultas de dashboard; toda operação financeira de #010.05 deve ser read-only.
- Não expor valores de custo e margem em vitrine pública ou na conta de moderador.
- Não implantar código que pressupõe RPC ainda ausente; feature flag/fallback seguro quando necessário.
- Não juntar PRs #41–#50 inadvertidamente; documentar dependência específica da PR #51.
- Atualizar `CONTROLE-DE-EXECUCAO.md`, `QUADRO-DE-PRIORIDADES.md` e este plano a cada microetapa com commit, ambiente, testes, aceite e fila de publicação.

## Entrega solicitada ao Codex
Executar `010.05.1` primeiro, com inventário e contrato proposto **sem mudar dados nem migrações remotas**. Depois implementar em branch isolada o menor conjunto seguro de `010.05.2–010.05.4` quando compatível; não registrar homologação real por simulação. PR draft em Teste; sem merge ou publicação de Produção. Parar e documentar bloqueio se depender de snapshots de #010.06 não implementados.
