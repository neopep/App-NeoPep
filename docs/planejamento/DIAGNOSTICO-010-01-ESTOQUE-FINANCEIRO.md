# 010.01 · Diagnóstico técnico de estoque, custos e lucros

Escopo documental. Referência de planejamento na PR #40, em `6e0331d`. Código comparado pelo Git em 24/11/2026, horário de São Paulo.

| Fonte | Referência | Evidência |
|---|---|---|
| Produção no Git | `main @ fc0ae22faf75b108aad137b1399fc8b367af1292` | Código e migrações versionados. |
| Teste no Git | `staging/permanente @ 0970ae6b7c7d846915f98f4582780382c71a80e9` | Código e migrações versionados. |
| Supabase Teste e Produção | `qnuluspqfazdppciermw` e `cpslafpzjtbpmoxxysaa` | O Marco Zero registra `shop_products.stock` e `price_cents` como inteiros nos dois catálogos. Nesta execução os dois destinos retornaram 403 no túnel do proxy. Sem leitura autenticada das definições, grants, histórico, cron ou Edge implantadas. |

No recorte de Loja, `dist/shop.js`, `dist/shop-promotions.js` e `mercadopago-create` são iguais entre os dois SHAs. O Git de Teste contém duas diferenças nesse recorte de migrações e Edge. A migração de retentativa `20261124011242_shop_order_idempotent_retry.sql` está presente somente no Git de Teste. A Edge de webhook de Teste reconhece `status_detail=partially_refunded`; a versão em `main` cai em `pending` nesse caso. São diferenças de código, e a implantação efetiva delas permanece por verificar. A operação normal do webhook foi informada pelo proprietário. Este diagnóstico não é uma reprodução de incidente em Produção.

## Estoque existente

| Pergunta | Comportamento comprovado no código |
|---|---|
| Onde é registrado e editado? | `neo_private.shop_products.stock` é um único saldo disponível inteiro com restrição 0–1.000.000. Loja → Gerenciar → Editar envia `stock` absoluto em `neo_shop('product')`, com autorização administrativa no servidor. |
| O que o cliente vê? | Vitrine e ficha sinalizam disponível/esgotado e desabilitam compra quando o saldo é zero. Gerenciar mostra a quantidade numérica. A cotação volta a validar quantidade, disponibilidade e preço no servidor. |
| Quando ocorre a baixa? | O carrinho guarda intenção. Ao criar um pedido válido, a RPC de base subtrai as quantidades e grava `awaiting_payment` na mesma transação. A reserva fica representada pelo pedido, seus itens, `expires_at` (padrão 30 min) e `stock_released=false`. Aprovar normalmente conserva a reserva, sem subtrair uma segunda vez. |
| O que acontece na expiração? | `neo_private.shop_expire()` restaura quantidades de pedidos vencidos em `awaiting_payment` ou `pending` e marca `expired` e `stock_released=true`. O código chama a expiração em operações da Loja. Uma execução por cron instalada não foi confirmada. |
| Cancelamento, rejeição e estorno | Rejeição/cancelamento de pagamento e aprovação de cancelamento de pendente liberam uma única vez. Cancelamento administrativo de pago encaminha para `paid_review` e conserva o saldo. Reembolso integral em `processing` pode liberar a reserva se ainda não liberada. Motivos de conferência, reembolso parcial e chargeback seguem suas transições sem reposição automática geral. Pós-expedição exige verificar retorno físico. |
| Aprovação após liberação | Em ambiente de pagamento `production`, a função tenta reservar novamente sob a trava da Loja. Com saldo insuficiente marca `paid_review`. Em ambiente de pagamento `test`, aprovação marca `test_paid` e libera a reserva. Ambiente do pedido é um atributo da configuração de pagamento, separado do nome do projeto Supabase. |
| Duas compras simultâneas | A criação de pedido, expiração, eventos de pagamento e editor base obtêm `pg_advisory_xact_lock(642917200)` em seus caminhos principais. A cotação é refeita no caminho de criação, e o CHECK de estoque impede saldo negativo persistido. Dois pedidos regulares concorrem sob essa trava. A abrangência de todos os escritores instalados e um teste em duas sessões ainda estão pendentes. |
| Evento repetido | `shop_payments.payment_id` é chave única, e o evento trava a linha do pedido. Reprocessar a mesma aprovação com reserva mantida não debita novamente. `stock_released` protege reposições repetidas. Uma aprovação de outro ID no mesmo pedido pode provocar `paid_review`; conferir diferenças de identidade, estado e ordenação no sandbox. |
| Ocultos, duplicados, inativos | Visibilidade por membro aplicada à vitrine, detalhe, carrinho e checkout. O gerente acessa o inventário separado. Produto inativo/excluído fica fora da venda regular. A cópia cria ID novo, rascunho e saldo inicial copiado, com listas próprias. Publicar a cópia como se tivesse o mesmo estoque físico do original pode inflar a disponibilidade entre dois IDs. |
| Auditoria e histórico | `operations_audit` tem gatilho genérico administrativo para alterações de produtos e configurações. Registra ator, ação, operação, tabela e data e prevê limpeza de entradas com mais de 180 dias no gatilho. Não carrega antes/delta/depois por SKU nem garante trilha de alterações automáticas. Pedidos preservam itens e status e pagamentos mantêm seu registro conciliável. |

