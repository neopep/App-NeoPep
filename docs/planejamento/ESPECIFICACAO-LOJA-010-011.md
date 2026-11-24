# Especificação detalhada — Loja #010 e #011
Versão 2.0 | 24/11/2026 | Estado: PLANEJADO; nenhuma alteração financeira autorizada nesta etapa.

## Princípio essencial: evolução, nunca substituição
A Loja já possui produtos (neo_private.shop_products), preços em centavos (price_cents), campo de quantidade (stock), edição por produto, pedidos e cartões de resumo. O código frontend principal é dist/shop.js. Também existem funções Mercado Pago (mercadopago-create e mercadopago-webhook), visibilidade por membro, produtos duplicáveis e galeria. Em 24/11/2026, a existência de shop_products.stock e price_cents foi confirmada por consulta somente leitura ao catálogo de Teste e Produção. Isso não confirma o fluxo operacional de baixa do estoque. Não criar segundo campo de estoque nem novo checkout.

## #010-A — Inventário da lógica atual antes de programar
1. Mapear RPCs reais de neo_shop/neo_shop_v36, tabelas de pedidos e itens, triggers de reserva/pagamento, funções Edge, eventos de webhook, idempotência e regras de status. Comparar os objetos instalados de Teste e Produção — fontes Git isoladas não bastam.
2. Identificar exatamente em qual transição o estoque é debitado hoje: ao carrinho, ao pedido, ao pagamento aprovado, ou outra. Marcar como desconhecido até existir evidência.
3. Reconstruir o ciclo pedido criado → pagamento pendente → aprovado → expedido → entregue, incluindo pagamento em análise, cancelamento, falha, retorno parcial, chargeback, retentativas e webhook repetido.
4. Verificar bloqueio de oversell com duas compras concorrentes, itens duplicados, quantidade insuficiente, estoque de produto inativo/oculto e reabertura de pedido.
5. Auditar se o dashboard existente inclui cartões de Total, Pagos, Processamento, Enviados etc.; complementar, sem duplicar.
6. **Proteção específica:** o webhook Mercado Pago da Loja foi relatado funcional pelo proprietário; não modificar seu código/configuração no escopo documental. Se um defeito de estoque exigir mudança, apresentar alternativa incremental/isolada com evidência e autorização separada.

## #010-B — Modelo financeiro e custo de aquisição
### Campos propostos no editor, sem duplicar existentes
- Custo de aquisição opcional: valor monetário positivo ou zero explicitamente informado, moeda BRL ou USD, data de aquisição.
- Câmbio informado manualmente ou capturado de fonte autorizada, com valor, data, origem e possibilidade de editar; NÃO aplicar taxa atual retroativamente aos pedidos antigos.
- Custos opcionais de embalagem, frete próprio, taxas da plataforma, impostos e outros custos atribuíveis; explicitar se valor é por unidade, compra/lote ou pedido.
- Estoque por produto permanece o stock atual. Se houver compras em lotes com custos diferentes, decidir política de custo (médio ponderado/FIFO por lote) ANTES de persistir custo de venda; não introduzir política implícita.
- Produto sem custo: custo desconhecido; lucro/margem não calculáveis. Custo zero explícito é diferente de custo não informado.

### Fórmulas e unidades
- Receita bruta vendida = soma(preço da linha × unidades), antes de descontos.
- Receita líquida comercial = receita bruta − descontos − devoluções (discriminar se frete cobrado do comprador entra na receita conforme política contábil definida).
- CMV = soma(custo unitário registrado no snapshot da linha × quantidade efetivamente vendida); se faltar custo em parte dos itens, apresentar cobertura e lucro parcial/não disponível, não um total enganoso.
- Lucro bruto estimado = receita líquida comercial − CMV. Margem bruta = lucro bruto / receita líquida comercial × 100 quando denominador positivo.
- Lucro líquido estimado = lucro bruto − despesas e taxas atribuíveis; se faltarem dados, rotular como parcial/estimado, nunca como lucro líquido certo.
- Conversão USD→BRL = custo USD × taxa BRL por USD da compra; arredondar somente conforme política monetária em centavos, preservando precisão interna e fonte.
- Cada linha paga deve congelar o custo e a taxa válidos para aquela operação, com versão e data. Mudar custo do produto hoje não altera pedido antigo.

### Dashboard administrativo e filtros
Ampliar área Gerenciar existente com cartões Receita, Quantidades, Estoque, CMV conhecido, Lucro bruto estimado, Margem e alertas de inventário. Filtros por período, produto, categoria, status, moeda e pedidos; séries históricas e exportação opcional. Separar totais pagos de testes aprovados e de pagamentos em análise. Dados de custos e margens exclusivamente administrativos, conferidos no backend.

