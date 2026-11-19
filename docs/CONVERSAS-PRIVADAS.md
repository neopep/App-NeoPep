# Comunidade: shell único e atendimento privado

## Organização atual
Grupo é o mural coletivo anterior, preservando envio, resumo, foto, arquivo, marcador de leitura e regras de publicação. É a aba padrão em toda abertura da Comunidade.

Conversa é o canal privado entre cada participante e a equipe de administração. Não permite conversas entre participantes comuns. Cada pessoa possui um atendimento próprio, persistido no banco e acessível após novo login ou em outro dispositivo.

Biblioteca mantém materiais e publicação editorial. Moderação usa o mesmo espaço de mensagens e as mesmas bolhas do Grupo, com ações para revisar e uma barra explicativa. Não envia notas de revisão ao Grupo nem inclui um compositor público nessa fila.

Todas as abas mantêm título Comunidade, voltar, controles e três pontos verticais no topo. Somente o conteúdo inferior muda, sem voltar ao cabeçalho ou à navegação externa do app. A rolagem horizontal das abas é preservada em atualizações.

## Conversas privadas
Participantes veem somente seu histórico com a equipe. administradores veem lista de atendimentos com nome, última mensagem, data e contador de mensagens novas. Ao abrir um item, o chat aparece dentro da mesma aba, com botão de voltar para a lista. O papel de administração continua sendo o administrador autorizado em `neo_private.admin_members`.

Mensagens têm bolhas por remetente, horário, rascunho por atendimento e limite de 4.000 caracteres. Atualização automática a cada dez segundos com a aba visível e sem rascunho. Não é uma promessa de atualização instantânea. O servidor confirma a leitura quando abre o histórico, sem marcar mensagens que tenham chegado depois do marcador capturado.

Histórico abre as últimas 100 mensagens e permite carregar as anteriores, que permanecem visíveis durante novas atualizações. A caixa da equipe mostra os 200 atendimentos mais recentes; paginação dessa lista e pesquisa são melhorias de escala futuras.

Esta versão do chat privado aceita texto. Anexos, áudio, atribuição individual de administrador e notificações push de atendimento não foram implementados. Os anexos existentes do Grupo continuam funcionando. O conteúdo privado não é misturado ao Grupo, à Biblioteca, aos contadores públicos nem ao painel agregado de administração.

## Segurança e dados
Tabelas privadas com RLS ativada e sem privilégios diretos aos usuários. Todas as operações passam por RPC com identidade validada, autorização por proprietário ou equipe e validação do texto. Metadata editável e parâmetros do navegador não podem conceder permissão de administrador nem forjar remetente da equipe. Limite de 60 envios por minuto por conta e IDs estáveis impedem duplicação na repetição de um envio cuja resposta se perdeu.

Trocar de conta ou sair limpa conversas, rascunhos e requisições em memória. A remoção de permissão impede leitura posterior. Exportação pelo Perfil inclui o próprio atendimento quando a nova API estiver instalada; nunca exporta atendimentos alheios. Exclusão de conta em auth.users remove o atendimento dessa pessoa e suas mensagens por cascata, inclusive mensagens que ela tenha enviado como administradora. Não há cópia automática de registros corporais, doses ou fotos para o atendimento.

## Ativar no Supabase
1. No mesmo projeto atual, abrir SQL Editor > nova consulta.
2. Executar `supabase/migrations/202611120011_private_conversations.sql` inteiro. Reexecutável e transacional, depende da base de autenticação/perfis da etapa 2. Não apaga nem altera as postagens da comunidade.
3. Atualizar a prévia. Para participante, abrir Comunidade > Conversa e enviar texto de teste.
4. Em outra conta já autorizada como administradora, abrir a mesma aba, escolher o atendimento e responder.
5. Voltar à conta participante, confirmar a resposta e verificar que outra conta comum não vê esse atendimento. Verificar também persistência após logout/login.

Sem executar o SQL, a interface identifica que a configuração privada está pendente e não oferece envio simulado. Não há chaves adicionais ou serviço externo novo. Não é necessário republicar a função de exclusão somente por causa do chat textual, pois os dados usam cascata do banco; pendências anteriores de exclusão de arquivos permanecem separadas.

## Validação
Testes PostgreSQL: isolamento entre contas, tentativa de forjar remetente, autorização da equipe, contadores de leitura, histórico paginado, idempotência, revogação de papel, exportação própria e cascata na exclusão. Testes DOM: cabeçalho igual entre abas, Grupo padrão, lista e abertura na mesma aba, rascunhos separados, escape de texto, descarte de resposta ao trocar conta e retentativa sem duplicação. Continuam pendentes o teste real com duas contas no Supabase após executar o SQL e a conferência do Safari/iPhone. O ambiente gerenciado não dispõe de cua_repl.js para QA visual nesta execução.
