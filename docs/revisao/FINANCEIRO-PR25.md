# Correções financeiras da candidata do PR #25

A versão corrigida foi ensaiada em PGlite e no executor local das Edge Functions com respostas simuladas do Mercado Pago. A verificação em sandbox do provedor e o catálogo remoto não foram executados nesta sessão. A origem oficial permanece sem alterações.

## Contrato e testes

- O webhook preserva verificação HMAC e consulta ao provedor, ID, recebedor, moeda, ambiente e valor. O par processed / partially_refunded descrito na documentação do Orders tem precedência sobre aprovação. São considerados também o estado parcial da transação e valor de estorno positivo quando presente. Reembolso integral e chargeback explícitos mantêm seus estados. A RPC recebe o total original do pedido para sua validação e encaminha o estorno parcial a paid_review.
- A migração 20261122190100 insere a busca antes da cotação no wrapper de frete. Usa a trava transacional da Loja, restringe a recuperação ao usuário da sessão e confere endereço, faturamento armazenado e total sem alterar o pedido. Uma chave nova segue o cálculo e validações atuais. A função e os grants externos permanecem iguais. A migração recusa definição divergente e é reaplicável sobre o fingerprint corrigido.
- A Edge de criação reutiliza o ID do pedido como chave de idempotência do provedor. O ensaio confirma a mesma chave e o mesmo corpo em nova tentativa. Antes de mudar essa versão na origem oficial, reconciliar tentativas antigas sem link persistido, pois foram enviadas com outra chave. Testar também perda de resposta e resposta de repetição no sandbox.
- A suíte local comprovou a reprodução do erro de recotação com rollback da rotina, o replay sobre o pedido existente depois de reaplicar a migração, as negativas de endereço, faturamento, total, chave e usuário, e o estoque preservado. Simulou a assinatura Orders e repetiu o evento parcial no SQL sem duplicar pagamento ou estoque.

## Reconciliação e aplicação futura

1. Obter acesso autenticado de leitura aos dois projetos. Executar catalog.sql e finance-preflight.sql, guardar saídas protegidas e comparar fingerprints, ledger, chave única de usuário e pedido, chave de pagamento e privilégios efetivos. Baseline esperado é baseline_git na rotina de frete. Se o fingerprint divergir, interromper e reconstruir a alteração sobre a definição efetivamente implantada.
2. Verificar a versão ativa das Edge e o verify_jwt de cada uma. Confirmar que a RPC aceita partially_refunded e que pedidos em revisão ficam protegidos contra entrega automática. Para múltiplas transações, validar a identidade do pagamento e cenários de reembolso/chargeback em sandbox. Confirmar valores, assinatura, vendedor, moeda e armazenamento do link nas condições de falha.
3. Comprovar restauração isolada de banco e Storage, capturar RPO/RTO e repetir os fluxos nessa restauração. Após aprovação específica, planejar a migração de frete separadamente do deploy de cada Edge, com validações antes e depois. Preservar configuração, credenciais, cron e políticas oficiais.
4. Em falha pós-aplicação, reconciliar pedidos e pagamentos antes de reverter. O SQL compensatório restaura apenas o corpo anterior e recusa divergências. A reversão de cada Edge usa a versão anterior aprovada. Antes de reverter criação de pagamento, avaliar links pendentes e a mudança de chave de idempotência. Não apagar pedidos, pagamentos nem eventos.

[Estado oficial de Orders](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/status/order-status) · [Comentários do PR #25](https://github.com/neopep/App-NeoPep/pull/25) · [Restauração](../../release/production/RESTORE-REHEARSAL.md)
