# Vitrine pública e cadastro comercial

## Auditoria inicial em 28 de novembro de 2026

| Ambiente | Referência Git | Evidência |
| --- | --- | --- |
| Produção | `bb92fa8827ed4f66bb05b8367b7e2a60e4732872` | Status Vercel de Produção aprovado no GitHub e SHA-256 de `shop.js` servido pelo domínio igual ao arquivo do commit. |
| Teste | `93242588351304fed03ce8e62406363b85162231` | Status Vercel de Teste aprovado no GitHub e SHA-256 de `shop.js` servido pelo domínio igual ao arquivo do commit. |

A comparação do JavaScript confirma a versão do arquivo. O service worker de Produção também corresponde byte a byte. Em Teste, as diferenças do service worker correspondem à transformação de cache do build de homologação. A associação atual dos aliases aos deployments ainda precisa ser confirmada no painel da Vercel.

As branches `desenvolvimento/pacote-campanhas-estatisticas-producao-20261127` e `desenvolvimento/pacote-campanhas-estatisticas-teste-20261127` contêm trabalhos financeiros paralelos. A branch da vitrine partiu da referência de Produção. O código de compartilhamento gera links canônicos de ambos os domínios oficiais, atualiza a versão de cache e conserva o parâmetro `produto` e o fragmento `#loja`.

A auditoria remota do Supabase consultou metadados de tabelas e colunas. Ambos os projetos mantêm produtos, visibilidade, carrinhos e pedidos em `neo_private`. A RPC existente `neo_shop` e a RPC de cotações de parcelamento exigem autenticação nos dois ambientes. Teste possui estruturas de tarifas, avisos e políticas de parcelamento por produto ausentes de Produção no recorte consultado. A configuração versionada de Produção tem cadastro público e CAPTCHA habilitados. A de Teste tem os dois modos de cadastro e o requisito de CAPTCHA desabilitados. Os endpoints públicos de configuração do Supabase Auth confirmaram Google e Apple desativados nos dois ambientes. Produção permite cadastro por e-mail e informa autoconfirmação. Teste informa bloqueio de novos cadastros. A validação de confirmação de e-mail e OAuth requer um ambiente isolado com esses recursos habilitados.

## Integração pendente

- Reaproveitar catálogo, detalhe, promoção, galeria e temas de `dist/shop.js`. O shell público deve carregar somente as dependências comerciais. Manter o detalhe autenticado atrás das regras de visibilidade por membro existentes.
- Preservar `/?produto=ID#loja` e implementar `/?loja=1#loja`. A camada pública deve validar habilitação global, autorização individual e elegibilidade em cada consulta. Limitar campos e fotos, quantidade de resultados, frequência e validade de cache.
- Reutilizar Supabase Auth com consentimentos comerciais, confirmação de e-mail e recuperação de senha. Registrar a origem em estado controlado pelo servidor. A conclusão do cadastro comercial deve liberar o fluxo da loja sem alterar o estado de onboarding completo.
- Persistir a intenção da compra com prazo e destino interno. Consumir com idempotência depois da autenticação, revalidando preço, estoque e autorização antes de alterar o carrinho. Reutilizar checkout, parcelamento e confirmação de pagamento existentes.
- Integrar os controles e contadores à área Gerenciar Loja, a classificação à administração de usuários e as conversões aos eventos existentes. Confirmar pagamento por evento do servidor e respeitar preferências de privacidade.
- Executar homologação isolada com catálogo sintético, incluindo autorização, callbacks, pagamentos de teste e paridade visual em iPhone, Android, desktop, PWA e WhatsApp. Conferir os requisitos de divulgação e comercialização antes de habilitar a vitrine.

Nenhum produto foi consultado ou selecionado. Esta etapa não aplicou migrações nem alterou serviços. O rollback da consolidação de links consiste em reverter o commit correspondente na branch candidata.

## Isolamento da jornada comercial

A condição para entrar na experiência comercial combina o contexto de entrada e o estado de cadastro confirmado pelo servidor. Visitantes entram pela vitrine. Clientes com cadastro exclusivamente comercial mantêm a jornada comercial após autenticação e recarga. Usuários completos seguem o destino autenticado da loja existente ao abrir links externos, com a visibilidade por membro já aplicada pela loja.

A experiência comercial deve omitir os convites e orientações de instalação no catálogo, na autenticação, no cadastro, no checkout, no retorno e no acompanhamento. O comportamento atual de `dist/install.js`, as preferências de instalação e a medição de instalações seguem disponíveis no aplicativo completo. A conversão voluntária pode começar pelo perfil comercial ou pelo convite exibido após a confirmação efetiva de compra. Registrar a dispensa do convite e permitir voltar à loja durante o onboarding complementar. A transição usa a conta original e conserva pedidos e endereços.

O servidor deve gravar a origem validada ao criar o pedido. Pedidos legados seguem a semântica da loja interna. A integração existente usa a origem registrada para gerar o URL de retorno apropriado, preservando o destino atual de pedidos internos inclusive em retomadas. Na volta, verificar a sessão e a propriedade do pedido e consultar seu estado efetivo antes de renderizar. Os parâmetros da URL servem à navegação. A confirmação financeira continua sob responsabilidade dos mecanismos atuais do servidor. O retorno comercial deve representar pagamento confirmado, pendente, em processamento, recusado ou expirado. A confirmação comercial identifica o pedido e oferece acompanhamento e retorno ao catálogo.

A regressão deve cobrir uma compra interna completa, link externo aberto por usuário completo, cadastro e nova compra comerciais, retorno e retomada em cada contexto, estados de pagamento, supressão dos convites de PWA na jornada comercial, comportamento original da instalação no app e conversão com preservação do histórico. Usar apenas dados sintéticos e validar Safari, Android, desktop, PWA e o navegador interno do WhatsApp.
