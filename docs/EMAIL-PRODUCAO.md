# E-mails de produção — configurar Resend no Supabase

Estado: SMTP ainda não configurado, segundo o responsável. Nenhum serviço contratado nem credencial criada nesta etapa. Proton continua como contato de privacidade; não é usado como servidor SMTP desta integração.

## 1. Domínio e Resend
1. Informar o domínio comprado e onde ele é administrado. É necessário acesso ao DNS para verificar um domínio de envio. O domínio do site e o de envio podem ser diferentes, desde que autorizados e verificados.
2. Criar uma conta em https://resend.com sob titularidade da empresa. Começar no plano gratuito se os limites forem suficientes; conferir as cotas vigentes no painel antes de abrir inscrições. O SMTP pode ser usado com Supabase Free; contratar Supabase Pro não configura o SMTP automaticamente.
3. Em Domains → Add Domain, adicionar preferencialmente um subdomínio de envio, como `auth.SEUDOMINIO`. Esse é apenas um exemplo, não um domínio já configurado.
4. Copiar para o painel DNS os registros EXATOS fornecidos pelo Resend (tipo, nome, valor, prioridade e TTL quando aplicável). Não inventar registros SPF/DKIM, não criar dois SPF para o mesmo hostname e não substituir MX do e-mail existente. Verificar a necessidade de registros do domínio de retorno de envio conforme o painel. Configurar DMARC com atenção aos provedores existentes.
5. Aguardar o status Verified no Resend. Manter rastreamento de abertura/cliques desativado nos e-mails de autenticação para não alterar links sensíveis.
6. Criar API key com permissão mínima de envio para o domínio autorizado, quando disponível. Guardar em gerenciador de segredos; inserir diretamente no Supabase. Nunca enviar a chave no chat nem em `dist/config.js`.

## 2. Campos no Supabase
No projeto NeoPeptídeos → Authentication → Email/SMTP Settings (o nome do menu pode variar), habilitar Custom SMTP:

| Campo | Valor |
|---|---|
| Sender name | NeoPeptídeos |
| Sender email | Um remetente do domínio verificado, por exemplo `acesso@auth.SEUDOMINIO` |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | API key Resend, inserida somente nesse painel |

Não usar `privado1982@proton.me` como remetente Resend: o domínio proton.me não é da empresa para verificação. Ele pode permanecer como canal público de contato. Salvar e conferir os logs de entrega no Resend, sem compartilhar links de confirmação ou tokens.

## 3. Supabase Auth e CAPTCHA
- Manter confirmação de e-mail e senha mínima de 12 caracteres.
- Não remover a verificação CAPTCHA para resolver problemas de envio.
- Na configuração de URLs, manter o callback exato que já funciona: `https://elo-minha-evolucao.supplemast3.chatgpt.site/neo/`.
- Quando o domínio próprio estiver conectado por HTTPS, adicionar seu callback exato `https://DOMINIO/neo/` antes de trocar o Site URL. Evitar wildcards amplos. O `authRedirectPath` atual é `/neo/`.
- No Turnstile, adicionar o hostname escolhido para o lançamento. A secret key continua apenas no painel Supabase.
- Revisar os limites de envio no Supabase conforme a cota do Resend. A cota SMTP e a limitação do Auth são controles diferentes; não colocar valores ilimitados.
- Preservar os templates oficiais compatíveis com o SDK PKCE; não substituir o link por uma URL fixa do app.

## 4. Teste real obrigatório
1. Cadastrar uma conta descartável usando endereço externo (fora da equipe Supabase).
2. Confirmar entrega, remetente, link HTTPS e confirmação. Não publicar o conteúdo do link.
3. Entrar, fechar/reabrir com Manter conectado e sair.
4. Solicitar recuperação; testar alteração de senha e login com a nova senha.
5. Conferir erro de link expirado/usado e mensagens de falha sem disparar envios em massa.
6. Registrar resultado e data em `release/web-readiness.json`, sem e-mail pessoal, senha ou token na evidência. Não marcar SMTP concluído apenas por salvar os campos.

Sem acesso ao DNS, é possível criar a conta e preparar a configuração, mas o envio público com remetente próprio permanece pendente. O serviço de e-mail padrão do Supabase é destinado a testes, não a uma abertura pública confiável.

Fontes oficiais consultadas em 12/11/2026:
- https://resend.com/docs/send-with-supabase-smtp
- https://resend.com/docs/dashboard/domains/introduction
- https://supabase.com/docs/guides/auth/auth-smtp
- https://resend.com/pricing