## #010-C — Movimentações e reconciliação
- Eventos recomendados: reposição, ajuste positivo/negativo, venda paga, reserva (se adotada), liberação, devolução, cancelamento e inventário físico.
- Registrar produto, quantidade anterior, delta, quantidade posterior, motivo/código, pedido ou lote de origem, usuário/serviço, horário de servidor, idempotency key e correlação.
- Atomicidade com bloqueios/transações, quantidade mínima zero salvo política explícita, integridade com itens do pedido e sem duplicidade ao reprocessar webhook.
- Estorno não repõe estoque automaticamente em todos os casos: depende de estado físico do produto, cancelamento e regra comercial; marcar decisão em aberto.
- Reconciliar histórico de vendas anteriores sem inventar custos. Migração de dados antigos em modo compatível; colunas opcionais, sem alterar pedidos já liquidados.
- Testar sequência repetida/fora de ordem de notificações, concorrência, preço alterado após carrinho, item oculto, transação falha, operação parcial e rollback.

## #011 — Gerenciamento em massa de preços e estoque
### Local aprovado
Loja → Gerenciar → Gerenciamento em massa. NÃO criar nova loja, segunda base de produtos ou painel financeiro paralelo.
### Telas
- Abas Preços, Estoque e Ambos.
- Tabela responsiva com miniatura, nome, SKU/ID se houver, categoria, preço atual, estoque atual, status ativo/rascunho/oculto, campo editável e checkbox.
- Busca, filtros, paginação, seleção de página e seleção de resultado inteiro com contagem explícita. Itens não carregados devem ser abrangidos apenas por seleção deliberada/explicada, não acidentalmente.
- Entrada linha a linha e ferramentas para aplicar a um conjunto. Desktop com tabela; celular com cards compactos e campos numéricos apropriados.

### Operações de preço
- Novo preço absoluto em BRL, incremento ou desconto fixo em BRL, incremento ou desconto percentual.
- Atualização proporcional a câmbio: preço_novo = preço_atual × (câmbio_novo / câmbio_antigo), quando ambos válidos e a regra for aprovada.
- Critério de arredondamento selecionável (centavos, múltiplos de 0,10, finais comerciais etc.), demonstrado em prévia.
- Validação de mínimo/máximo, duplicidade de produto e preço nulo; descontos e cupons existentes devem continuar calculados pelo checkout da Loja.

### Operações de estoque
- Definir quantidade final, aumentar N, reduzir N. Não aceitar valor fracionário quando stock é inteiro.
- Exibir quantidade antes/depois, motivo (reposição, correção, inventário) e referência opcional de documento/lote.
- Negar redução que resulte negativa ou conflite com reserva/saldo após venda concorrente.
- Preços e estoque juntos exigem confirmação clara de quais campos serão modificados.

### Prévia e execução
1. Selecionar produtos e ação.
2. Gerar prévia server-side com snapshot/revisão de cada produto; destacar diferenças, erros e alteração percentual.
3. Confirmar resumo com quantidade de itens e impacto; preferir confirmação reforçada para muitos itens/grandes percentuais.
4. Executar transação segura ou lotes transacionais explícitos; cada lote com ID, ator, ambiente, motivo e auditoria.
5. Resumo de sucesso, erros por item e possibilidade de exportar resultado. Botão Desfazer só se revisão dos itens ainda for compatível e houver reversão segura — nunca promessa de rollback irrestrito.
6. Após execução, atualizar lista da Loja e invalidar cache com mecanismo atual, sem alterar checkout.

### API e esquema propostos, sujeitos à auditoria
Operação admin de prévia, operação admin de aplicar lote e consulta de histórico; permissões de administrador verificadas em servidor. Movimento de estoque e auditoria de preço sob esquema privado; não autorizar update direto do browser em neo_private.shop_products. Transações idempotentes usando request key. Não usar atualização que ignore revision/timestamp do produto.

## Aceitação por cenário
- SKU com estoque 3, venda simultânea de 2 e ajuste de −2: apenas operação consistente é aceita; nunca estoque negativo.
- Webhook duplicado para um pagamento: uma baixa de estoque, um registro de pagamento, nenhuma alteração indevida na quantidade.
- Estoque sem custo: quantidade correta, lucro indisponível.
- Custo USD registrado em data passada: lucro histórico permanece inalterado após edição de câmbio.
- Lote com 20 produtos, um inválido: erro explicitado e política atomicidade clara, sem meio-sucesso oculto.
- Administrador revogado: nenhuma mutação permitida; usuário comum não lê custo.
- Produto duplicado/oculto: catálogo segue regra atual por membro; lote não desbloqueia produto na vitrine.
- Carrinho/checkout, pedidos e Mercado Pago: regressão financeira obrigatória, sem transação real não autorizada.

## Dependências e subetapas
010.1 inventário bancos/código/status; 010.2 decisão formal de política de estoque e custo; 010.3 schema aditivo com RLS/auditoria; 010.4 UI custo e cálculo; 010.5 dashboard; 010.6 validação do fluxo pago e reconciliação, preservando webhook.
011.1 UX e contrato de prévia; 011.2 endpoint seguro; 011.3 UI linha a linha; 011.4 ações em massa/feedback; 011.5 testes concorrentes e publicação controlada.
Cada subetapa só avança com baseline identificado, aceite, testes e atualização do tracker.