Um ajuste absoluto enviado por um editor com dados antigos pode sobrescrever o saldo correto mesmo quando os escritores se serializam. O mecanismo futuro precisa validar revisão ou saldo esperado. Além disso, a versão administrativa de cancelamento usa trava na linha do pedido e atualizações de saldo, com estratégia diferente da trava global em outros escritores. O plano de homologação deve cobrir a ordem das travas, a concorrência com edição e o comportamento dos limites.

### Objetos e pontos de entrada revisados

- Frontend `dist/shop.js`, `dist/shop-core.js`, `dist/shop-promotions.js` e adaptador `src/cloud.js`. Cards de pedidos **Total**, **Pagos**, **A enviar** e **Enviados** em Gerenciar. São contagens sobre a lista consultada, sujeita ao limite da API, sem natureza de apuração financeira.
- `202611120012_shop.sql`: `shop_products`, `shop_carts`, `shop_orders`, `neo_shop`, `shop_quote` e `shop_expire`. `202611120013_shop_payments.sql`: `shop_payments`, trigger `neo_shop_environment`, claim/link/evento/deletion check. `202611120018_shop_gallery.sql`: galeria, exclusão lógica e compatibilidade com histórico.
- `202611130023_shop_discounts.sql`: promoções, cupom, cotação vinculada e wrappers `neo_shop_payment_claim_v2` e `neo_shop_payment_event_v2`. `202611150027_shop_billing_mercadopago.sql`: dados fiscais de identificação, validação documental e configuração. `202611150029_shop_order_operations.sql`, `202611150030_shop_payment_retry.sql`, `202611150034_shop_shipping_by_state.sql`, `202611150035_shop_payment_environments.sql` e `202611160036_shop_admin_cancel.sql`: cancelamento, lease/liberação, frete e ambientes.
- `202611160039_library_shop_push.sql` contém o trigger de eventos de status/entrega/rastreio para notificações. `20261121190211_admin_operations.sql` registra a auditoria administrativa genérica. `20261123220000_shop_member_visibility.sql` e `20261123234500_shop_store_admin_visibility.sql` separam visibilidade e inventário. As definições no catálogo remoto e suas permissões permanecem por confirmar.

## Dados financeiros e Mercado Pago

| Dado | Disponível no código | Lacuna |
|---|---|---|
| Valor de venda | Preço em centavos; pedido congela produto, quantidade e preço unitário. `subtotal_cents`, `discount_cents`, `discounts`, cupom, `shipping_cents`, `shipping_state`, `total_cents`. | Alocação auditável de desconto/estorno por linha e base contábil para frete e devoluções. |
| BRL, USD e câmbio | Cobrança e validação em BRL. | Sem custo de aquisição BRL/USD, taxa histórica vinculada à compra ou datas de câmbio no contrato da Loja. |
| Pagamento | ID, status, valor bruto confirmado e associação ao pedido. Há informação de meio de pagamento no contrato, com comparação no wrapper v2. | Sem taxa efetiva do adquirente, valor liquidado, repasse ou valor monetário do reembolso parcial no evento atual. |
| Frete e imposto | Frete cobrado ao comprador, regras por UF e identificação fiscal para faturamento. | Sem frete efetivamente pago pelo lojista, embalagem e imposto imputado. CPF/CNPJ não mede imposto. |
| Receita, CMV, lucro e margens | Aritmética da venda bruta e do preço após descontos é possível para pedidos conhecidos, separando modo e estado. | Sem CMV histórico, estimativa confiável de lucro líquido ou margem para linhas sem custos, taxas ou devoluções. |

