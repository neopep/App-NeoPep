# Promoções, cupons e atribuição de origem

## Ativação

1. No SQL Editor do Supabase, execute o arquivo completo `NeoPeptideos-descontos-e-cupons.sql`, incluindo a última linha `commit;`. É a migração 023; exige a atualização 018 (galeria da loja) já instalada. Não remove produtos, pedidos nem dados pessoais. Pode ser executada novamente.
2. Em Edge Functions, atualize **mercadopago-create** com o conteúdo completo de `NeoPeptideos-mercadopago-create.ts` e **mercadopago-webhook** com `NeoPeptideos-mercadopago-webhook.ts`. Os arquivos são autocontidos. Preserve os segredos e a configuração de autenticação existentes; o create valida o JWT do comprador internamente e o webhook exige a assinatura Mercado Pago. Não cole chaves nestes arquivos.
3. Segredos já previstos pela loja: `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID`, `MP_MODE`, `MP_WEBHOOK_SECRET`, `SHOP_APP_URL`. Use credenciais compatíveis com o ambiente e a origem do aplicativo. Nenhuma chave foi configurada ou enviada por este trabalho.
4. Recarregue o aplicativo. Entre com uma conta administradora → Loja → Gerenciar → **Promoções** ou **Cupons e origem**.
5. Valide uma compra no ambiente de teste antes de habilitar vendas reais. Confirme valor líquido, frete, método escolhido, webhook, pedido, estoque e origem. Atualizar os arquivos não ativa automaticamente uma integração de pagamentos ainda não configurada.

Antes do SQL, os menus novos ficam visíveis, porém desabilitados, com uma explicação. Sem as novas funções de pagamento, pedidos promocionais recusam a preparação da cobrança: isso evita cobrar o valor bruto. Compras antigas sem desconto e sem restrição de pagamento continuam compatíveis.

## Configuração das regras

Há promoções automáticas (sem código) e cupons digitados pelo cliente (um por carrinho). Benefícios: percentual, valor fixo em reais e, somente para cupons, identificação de origem sem desconto.

Cada regra permite:

- Escolher produtos participantes, ou nenhum para incluir todos.
- Exigir uma quantidade mínima **e** um valor mínimo em produtos participantes; condições são avaliadas sobre os preços originais, sem frete.
- Exigir Pix, cartão de crédito, boleto ou aceitar qualquer pagamento.
- Definir começo/fim, teto de desconto, limite global e usos por cliente.
- Permitir ou impedir acúmulo. Regras podem ser editadas e pausadas; não são apagadas para preservar referências históricas.

Datas do editor usam o horário do aparelho administrador e são enviadas ao servidor em UTC. Máximo: 50 promoções automáticas ativas, 500 regras cadastradas, 100 produtos selecionados por regra. Os limites existentes do carrinho continuam valendo.

## Comparação e arredondamento

**Somente o maior desconto:** calcula cada regra elegível isoladamente e escolhe a de maior economia.

**Acumular as permitidas:** aplica todas as regras marcadas como cumulativas, da mais antiga à mais nova, sobre o saldo dos produtos elegíveis; compara esse resultado com cada regra isolada, inclusive as exclusivas. Vence o menor total. Não combina regras exclusivas entre si nem com cumulativas. Não é uma busca por todas as permutações possíveis: a ordem é estável e conhecida.

Exemplo: produtos de R$ 200; promoção de 10% e cupom cumulativo de R$ 15 → R$ 165 em produtos. Uma regra exclusiva de R$ 40 vence essa combinação, levando os produtos a R$ 160. O frete é somado depois.

Valores são calculados em centavos inteiros no servidor; percentuais são arredondados para baixo. O desconto nunca excede o saldo elegível, e os produtos permanecem em pelo menos R$ 0,01. Não há desconto de frete nesta versão. O carrinho mostra cada regra aplicada, a economia total e o total com entrega. Quantidade, remoção de item e seleção de pagamento disparam novo cálculo.

## Cupons, origem e usuários

A campanha/canal é texto livre. Opcionalmente, indique pelo e-mail de uma conta existente:

- **Usuário que indicou:** recebe a atribuição da origem nos pedidos; não há comissão ou repasse automático.
- **Cliente exclusivo:** somente essa conta pode utilizar o cupom. Excluir essa conta não libera o cupom para outros clientes.

Um cupom válido pode identificar a origem mesmo quando outra promoção oferece desconto maior. Um cupom inválido ou que não cumpre os requisitos não gera atribuição. O menu mostra reservas em pedidos pendentes, pedidos realmente pagos e, para cupons, o total vendido atribuído. O valor de vendas é o total do pedido com entrega, não uma comissão. Testes, pedidos em conferência e reembolsos não entram em vendas pagas.

Os limites de uso são separados por ambiente de teste/produção, para testes não esgotarem os cupons reais. As reservas de uso acompanham a expiração do pedido (30 minutos). Pedidos rejeitados/cancelados/expirados deixam de consumir uso; pedidos pagos, reembolsados e em conferência continuam registrados no histórico. O limite não é uma garantia contra pagamentos tardios depois de uma reserva expirar; esses pagamentos exigem acompanhamento operacional da loja.

Somente administradores podem criar regras ou consultar origem e associações. Clientes veem o código e os benefícios aplicados ao próprio pedido. Dados de saúde não são consultados.

## Cobrança e histórico

O servidor recalcula preços, estoque, condições, limites e total na criação do pedido, sob bloqueio transacional. Uma cotação alterada exige revisão do carrinho. O pedido guarda nomes, descontos, código, origem, usuário de indicação e pagamento escolhidos naquele momento. Editar uma regra depois não modifica pedidos anteriores. A exportação do cliente inclui seus descontos e o cupom.

O Mercado Pago recebe o valor líquido exato. Quando há desconto, os produtos são enviados como um único item com o total líquido e a entrega em item separado, evitando arredondar preço unitário de várias unidades. O detalhamento original permanece no pedido do aplicativo.

Métodos de pagamento disponíveis são consultados no provedor; os incompatíveis com a seleção são excluídos. Se a opção não estiver disponível, o cliente deve voltar e escolher outra. O webhook consulta o pagamento assinado no provedor e confere também o método efetivamente usado. Uma divergência vai para conferência, sem liberação automática de envio.

Referências utilizadas: [combinação de descontos no Shopify](https://help.shopify.com/en/manual/discounts/discount-combinations) e [exclusão de meios no Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/payment-methods).

## Verificação

Testes automatizados cobrem escopo, quantidade/valor, comparação, acúmulo, arredondamento, cupom exclusivo, validade, reservas, expiração, repetição do instalador, autorização, histórico, exportação, UI, valor enviado ao Mercado Pago e método do webhook. Aplicação no Supabase real, compra real e revisão em Safari/iPhone dependem da ativação e validação da conta responsável.
