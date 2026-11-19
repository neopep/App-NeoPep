# Confirmação de e-mail pelo administrador principal

Em Administração → Configurações → Cadastro e confirmação de e-mail, consulte o estado real, marque/desmarque a exigência e aplique. O painel confirma o resultado por nova consulta à Management API. Não pressupõe nenhum estado inicial, nem muda a configuração durante instalação. Falhas bloqueiam o botão até nova consulta. A alteração vale para novos cadastros: não verifica retroativamente a propriedade de e-mails auto-confirmados, nem modifica em lote contas antigas. Recuperação de senha continua exigindo SMTP. Reativação requer testar o envio de confirmação.

## Ativação no Supabase (obrigatória)
1. Publique a Edge Function `auth-settings` com o arquivo autocontido `/workspace/NeoPeptideos-auth-settings.ts`. Use a mesma configuração de JWT das funções existentes; o código valida a sessão com getUser no servidor. Nenhuma migração SQL nova é necessária; a autorização `neo_integration_admin` da atualização 021 deve existir.
2. Em Edge Functions → Secrets, configure:
   - `ALLOWED_ORIGINS`: origem HTTPS exata do aplicativo (sem caminho/barra final), separadas por vírgula se necessário.
   - `NEO_AUTH_ADMIN_IDS`: UUID da SUA conta de usuário do aplicativo, obtido em Authentication → Users. Não é o ID da conta ChatGPT. Ela também precisa ser administradora no banco. Não inclua administradores comuns.
   - `NEO_SUPABASE_PROJECT_REF`: referência de 20 caracteres do mesmo projeto de SUPABASE_URL.
   - `NEO_SUPABASE_MANAGEMENT_TOKEN`: token de acesso à Management API criado no painel de conta Supabase. Não é anon/publishable nem service_role. Essa credencial pode ter poderes amplos: use uma conta técnica com acesso mínimo ao projeto quando disponível. Nunca cole no chat, código do aplicativo ou formulário. Revogue/renove pelo painel quando necessário.
3. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos pelo ambiente Edge; não colocar no navegador.
4. Publique a versão web, entre na conta principal, consulte o estado, teste desativar/criar conta de teste e reativar/criar outra conta com confirmação e SMTP funcionando.

A função aceita somente status/set e altera apenas mailer_autoconfirm no projeto fixado nos Secrets. Requer origem autorizada, identidade válida, conta na lista do servidor e permissão administrativa atual. O estado anterior esperado evita sobrescrever um formulário já desatualizado; a API externa não oferece uma transação com esse formulário, portanto evite alterações simultâneas pelo dashboard/outros administradores. Timeout após PATCH pode significar alteração aplicada: consulte de novo antes de repetir.

Eventos de alteração solicitada são registrados nos logs da função com ator, horário e estados, sem tokens ou e-mails. São logs operacionais com a retenção do plano, não um histórico permanente. Desativar a função ou remover o token bloqueia este controle sem alterar o estado do Auth. O painel oficial do Supabase continua sendo alternativa para ativar/desativar, mesmo se o aplicativo estiver indisponível.

Documentação: https://supabase.com/docs/reference/api/v1-update-auth-service-config
