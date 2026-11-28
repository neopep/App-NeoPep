# Candidato técnico da vitrine comercial

O pacote usa `bb92fa8` como referência de Produção e `722ec4b` como base da integração comercial. O pacote versionado inclui a extração dos componentes compartilhados, a configuração local da ponte para Auth e onboarding e a migração aditiva do marcador privado de cadastro. A página oficial continua sem entrada para a vitrine. O opt-in exige também que o aplicativo e o Supabase estejam em loopback.

## Evidência e limites

- `bash tests/commercial-supabase-local.sh` monta GoTrue, PostgREST, PostgreSQL e Mailpit descartáveis. O ensaio usa contas fictícias e confirmação por e-mail com PKCE. Exercita login, restauração de sessão na mesma aba, recuperação por link, transição com a mesma conta e conclusão do onboarding original.
- Na prévia local, os callbacks conservam apenas o destino validado de catálogo ou produto. O destino oficial de Auth permanece igual. O ensaio não cobre a navegação completa de um navegador após callbacks de provedores externos.
- O ensaio entrega os bytes de uma imagem fictícia por um endpoint simulado do SDK. O endpoint consulta a autorização efetiva via RPC, e a política SQL é verificada separadamente. O ensaio cobre bloqueio anônimo, troca de conta, identificador incorreto e revogação. O serviço oficial de Storage não iniciou neste ambiente. O Docker ficou sem espaço ao extrair a imagem. A entrega por esse serviço e a expiração dos links assinados seguem pendentes.
- CAPTCHA foi validado com provedor simulado no frontend e no repasse do token. Falta homologar as chaves e a verificação de desafio em uma instância isolada autorizada. A recuperação por link PKCE passou no servidor descartável. A interface de código numérico não foi homologada ponta a ponta nessa instância.
- **Google.** Faltam cliente OAuth web, Client ID e segredo configurados no Supabase, origem autorizada e callback do projeto cadastrado na plataforma Google.
- **Apple.** Faltam Services ID, domínio e callback autorizados, Team ID, Key ID e chave de assinatura para gerar e rotacionar o segredo OAuth. Os dois provedores permanecem desativados na configuração de referência.
- `node --test tests/shop-ui.test.cjs` cobre a leitura autenticada do pedido no checkout original e a matriz simulada de retorno. Inclui avisos contraditórios da URL, pedido aguardando pagamento, análise, conferência, recusa, expiração, cancelamento e aprovação persistida. O teste não chama o Mercado Pago nem realiza cobranças.
- A página legada de retorno imediato apresenta texto a partir de `result` na URL. A confirmação interna continua dependendo do pedido consultado no servidor. Antes de abrir uma jornada comercial, implementar e homologar seu retorno autenticado baseado no estado do servidor, sem reaproveitar o parâmetro visual como confirmação.
- O cadastro comercial público, os callbacks de autenticação comercial, o retorno da jornada comercial ao contexto original e a exposição de catálogo e fotos exigem homologação própria e autorização. A migração do marcador não concede permissões de compra, divulgação ou acesso a dados privados.

## Procedimento para uma publicação futura

1. Comparar a branch com a versão efetiva de Produção e manter as proteções de branch e build. Limitar o candidato aos componentes compartilhados, à integração desativada e, se necessária, à migração aditiva. Conferir que a configuração produtiva não habilita `commercialPreview`.
2. Em instância descartável, executar o teste de integração acima, `npm run check`, `npm run build` e `npm test`. Confirmar o fluxo original e verificar que a página principal não carrega a vitrine. Conferir o alvo, as permissões e o backup antes de decidir sobre qualquer aplicação de SQL. A consulta somente leitura de Produção confirmou `neo_private`, `auth.users` e `neo_admin_access()`, além da ausência dos três objetos novos da migração.
3. Com a aprovação de publicação e o candidato validado, aplicar somente a migração [shop_commercial_accounts](../../../supabase/migrations/20261128174500_shop_commercial_accounts.sql) se o estado privado for necessário ao pacote aprovado. Verificar as duas RPCs e os grants sem consultar clientes ou itens reais. Publicar uma única versão consolidada com a vitrine desligada e confirmar o SHA servido nos domínios autorizados.
4. A habilitação de uma vitrine e de novas operações comerciais requer uma aprovação separada após as validações pendentes.

## Rollback

A versão web pode voltar ao deployment anterior confirmado. O estado comercial continua inerte enquanto a entrada pública estiver desativada. Se a migração tiver sido aplicada e o marcador estiver vazio, a [reversão versionada](../rollback/20261128174500_shop_commercial_accounts.sql) remove apenas as duas RPCs e a nova tabela. A transação bloqueia a reversão quando há vínculos. Nesse caso, mantenha o recurso desativado até revisar a retenção e preservar o estado registrado. O ensaio local exercita recusa com vínculo, reversão após revogação e reaplicação.
