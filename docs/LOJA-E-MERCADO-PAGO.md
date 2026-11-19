# Loja NeoPeptídeos e preparação do Mercado Pago

## Entrega desta etapa
A navegação inferior troca Perfil por Loja; o perfil continua no avatar superior. Loja autenticada com catálogo, busca, categorias, ordenação por preço, detalhe de produto, carrinho sincronizado por conta, endereço de entrega, revisão e pagamento. É uma loja de um único responsável, com experiência de marketplace; não há cadastro de vendedores independentes nem divisão de pagamentos.

Contas administrativas que já exercem moderação podem adicionar/editar produtos com foto, descrição, categoria, preço em BRL, estoque disponível e publicação/rascunho. A imagem passa pelo processamento JPEG existente e não usa fotos privadas de evolução. A equipe configura identificação comercial, contato, condições de troca, frete fixo nacional e prazo informado pela própria loja. Não há cotação de transportadora automática. Pedidos pagos podem receber status de envio e código de rastreio.

Nenhum produto, avaliação, desconto ou venda real foi inventado. O catálogo começa vazio e é alimentado pelo responsável. Até 230 produtos são carregados nesta versão, priorizando itens do carrinho; pedidos mostram os 100 mais recentes. Paginação e frete por transportadora são expansões futuras.

