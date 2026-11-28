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

## Implementação local com base em Produção

O arquivo `dist/shop.js` usa as mesmas funções de catálogo e detalhe para a loja interna e a prévia comercial. Elas compartilham cards, filtros, galeria, preços, selos e classes de layout. A prévia carrega diretamente `dist/style.css` e `dist/appearance.js`. As informações de suporte, carrinho e pagamento são fornecidas pelo contexto. Quando a prévia não dispõe de uma cotação autorizada, apresenta a indisponibilidade de parcelamento.

A prévia em `tests/fixtures/shop-public/` aceita apenas loopback e usa cadernos e canecas fictícios. Para conferência local, execute `python3 -m http.server 4173 --bind 127.0.0.1` na raiz e abra `http://127.0.0.1:4173/tests/fixtures/shop-public/?loja=1#loja`. A página simula o cadastro e o retorno à loja após a abertura voluntária da etapa complementar. A sessão fictícia fica em memória. O HTML de Produção não carrega o módulo da prévia. Na etapa atual, a projeção de dados protege a renderização local. A autorização efetiva do catálogo público continua dependendo de consultas e permissões no servidor.

O contexto da conta vem do adaptador de sessão. A URL escolhe somente catálogo ou produto. Uma conta autenticada sem estado comercial confirmado continua elegível ao fluxo original do aplicativo. O PWA suprime os convites enquanto o contexto comercial está montado e mantém a lógica existente fora desse contexto.

## Auth de Produção

Em 28 de novembro de 2026, o endpoint público de configuração informou e-mail habilitado, cadastro permitido e autoconfirmação de e-mail. O frontend exige CAPTCHA e desabilita os botões Google e Apple. O endpoint também informou ambos os provedores desativados. Esse diagnóstico foi somente leitura e não enviou e-mails nem criou contas.

- **E-mail.** Confirmar no painel a política de confirmação e SMTP antes de habilitar a jornada comercial. A autoconfirmação observada impede validar confirmação de e-mail em Produção como se ela estivesse configurada. Validar em ambiente isolado criação, confirmação, expiração e recuperação com o Auth existente e CAPTCHA. Rever o impacto de ajustes globais sobre o cadastro original.
- **Google.** O cliente web precisa de origem HTTPS autorizada, URI de callback do Supabase correspondente ao projeto, Client ID e segredo configurados no provedor Supabase. Revisar a tela de consentimento e habilitar o botão depois da validação dos callbacks PKCE. [Configuração do Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- **Apple.** O OAuth web precisa de Services ID, domínio e URL de retorno verificados, chave de assinatura e segredo configurado no Supabase. Prever a rotação semestral do segredo. Verificar primeiro acesso, endereço intermediário e o caso em que o nome não vem do provedor. [Configuração da Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- **Callbacks e CAPTCHA.** Preservar os callbacks do app completo e confirmar URLs exatas na lista de permissões. A intenção de compra futura deve voltar por destino interno validado, associado à sessão. Guardar segredos no serviço responsável e preservar as proteções de cadastro, login e recuperação. [URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls) · [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)

A implementação de cadastro real, autorização pública, estado persistente, carrinho, pagamento e transição pelo onboarding existente continua pendente. A prévia não consulta registros comerciais e não chama o Mercado Pago. O Supabase de Teste ficou fora desta rodada.

## Paridade visual e transição com a mesma conta

O teste `tests/shop-public-browser.cjs` intercepta as requisições do Chromium e usa exclusivamente arquivos locais e produtos fictícios. Compara dimensões e estilos calculados de catálogo, cards, detalhe e preços com o renderizador interno. Exercita desktop de 1280 × 800 e celular emulado, temas claro e escuro, tema automático em ambas as preferências do sistema e ausência de rolagem horizontal. O teste administrativo existente verifica que o produto restrito aparece em Gerenciar e fica fora da loja até a autorização simulada.

A transição voluntária usa o adaptador para reconfirmar o identificador e o estado da conta. Se a conta mudou, já concluiu o onboarding ou perdeu o estado comercial, a prévia mantém o cliente na loja. A chamada única de transição recebe apenas o identificador verificado. A integração futura deve usar a sessão Auth já estabelecida e encaminhar ao onboarding existente. A conclusão permanece sob responsabilidade de `neo_complete_onboarding`, com os consentimentos específicos e as validações atuais. A prévia usa um adaptador em memória e permite retornar ao produto sem gravar dados. A entrada da loja mantém o convite do PWA fora da jornada comercial e preserva um convite que já estava disponível no aplicativo.

A auditoria de Produção consultou apenas o catálogo do Postgres. Anônimos não executam `neo_shop`, `neo_shop_photo` ou `neo_admin_access`. As tabelas privadas de produtos, pedidos e visibilidade têm RLS e não concedem leitura direta a `anon` ou `authenticated`. A revisão das migrações confirma a checagem de administrador e a filtragem da vitrine por membro. A prévia permite somente caminhos de imagens nos fixtures locais. Uma eventual vitrine publicada precisa de autorização no servidor sobre linhas, campos e imagens antes da entrega ao navegador.

O endpoint de configuração pública de Auth foi reconferido sem alterar o projeto. O diagnóstico distingue o requisito de CAPTCHA do frontend da configuração efetiva no painel. A execução real de confirmação por e-mail e OAuth e a validação de CAPTCHA ponta a ponta continuam pendentes em ambiente isolado. Esta rodada não integrou o adaptador ao onboarding real nem habilitou rotas, catálogo ou operações comerciais públicas.