O navegador cria pedido e solicita link à Edge. `mercadopago-create` valida sessão, conta vendedora e ambiente, consulta `neo_shop_payment_claim_v2` (fallback compatível), reaproveita link salvo e reserva um lease curto quando precisa criar a Orders API. Envia chave de idempotência do provedor por tentativa e persiste o link no pedido. `neo_shop_payment_release` libera tentativas conforme elegibilidade. O retorno do navegador não prova aprovação. O webhook verifica HMAC, validade temporal e ID, consulta a Orders API, valida recebedor, moeda, ambiente quando fornecido e referência, e entrega à RPC valor, status e meio. A RPC confronta total e ambiente e vincula o pagamento ao pedido sob trava. O ledger da versão instalada e a configuração de destino das notificações ainda precisam de leitura autorizada.

Riscos para verificação posterior, sem alteração nesta subetapa:

1. **Retentativa do mesmo pedido.** Embora exista unicidade por conta e `request_key`, o wrapper de frete legado pode recalcular antes de reaproveitar o pedido e falhar se o carrinho já estiver vazio. O delta de Teste antecipa a recuperação pelo proprietário. Conferir assinatura e corpo instalados, frete, faturamento e promoção antes de propor transporte incremental desse delta.
2. **Criação no provedor com resposta perdida.** O UUID do provedor é novo por tentativa. Se a Orders API criar o pagamento e a resposta ou gravação do link falhar, uma tentativa posterior pode usar outra chave. Confirmar com sandbox e conciliador, incluindo leases e vínculos. Se reproduzido, propor chave persistente por intenção de pagamento e recuperação do vínculo, condicionadas a autorização separada e reconciliação dos vínculos antigos.
3. **Estorno parcial.** O Git da `main` não encaminha o detalhe parcial para a transição já suportada pela RPC. O delta de Teste captura o detalhe e a RPC destina a `paid_review`. Reproduzir com fixture e validar em sandbox; testar precedência de reembolso integral e chargeback, múltiplas transações e replay. Se houver necessidade posterior, propor delta de classificação separado, mantendo assinatura, conferências e contratos. Esta etapa não modifica o webhook.
4. **Saldos duplicados e ajustes com versões antigas.** Medir chance de reaproveitar o mesmo estoque físico em um novo ID. O processo futuro deve exigir confirmação de saldo e motivo, com revisão otimista e tratamento da concorrência.

## Proposta para decisão na 010.02

- Manter `stock` como saldo disponível e o evento atual de reserva. Confirmar venda após pagamento como evento financeiro, com delta de estoque zero se a reserva vigente já representa a baixa. Registrar nova reserva apenas na aprovação tardia elegível. Usar estados explícitos para devolução física e estorno financeiro. Adotar chave de negócio por evento, pedido, linha e produto para que o mesmo pagamento não repita o movimento.
- Recomendar **custo médio ponderado móvel** em BRL para a primeira entrega, com entradas individualizadas por lote e histórico suficiente para avaliar FIFO posteriormente. Na aprovação da política, definir custos incorporáveis, unidades sem custo conhecido, tratamento de devolução e mudança de taxa. Se lote/FIFO for requisito contábil, escolher antes de persistir o CMV.
- Entrada administrativa em BRL ou USD, com quantidade, valor unitário em precisão decimal, data, moeda e identificador do lote. Para USD, referenciar taxa BRL/USD imutável, com data da cotação, fonte, ator e versão. A taxa histórica não é editada em lugar: correções criam nova taxa/ajuste para operações futuras ou procedimento contábil explícito.
- Registrar movimento privado transacional, com antes/delta/depois, origem, pedido/linha/lote, ator ou serviço, motivo, data e chave idempotente. Elaborar instrumentação isolada no banco ou no caminho autorizado que já muda estado. Um gatilho genérico sozinho não distingue a causa de cada delta. Reconciliar cobertura de todos os escritores antes de promover. Usar checagem de revisão e chave idempotente nos ajustes manuais e na futura escrita em massa #011.
- Congelar snapshot por linha de venda com custo unitário, moeda de compra, taxa e versão do critério. Decidir na 010.02 se custo é fixado na reserva e confirmado na venda ou capturado na baixa efetiva do lote. A sequência deve sobreviver à aprovação atrasada sem reutilizar custo indevido. Arredondar apenas na política monetária aprovada, conservando precisão interna e distinguindo zero explícito de desconhecido.
- Ampliar **Gerenciar** com métricas do servidor, filtros por período, produto, categoria, moeda e estado, e cobertura do custo. Receita comercial = bruto − descontos − devoluções comprovadas, com frete discriminado. Lucro bruto estimado = receita comercial − CMV conhecido. Líquido estimado deduz taxas, frete próprio e impostos atribuíveis sem descontar o mesmo valor duas vezes. Margem usa denominador positivo e base consistente. Mostrar indicador indisponível ou parcial se faltarem componentes. Separar vendas reais, test_paid, pendentes e revisão.
- Manter custos, taxas, movimentos e margens em esquema privado. RPCs administrativas com autorização do servidor, princípio de menor privilégio e registros de auditoria. Evitar vazamento por `to_jsonb` do catálogo ou exportação de comprador. Histórico anterior à cobertura fica sem custo, com saldo inicial reconciliado e sem reescrever pedidos.

