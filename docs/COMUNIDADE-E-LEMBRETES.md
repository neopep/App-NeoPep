# Comunidade e lembretes — prévia

## Disponível no código
- Ícone Comunidade no cabeçalho da área autenticada. Mural e Biblioteca separados.
- Adesão voluntária com apelido público e aceite próprio. Nome privado, fotos e registros corporais não são copiados.
- Postagens de texto aguardam aprovação. Autor pode excluir e exportar suas postagens ou sair, removendo-as.
- Denúncia por membro, fila de moderação e publicação de textos e links HTTPS por administrador autorizado no servidor. Links externos abrem por escolha do leitor, sem incorporar rastreadores de vídeos.
- RLS em todas as novas tabelas; tabelas internas sem acesso direto de usuários. RPC autenticada com limites de postagem/denúncia e verificações de proprietário e administrador.
- Próximos lembretes com data e horário local e acesso aos registros. Rotina diária de peso, semanal de medidas e lembretes personalizados preservados.
- Avisos enquanto o app está aberto e exportação de eventos para agenda continuam disponíveis. A agenda precisa ter alertas habilitados e ser atualizada ao mudar os horários.

## Ativar a comunidade no Supabase
1. Faça backup antes de mudanças no banco.
2. No mesmo projeto Supabase existente, abra SQL Editor > New query.
3. Execute apenas `supabase/migrations/202611120003_community.sql` (arquivo adicional, transacional e reexecutável). Não substitui registros existentes e não altera a publicação do site.
4. Reabra a prévia, entre na conta, abra Comunidade e aceite participar com um apelido.
5. A autorização administrativa continua sendo a tabela interna `neo_private.admin_members`, configurada exclusivamente pelo responsável no SQL Editor. Nunca conceda administração pelo perfil, navegador ou metadata editável. Para cadastrar um administrador, confirme o UUID correto em Authentication > Users e execute `insert into neo_private.admin_members(user_id) values ('UUID-CONFERIDO') on conflict do nothing;`. Nenhum administrador é criado automaticamente.
6. Na conta autorizada, participe da comunidade para abrir a Biblioteca e a Moderação.
7. Valide duas contas reais antes de liberar ao público. O limite de e-mails e o acesso restrito da hospedagem continuam impedimentos separados.

## Avisos com o aplicativo fechado — código preparado, ativação pendente
A prévia inclui inscrição por dispositivo, cancelamento ao sair da conta, botão de desativação, mensagens discretas no service worker e abertura da tela de lembretes. O servidor inclui tabelas privadas de dispositivos, autorização, agenda por fuso, deduplicação diária, tentativas limitadas, descarte de inscrições expiradas e Edge Function de envio. Não há entrega real validada: faltam chaves VAPID, implantação da função e cron. O botão fica desabilitado enquanto a chave pública não estiver configurada.

A rotina de push considera horários de peso e medidas (conforme preferências de acompanhamento) e lembretes personalizados ativos. Peso/medidas já registrados no dia suprimem o aviso padrão. Cada dispositivo guarda o fuso no momento da ativação: reative após viagem. Não envia avisos atrasados em mais de dez minutos. Falhas podem causar atrasos; o sistema operacional controla a entrega. Não usar para alertas críticos.

Veja `docs/ATIVAR-NOTIFICACOES.md` para a configuração. No iPhone: iOS compatível (16.4+), app adicionado à tela inicial e permissão concedida por ação do usuário. O CAPTCHA não substitui esses requisitos. Teste entrega com app fechado e cancelamento ao sair em dispositivo real antes de anunciar o recurso.

## Limites desta primeira versão
- Compartilhamento de dados é voluntário por texto: sem publicação automática de gráficos, peso ou fotos. Compartilhamento estruturado exigirá prévia e consentimento específicos.
- Biblioteca aceita textos e links externos. Upload/streaming de vídeos e documentos não implementados.
- Mural carrega as 100 postagens mais recentes e a fila os 100 itens mais antigos; paginação e escala serão uma próxima etapa.
- Reações, comentários, bloqueio de membros, avisos de novas postagens e pesquisa não implementados.
- Moderação não é automática: o responsável precisa revisar a fila e as denúncias.
- Termos e política precisam de revisão específica sobre conteúdo compartilhado, moderação e responsabilidade do controlador antes de acesso público.
- Testes PostgreSQL locais verificam autorização, isolamento e moderação. Integração real depende de executar SQL adicional. Safari/iPhone e Web Push não foram validados nesta etapa.