## Pagamento e segurança
Checkout Pro hospedado pelo Mercado Pago. O aplicativo não recebe número de cartão, CVV ou token bancário. O logo local vem do Simple Icons (https://cdn.simpleicons.org/mercadopago/009EE3); marca pertence ao Mercado Pago. Uso da imagem não significa certificação, parceria ou garantia irrestrita da compra. A página oficial de identidade é https://www.mercadopago.com.br/mp/logo-oficial.

Preços/frete são calculados no servidor, em centavos; o cliente não define o total cobrado. O pedido guarda um retrato dos itens e do endereço confirmado. Reserva de estoque por 30 minutos, criação idempotente de pedido e links por função autenticada. Retorno do navegador não marca pagamento como aprovado. O webhook valida HMAC e horário, consulta o pagamento diretamente na API e confere recebedor, moeda, ambiente, valor e referência antes de atualizar o pedido. Teste aprovado tem estado test_paid e não autoriza envio real. A conta vendedora é conferida via users/me, inclusive a tag test_user, para evitar confundir credenciais produtivas com conta de testes.

A criação usa init_point conforme a documentação atual de testes do Checkout Pro. Testes requerem a conta de teste vendedora da aplicação e comprador de teste, não dados de cartão reais. O código não foi validado contra uma conta Mercado Pago real nesta etapa. A integração fica desativada por padrão (payments_ready=false), sem chaves no frontend.

Pagamentos tardios sem estoque, reembolsos parciais e cobranças duplicadas ficam em conferência; a equipe precisa verificar/reembolsar no painel do provedor. Reembolso/contestação confirmados não são substituídos por uma aprovação antiga. Não há botão que permita ao administrador marcar pagamento como pago. Não há estorno automático, emissão de nota fiscal nem e-mails transacionais nesta etapa. Esses processos e as condições comerciais precisam ser definidos pelo responsável antes de operação pública.

## Ativar o banco e cadastrar os produtos
1. No mesmo projeto Supabase, SQL Editor > nova consulta.
2. Executar `supabase/setup/shop.sql` inteiro (cópia para download: NeoPeptideos-configurar-loja.sql). Transação única com migrações 012/013, reexecutável, sem alterar dados de saúde ou postagens.
3. Atualizar a prévia e abrir Loja > Gerenciar > Adicionar produto. Informar foto, preço, estoque e dados reais da oferta.
4. Em Gerenciar > Entrega e condições, preencher identificação, CPF/CNPJ, endereço comercial, contato, regras de troca e frete. Zero significa frete grátis apenas se a equipe o configurar conscientemente.
5. Validar carrinho, endereço e revisão. O pagamento seguirá bloqueado enquanto o servidor não estiver configurado e validado.

## Conectar o Mercado Pago — intervenção externa pendente
No Mercado Pago Developers, criar/selecionar a aplicação Checkout Pro e suas contas de teste. Manter separados vendedor e comprador. A conta vendedora de teste é gerada pela aplicação nas versões atuais do Checkout Pro. Consultar a documentação vigente e conferir que users/me retorna a identificação e a tag da conta de teste.

No Supabase > Edge Functions > Secrets, configurar (nunca no chat ou navegador):
- MP_ACCESS_TOKEN: credencial da conta vendedora apropriada ao ambiente.
- MP_COLLECTOR_ID: User ID dessa conta vendedora, obtido na configuração da conta de teste/conta vendedora.
- MP_WEBHOOK_SECRET: assinatura secreta apresentada pelo Mercado Pago para os Webhooks.
- MP_MODE: test nesta validação; production somente após aprovação da integração real.
- SHOP_APP_URL: URL HTTPS completa da loja, atualmente https://elo-minha-evolucao.supplemast3.chatgpt.site/neo/.

SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ficam no ambiente das funções, nunca em dist/config.js. Checkout Pro por redirecionamento não exige Public Key no frontend desta implementação.

Publicar as funções, em computador autorizado com Supabase CLI:

```sh
supabase functions deploy mercadopago-create --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
supabase functions deploy mercadopago-webhook --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
supabase functions deploy delete-account --project-ref cpslafpzjtbpmoxxysaa
```

As duas primeiras fazem sua própria validação: create exige sessão validada via auth.getUser e origem correta; webhook exige HMAC oficial, não JWT de usuário. Não aplicar a opção a outras funções por analogia.

Em Webhooks da aplicação Mercado Pago, habilitar eventos de pagamento e cadastrar:
`https://cpslafpzjtbpmoxxysaa.supabase.co/functions/v1/mercadopago-webhook`

A assinatura usa o parâmetro de URL data.id e os headers x-request-id e x-signature. Eventos IPN antigos sem assinatura não são aceitos. Limite de dez minutos para o horário da assinatura; verificar entregas/reenvios reais durante a homologação.

Após configurar as credenciais de TESTE e implantar as funções, liberar SOMENTE teste no SQL Editor:

```sql
update neo_private.shop_settings
set payment_environment='test', payments_ready=true
where singleton;
```

Confirmar o fluxo completo com contas e cartões de teste oficiais, inclusive webhook. O domínio da página pode ser o mesmo usado em produção; o ambiente depende das credenciais/conta e dos pagamentos retornados, não de desenhar um botão sandbox. A interface e o banco distinguem teste de venda real e não autorizam despacho de teste.

Produção exige mudar de forma coordenada credenciais, MP_COLLECTOR_ID, MP_WEBHOOK_SECRET, MP_MODE e payment_environment para production, além da validação real. Não fazer essa troca só para retirar o aviso de preparação. A hospedagem atual continua privada e precisa de acesso apropriado aos compradores antes da abertura pública. Não foram criadas credenciais, contas, cobranças nem publicados segredos pelo agente.

## Operação e dados pessoais
RLS em tabelas privadas. Cliente vê seus próprios carrinho/pedidos; equipe autorizada vê apenas dados necessários à venda e envio. Nenhum peso, medida, dose ou foto corporal é transmitido ao Mercado Pago. O provedor recebe itens, valor, referência do pedido e e-mail confirmado no checkout.

Pedidos vencidos são liberados de forma idempotente quando o fluxo de pedidos/checkout é consultado; uma rotina agendada de reconciliação e expiração é recomendada antes de escalar. Pagamentos tardios precisam ser conciliados. Reservas disponíveis no estoque podem ser editadas pela equipe, que deve considerar os pedidos existentes. Não apagar manualmente produtos relacionados a pedidos; usar rascunho/indisponível.

A exportação pelo Perfil inclui os pedidos do próprio usuário quando a nova RPC estiver disponível. Exclusão de conta é bloqueada se houver pedidos que precisam de atendimento. Após resolução/entrega, dados pessoais do pedido são anonimizados na exclusão; o histórico financeiro pseudonimizado é preservado para controle comercial. Fotos públicas de produto são ativos do catálogo, não fotografias pessoais de evolução. Definir retenção e documentos fiscais com o responsável antes de operação pública.

A função delete-account atualizada faz a checagem de pedidos antes de remover fotos. Reimplantá-la é necessário para o fluxo de exclusão ter essa mensagem preventiva; a proteção no banco também impede excluir conta com pedidos em aberto.

## Validação
Testes PostgreSQL verificam autorização, isolamento, preço no servidor, reserva/idempotência, expiração sem duplicação, pagamento tardio sem estoque, confirmação exclusiva do serviço, envio e anonimização. Testes das funções usam transporte simulado, verificando token, assinatura, replay, recebedor/moeda/modo, conteúdo não confiável do webhook e não exposição de segredos. Testes DOM cobrem catálogo/carrinho/endereço, bloqueio de integração ausente, redirecionamento e retorno que não confirma pagamento.

Pendentes: executar SQL no projeto real, cadastrar produtos, configurar as credenciais e Webhooks, implantar funções, validar entrega de pagamento com contas de teste, testar no Safari/iPhone e definir operação comercial/fiscal. Sem cua_repl.js no ambiente gerenciado, QA visual não foi realizado. Não é uma loja em produção com cobrança validada.

Referências consultadas: documentação Mercado Pago Checkout Pro Preferences; test-accounts; integration-test/test-purchases; payment-notifications; API /checkout/preferences e /v1/payments. Nenhum pagamento real foi criado.
