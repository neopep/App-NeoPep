# Candidato técnico da vitrine comercial

O pacote usa `bb92fa8` como referência de Produção e `722ec4b` como base da integração comercial. O pacote versionado inclui a extração dos componentes compartilhados, a configuração local da ponte para Auth e onboarding e a migração aditiva do marcador privado de cadastro. A página oficial continua sem entrada para a vitrine. O opt-in exige também que o aplicativo e o Supabase estejam em loopback.

## Evidência e limites

- `bash tests/commercial-supabase-local.sh` monta Auth GoTrue, PostgREST e PostgreSQL descartáveis, sem credenciais remotas. Exercita login por e-mail, restauração de sessão na mesma aba, confirmação da identidade durante a transição e onboarding original. Usa contas fictícias e autoconfirmação local. A validação das imagens usa a política SQL de Storage e registros sintéticos. O serviço de entrega de bytes do Storage, CAPTCHA, confirmação por e-mail e os provedores OAuth ficam fora desse ensaio.
- `node --test tests/shop-ui.test.cjs` cobre a leitura autenticada do pedido no checkout original e a matriz simulada de retorno. Inclui avisos contraditórios da URL, pedido aguardando pagamento, análise, conferência, recusa, expiração, cancelamento e aprovação persistida. O teste não chama o Mercado Pago nem realiza cobranças.
- A página legada de retorno imediato apresenta texto a partir de `result` na URL. A confirmação interna continua dependendo do pedido consultado no servidor. Antes de abrir uma jornada comercial, implementar e homologar seu retorno autenticado baseado no estado do servidor, sem reaproveitar o parâmetro visual como confirmação.
- O cadastro comercial público, os callbacks de autenticação comercial, o retorno da jornada comercial ao contexto original e a exposição de catálogo e fotos exigem homologação própria e autorização. A migração do marcador não concede permissões de compra, divulgação ou acesso a dados privados.

## Procedimento para uma publicação futura

1. Comparar a branch com a versão efetiva de Produção e manter as proteções de branch e build. Limitar o candidato aos componentes compartilhados, à integração desativada e, se necessária, à migração aditiva. Conferir que a configuração produtiva não habilita `commercialPreview`.
2. Em instância descartável, executar o teste de integração acima, `npm run check`, `npm run build` e `npm test`. Confirmar o fluxo original e verificar que a página principal não carrega a vitrine. Conferir o alvo, as permissões e o backup antes de decidir sobre qualquer aplicação de SQL.
3. Com a aprovação de publicação e o candidato validado, aplicar somente a migração [shop_commercial_accounts](../../../supabase/migrations/20261128174500_shop_commercial_accounts.sql) se o estado privado for necessário ao pacote aprovado. Verificar as duas RPCs e os grants sem consultar clientes ou itens reais. Publicar uma única versão consolidada com a vitrine desligada e confirmar o SHA servido nos domínios autorizados.
4. A habilitação de uma vitrine e de novas operações comerciais requer uma aprovação separada após as validações pendentes.

## Rollback

A versão web pode voltar ao deployment anterior confirmado. O estado comercial continua inerte enquanto a entrada pública estiver desativada. Se a migração tiver sido aplicada e o marcador estiver vazio, a [reversão versionada](../rollback/20261128174500_shop_commercial_accounts.sql) remove apenas as duas RPCs e a nova tabela. A transação bloqueia a reversão quando há vínculos. Nesse caso, mantenha o recurso desativado até revisar a retenção e preservar o estado registrado. O ensaio local exercita recusa com vínculo, reversão após revogação e reaplicação.