## Subetapas, aceite e reversão

| Etapa | Entrega futura | Critério de saída |
|---|---|---|
| **010.02** | Confirmar definições e ACL instaladas, cron, hashes das Edge e diferenças no ledger, somente leitura. Decidir reserva, custo médio/FIFO, frete, devolução, câmbio, arredondamento, data de corte e campos obrigatórios. | Política escrita aprovada, com exemplos em BRL/USD e dados incompletos. Nenhuma mudança de webhook implícita. |
| **010.03** | Schema aditivo privado para entradas/câmbio, movimentos e snapshots. Invariantes, bloqueios, idempotência, preflight, perfil autorizado e testes de restauração. | RLS e grants validados, #011 compatível com escrita por revisão, pedidos antigos preservados, trilha sem dupla baixa. |
| **010.04** | Editor administrativo existente com custo opcional e reposição, prévia de cálculo, troca BRL/USD e erros por campo. | Ajuste de inventário auditado, visão pública sem custos e checkout sem mudança de preço/saldo fora do fluxo já aprovado. |
| **010.05** | Cards e filtros de Gerenciar a partir de agregação do servidor, cobertura e conciliação. | BRL/USD consistentes, grupos de estado separados, paginação/total verificáveis, ausência de falsos lucros em histórico incompleto. |
| **010.06** | Homologar fixtures, banco isolado em duas sessões e sandbox autorizado. Ensaio de backup/reversão e revisão final de permissões. | Diferenciar ambiente e modo, sem saldo negativo, sem duplo movimento ou pagamento associado a pedido alheio, aprovar somente com evidências. |

Plano de testes a executar após autorização: compras concorrentes para a última unidade; desconto, frete por UF e retentativa com carrinho esvaziado; pedido cancelado durante lease; perda de resposta do provedor; eventos repetidos e fora de ordem; pagamento tardio com/sem saldo; estorno parcial/integral em processamento e pós-expedição; chargeback; item oculto, inativo, duplicado e administrador revogado; ajuste concorrente #011; histórico sem custo, custo zero e custo USD sob mudança de taxa; ACL de catálogo, relatórios e exportações. Cotejar contagens, totais e invariantes em cada caso, com dados sintéticos.

Reversão futura: registrar hashes, privilégios, versões e contagens de referência, restaurar backup em projeto isolado e documentar evidência. Publicar primeiro em Teste com escrita nova controlável. Em regressão, desabilitar a escrita nova e restaurar o frontend anterior, preservando pedidos, movimentos e snapshots. Conciliar movimentações posteriores ao ponto de corte antes de qualquer correção de saldo. Evitar script destrutivo de reversão; saldo corrigido por movimento compensatório aprovado e idempotente. Manter intactos webhook, credenciais e integrações oficiais.

### Status

010.01 documentada com verificação estática dirigida e limitação de acesso aos catálogos atuais. Nenhum pedido, teste de pagamento, migração, deploy ou merge executado. As PRs #41–#48 permanecem independentes. 010.02–010.06 aguardam autorização.

[Especificação Loja](ESPECIFICACAO-LOJA-010-011.md) · [Marco Zero](MARCO-ZERO-2026-11-24.md)
