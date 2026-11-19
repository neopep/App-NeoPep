# Login, sessão e confirmação de e-mail

## Uso
Manter conectado neste dispositivo vem marcado por padrão no login e no cadastro. O SDK oficial Supabase guarda os tokens de sessão no localStorage e os renova quando permitido. O aplicativo não guarda a senha. Abrir novamente a mesma prévia, no mesmo navegador e origem, restaura a sessão validada e encaminha ao painel ou ao cadastro inicial. Desmarcar a opção usa sessionStorage da aba. O painel administrativo carrega o mesmo SDK e respeita essa escolha.

Sair encerra a sessão local pelo SDK e remove os tokens da memória, localStorage e sessionStorage, incluindo o estado PKCE. Os registros de saúde e compras salvos no banco não são apagados. A preferência Manter conectado pode permanecer, mas não contém a sessão nem a senha. Encerrar sessões remotas não é o mesmo que o botão Sair deste dispositivo.

Sessões antigas da aba são reaproveitadas com segurança na atualização. Se o navegador bloquear/gravar sem espaço, há fallback para sessão da aba/memória; tokens antigos não substituem os renovados, e a interface de acesso informa a limitação quando identificada. Limpeza dos dados do site, navegação privada, navegador diferente, partição de armazenamento, revogação ou expiração imposta pelo provedor podem exigir novo login. Não há promessa de acesso permanente ou acesso offline aos dados da nuvem.

## Cadastro
O e-mail de confirmação continua obrigatório conforme a configuração existente do Supabase; esta alteração não desativa nem simula a confirmação.

Se Criar conta retorna sem sessão, a tela volta ao login com o e-mail preenchido, senha vazia e aviso para confirmar o cadastro. Falhas de cadastro mantêm o formulário e mostram o erro; não anunciam envio de confirmação. Se o provedor retornar uma sessão real válida, o aplicativo a usa e encaminha ao fluxo correspondente. Depois de confirmar por link, a troca PKCE é feita pelo SDK; com sessão validada, contas novas abrem o cadastro inicial e contas completas abrem o painel.

O verificador PKCE acompanha o armazenamento escolhido. Com a opção marcada, o link pode ser aberto em outra aba do mesmo navegador/origem. Em outro navegador/dispositivo ou sem o verificador, a interface orienta entrar com e-mail e senha se o e-mail já tiver sido confirmado; não afirma que a confirmação foi bem-sucedida sem uma sessão validada. Links expirados exigem novo envio. Recuperação de senha continua pelo mecanismo oficial; para concluir a troca PKCE, use o navegador em que solicitou o link. Não foram alterados templates, SMTP, quotas ou URLs externas do Supabase. Continue usando a URL HTTPS autorizada da prévia.

## Privacidade e termos
Cadastro mostra um único aceite obrigatório e inicialmente desmarcado, com links para Política de Privacidade e Termos que abrem em outra aba, preservando o formulário. Login e recuperação mostram apenas os links; não repetem o aceite já registrado. O checkbox separado que ficava abaixo de Apple/Google foi removido. No modo Criar conta, o único aceite também se aplica à ação desses provedores; um usuário novo ainda precisa concluir os consentimentos do cadastro inicial. O consentimento específico de saúde e o registro final dos termos nesse cadastro inicial continuam protegidos pelo servidor.

Apple/Google continuam com o estado de configuração anterior. Não foram ativados provedores nem criadas credenciais nesta alteração.

## Ativação e validação
Não exige SQL novo, contratação ou credenciais. Atualize a prévia e entre uma vez com Manter conectado marcado. Feche/reabra pelo mesmo navegador ou PWA e confira a restauração. Use Sair e confira que o acesso não é restaurado. Teste também com a opção desmarcada, uma conta nova e o link de confirmação.

Os testes locais usam o SDK como contrato e simulam as respostas da autenticação; cobrem sessões entre instâncias/abas, escolha de armazenamento, limpeza na saída, migração da sessão antiga, PKCE, quota/bloqueio, cadastro com/sem sessão, restauração do painel, consentimento desmarcado e callbacks sem sessão. Não enviam e-mails reais nem validam uma conta remota. A entrega real de e-mail e o Safari/PWA precisam ser conferidos no dispositivo.

O acesso ChatGPT exigido pela hospedagem privada Sites é separado do login NeoPeptídeos. Esta alteração preserva a audiência atual e não remove essa camada da hospedagem. Navegadores internos de outros aplicativos podem isolar ou descartar o armazenamento; para avaliar persistência, use a mesma URL no Safari/Chrome ou o PWA instalado.
