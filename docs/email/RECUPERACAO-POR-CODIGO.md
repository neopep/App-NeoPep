# Recuperação de senha dentro do aplicativo

O aplicativo solicita recuperação com `resetPasswordForEmail`, confirma o código recebido usando `verifyOtp` com `type: recovery` e só então apresenta nova senha e confirmação. A gravação usa `updateUser`; nenhum endpoint administrativo nem segredo é usado no navegador. O código segue o tamanho e a validade configurados no Supabase; a interface aceita de 6 a 10 algarismos, preservando zeros iniciais. CAPTCHA protege a solicitação de e-mail; a confirmação é validada pelo Supabase sem solicitar outro CAPTCHA.

## Etapa no Supabase antes do teste real

Authentication → Emails → Templates → Reset password:

- Subject: `Seu código para redefinir a senha — NeoPeptídeos`
- Body: conteúdo completo de `recuperacao-por-codigo.html`, neste diretório.

Salvar o modelo e solicitar um NOVO e-mail. O elemento essencial é `{{ .Token }}`. O modelo anterior com `{{ .ConfirmationURL }}` só mostra um link e deve ser substituído. A confirmação de cadastro continua desativada; SMTP e credenciais permanecem como configurados pelo responsável.

O painel do Supabase não está conectado nesta sessão; a alteração do modelo é manual. Até ela ser feita, o aplicativo mostra a etapa de código, mas o e-mail ainda pode usar o modelo antigo com link. Os links antigos continuam sendo aceitos para compatibilidade, sem garantir abertura na PWA instalada. Não alterar flowType para implicit: a recuperação digitando código funciona sem compartilhar o verificador PKCE entre navegadores.

## Comportamento e validação

O e-mail e o estágio da recuperação são mantidos apenas em sessionStorage por até uma hora para sobreviver à volta do app de e-mail/recarregamento da PWA. Código e senha não são persistidos pelo aplicativo. A autenticação oficial do SDK continua usando a preferência existente de sessão. Uma sessão recuperada não leva a pessoa à tela inicial antes da etapa de nova senha. Ao salvar, o aplicativo carrega a conta; se esse carregamento falhar depois da gravação confirmada, informa que a senha foi alterada e orienta entrar novamente.

Verificar em iPhone instalado: solicitar código → consultar e-mail → retornar à PWA → digitar código → nova senha e confirmação → salvar → sair e entrar com nova senha. Código errado/expirado deve manter a etapa de código; solicitar outro exige nova verificação CAPTCHA e respeita a pausa de um minuto. Validade e limites de tentativas continuam impostos pelo Supabase.
