# Conexão Supabase — estado verificado

Projeto informado pelo responsável: `cpslafpzjtbpmoxxysaa`.
Endpoint: `https://cpslafpzjtbpmoxxysaa.supabase.co`.
A chave **pública publishable** foi vinculada ao config.js. Nenhuma chave administrativa foi solicitada ou inserida no app.

## Atualização após execução do SQL pelo responsável
Nova verificação remota: as seis tabelas públicas Neo retornaram HTTP 401 / PostgreSQL 42501 para a chave pública sem login (permission denied). Os RPCs `neo_admin_summary` e `neo_export_account_metadata` também recusaram acesso anônimo. As tabelas e funções já estão disponíveis no schema cache, corrigindo o PGRST205 observado antes.

Nenhuma linha de usuário foi solicitada (consultas com limit=0); nenhum registro foi criado/alterado. Essa verificação confirma a presença dos objetos e a recusa de acesso anônimo, mas não comprova ainda RLS entre duas contas autenticadas ou o conteúdo/configuração do Storage privado.

Auth continua com e-mail habilitado e confirmação exigida; Google e Apple continuam desabilitados. Turnstile/site key, SMTP, redirects, Edge Function, teste de conta e validação no iPhone seguem pendentes. `cloudValidated=false` e cadastro público bloqueado no app permanecem adequados.

## Verificações iniciais antes da instalação
- `GET /auth/v1/settings`: HTTP 200 com a chave informada, confirmando conectividade e aceitação da chave.
- Provedor e-mail habilitado. `mailer_autoconfirm=false`: confirmação de e-mail exigida.
- Google e Apple desabilitados no projeto.
- Consultas com `limit=0` às tabelas `neo_profiles`, `neo_records`, `neo_consents` e `neo_photos`: HTTP 404 / PGRST205. Essas tabelas não estavam disponíveis no schema cache da API. Nenhum registro de pessoa foi solicitado ou lido.
- Não foram criadas contas, enviados e-mails ou executadas migrações remotas. Nenhum dado local foi migrado.
- CAPTCHA, SMTP, URLs de redirecionamento, Storage privado e função de exclusão ainda não foram validados remotamente.

## Próxima ação do responsável
1. Abrir https://supabase.com/dashboard/project/cpslafpzjtbpmoxxysaa/sql/new.
2. Copiar o conteúdo de `supabase/setup/install.sql` (também entregue como `NeoPeptideos-configurar-Supabase.sql`).
3. Clicar Run e conferir o resultado “Estrutura NeoPeptideos instalada; RLS e bucket privado configurados.”.
4. Informar o resultado para nova verificação da API.

O instalador foi testado em PostgreSQL local do zero e em reexecução, preservando um registro existente. Usa uma única transação, instala as migrações 001 e 002 quando os marcadores de instalação não existem e verifica componentes essenciais antes de confirmar. Não substitui um schema parcialmente modificado manualmente; nesse caso, pode encerrar com erro para revisão.

A chave pública não tem privilégios de administração de schema. Não enviar service_role ou senha do banco no chat para contornar essa etapa.

## Depois do SQL
- Authentication → URL Configuration: cadastrar exatamente `https://elo-minha-evolucao.supplemast3.chatgpt.site/neo/` para Site URL e redirect da prévia.
- Configurar Turnstile no Supabase e informar apenas a site key pública ao app; segredo somente no Supabase.
- Configurar SMTP e testar entrega/recuperação reais.
- Google e Apple: callback do projeto é `https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1/callback`. Segredos diretamente nos respectivos provedores/Supabase.
- Implantar a Edge Function `delete-account`, conforme o guia de ativação.
- Informar nome/razão social e contato do controlador antes de liberar público.
- Testar duas contas reais, RLS, Storage, migração, sincronização e exclusão. Só então confirmar `cloudValidated` e liberar audiência pública.

O projeto Supabase informa que aceita novos cadastros; enquanto o preparo não estiver concluído, revisar no dashboard o controle de novos usuários. As flags do frontend não substituem a configuração do Auth.

## Estado da prévia
`providers.email=true` reflete a configuração observada, mas os botões continuam bloqueados pela ausência de CAPTCHA e pela não liberação de cadastro. `publicRegistration=false` e `cloudValidated=false` permanecem. O Site continua privado. As funcionalidades locais continuam disponíveis.

Os testes locais após o vínculo passaram: 47 casos em 12 arquivos, incluindo o instalador reexecutável. Eles não comprovam login, SMTP, OAuth ou funcionamento em iPhone reais.

## Turnstile — configuração pública recebida
A Site Key pública fornecida pelo responsável foi vinculada ao frontend. A Secret Key não foi recebida nem colocada no código. A ativação do provider CAPTCHA no Supabase e a validação real do widget/login continuam pendentes de confirmação. `publicRegistration=false` e `cloudValidated=false` permanecem. Verificações de configuração, HTML portátil e preservação do Elo passaram.

## Cadastro controlado na prévia privada
O responsável confirmou ativação do CAPTCHA no Supabase. Um teste negativo real de login, sem e-mail/senha e sem token, retornou HTTP 400 / `captcha_failed`: “no captcha_token found”. Não houve criação de conta ou envio de e-mail. Isso confirma a exigência do token, mas ainda não valida um token real emitido pelo widget nem a entrega de e-mail.

O cadastro de teste foi habilitado com `previewRegistration=true`, após confirmar no Sites que a audiência é somente do proprietário. `publicRegistration=false` e `cloudValidated=false` permanecem. O SDK oficial é usado também nos testes privados, com CAPTCHA obrigatório, confirmação e RLS. A audiência não foi alterada. Antes de lançamento público, desativar o modo de teste, preencher controlador/contato e validar os requisitos da etapa 2.

Teste pelo responsável: abrir a prévia no Safari, selecionar Criar conta, preencher nome/e-mail/senha de no mínimo 12 caracteres, concluir o Turnstile e enviar. Confirmar o e-mail; depois voltar à aba original e entrar. Não confundir a conta do painel Supabase com uma conta do aplicativo. Se um link de confirmação abrir outra aba e falhar no retorno PKCE, voltar à aba original e tentar entrar após a confirmação; registrar o erro para ajuste. Nenhum teste positivo de cadastro/login foi declarado concluído ainda.

## Testes guiados — persistência e limite de e-mail
O responsável informou que saiu, entrou novamente e recuperou os registros da primeira conta. Ao tentar cadastrar uma segunda conta, a interface recebeu “email rate limit exceeded”, com Turnstile concluído. O teste de isolamento entre duas contas reais permanece pendente. Não foram solicitadas senhas nem registrados endereços pessoais neste relatório.

O tratamento do erro foi ajustado para mensagem em português, preservando código/status e sem repetir a requisição automaticamente. Testes de contrato do SDK e da prévia portátil passaram. A configuração SMTP do projeto não é acessível pela chave pública: ainda não foi confirmado se utiliza o serviço padrão ou um serviço próprio. Não houve alteração de cotas, desativação de confirmação/CAPTCHA ou envio de novos e-mails por ferramentas.

Documentação oficial consultada: https://supabase.com/docs/guides/auth/auth-smtp e https://supabase.com/docs/guides/auth/rate-limits. No envio padrão, o limite documentado é de 2 mensagens/hora, os destinatários são restritos à equipe e o serviço não se destina à produção. SMTP próprio e limites compatíveis precisam ser configurados para lançamento. O responsável foi consultado sobre domínio e serviço de e-mail existentes.
