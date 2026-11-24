# #010 — Arquitetura financeira aprovada para preparação incremental (continuação 010.02)

Data: 2026-11-24. Proprietário: «Siga pela sugestão e vamos avançar». Status: política-base aceita para preparação; **nenhuma migração nem código implantado**.

## Evidência remota nova (somente leitura)

Projetos Supabase Teste `qnuluspqfazdppciermw` e Produção `cpslafpzjtbpmoxxysaa` acessados. Ambos possuem 13 tabelas relacionadas à Loja em `neo_private`: shop_addresses, shop_carts, shop_orders, shop_payment_environments, shop_payment_integrations, shop_payments, shop_photos, shop_product_copy_requests, shop_product_visibility, shop_product_visibility_members, shop_products, shop_promotions, shop_settings. Há ainda `public.neo_shop_visibility_events`.

Em ambos, `shop_products` inclui `price_cents` e `stock`; `shop_orders` inclui `items` JSONB, `subtotal_cents`, `shipping_cents`, `discount_cents`, `total_cents`, `stock_released`, `status`, `environment`, `request_key`; `shop_payments` inclui `payment_id`, `order_id`, `status`, `amount_cents`. Essas são colunas instaladas, não apenas propostas.

Gatilhos presentes nos dois ambientes: `neo_shop_environment` (BEFORE INSERT em shop_orders), `neo_shop_push_event` (AFTER UPDATE em shop_orders), `neo_operations_audit` (AFTER INSERT/UPDATE/DELETE em shop_products). Igualdade de nomes **não comprova igualdade de corpos ou permissões**.

## Decisões de arquitetura

1. Preservar a reserva de `stock` na criação de pedidos e a liberação existente. Nenhuma segunda baixa no pagamento. Não alterar `neo_shop` nem webhook nesta implementação.
2. Custo médio ponderado **móvel** em centavos BRL, calculado em entradas de aquisição; exigir quantidade positiva e custo informado. Ajustes sem custo explícito não fabricam CMV. Usar precisão decimal interna e arredondar apenas nos pontos definidos. Exemplo: 10 un × R$20 + 5 un × R$26 = 15 un × R$22. A venda de 3 un registra CMV de R$66 no snapshot; saída não altera custo unitário médio.
3. Para aquisição em USD, persistir valor original, moeda, cotação BRL/USD positiva, data/hora, fonte e custo BRL convertido no lançamento; não atualizar registros antigos com câmbio corrente. Validar quem fornece cotação e encargos antes de ativar automação.
4. Modelar entradas, ajustes, reversões e vendas com evento idempotente, produto, referência, ator, saldo antes/depois, timestamps e motivo. Distinguir saldo disponível de estoque físico quando houver reservas; não reconstruir estoque histórico sem prova.
5. Snapshot imutável de custo por item no momento de confirmação da venda, mas com rastreio da reserva para evitar divergência em pagamentos tardios. Antes de implementar, simular aquisição entre reserva e aprovação e decidir o critério contábil definitivo. Pedidos históricos sem custo ficam `unknown`.
6. Relatórios: receita líquida de descontos, custo de mercadoria, taxas efetivamente conhecidas, frete, impostos, lucro bruto e lucro líquido estimado. Nunca mostrar lucro definitivo quando alguma parcela necessária for desconhecida; distinguir ambientes `test` e `production` e pagamentos de teste.
7. Usar schema privado `neo_private` para custos; RPCs com checagem explícita de administrador e privilégios mínimos, revisão de `SECURITY DEFINER` e grants. Nenhuma exposição de custos ao catálogo público. Registrar operações auditáveis.
8. Não duplicar `stock` nem `price_cents`; ampliar editor e dashboard existentes. Ajuste #011 consumirá os mesmos mecanismos de movimentação, não fará UPDATE em massa sem auditoria.

## Gatilhos de validação antes de executar 010.03

- Revisar diferenças das quatro funções financeiras entre Teste e Produção já registradas em `VERIFICACAO-010-02-ESTOQUE-POLITICAS.md`; não sincronizar funções automaticamente.
- Confirmar com análise de código a ordem exata de reserva, aprovação e cancelamento, principalmente casos de estorno parcial, devolução física e duplicação.
- Definir tratamento de saldo inicial de produtos preexistentes, custos desconhecidos, preço de frete e impostos, custo unitário de lotes e arredondamento.
- Preparar migrações **somente em branch isolada** e ensaiar em banco isolado; exigir validação em Teste antes de qualquer Produção. Nenhuma migração remota autorizada por este registro.
- Homologação com concorrência, duplicação de evento, devolução parcial, câmbio, permissão não-admin, consistência de centavos, rollback e relatórios.

## Próximo pacote de execução

010.03-A: elaborar migração versionada aditiva (schema de custos, movimentações e snapshots) e testes locais; sem aplicar remotamente. 010.03-B: homologar migração em Teste após revisão. 010.04: editor de custo. 010.05: dashboard. 010.06: conciliação e QA. Cada entrega exige registro de branch/commit, testes, pendências, aceite e autorização independente de publicação.

Referências: PR #49 (diagnóstico 010.01), documentos `ESPECIFICACAO-LOJA-010-011.md` e `VERIFICACAO-010-02-ESTOQUE-POLITICAS.md`. PRs #41–#49 preservadas.
