# Conversa da comunidade — evolução da prévia

## Experiência
- Aba Conversa com mensagens em ordem cronológica, próprias à direita e demais à esquerda.
- Compositor embaixo da conversa, campo de texto, Enviar, Foto e Compartilhar resumo.
- Usuário comum não vê a aba Moderação. O botão diz somente Enviar. A revisão continua no servidor, com estado Enviado / aguardando aprovação, sem simular entrega imediata aos demais membros.
- Conversa coletiva entre membros, não mensagens privadas. Atualização por consulta a cada 15 segundos quando a conversa está visível e sem rascunho, além do botão Atualizar. Não há promessa de atualização instantânea ou de notificações de novas mensagens.
- Biblioteca e ferramentas administrativas preservadas. Opções de exportar e sair ficam separadas em Minha participação.

## Resumo e fotos
- Resumo calculado no servidor exclusivamente a partir dos registros do autor. Ele escolhe indicadores: variação de peso, dias de acompanhamento, peso atual e meta. Os dois primeiros são sugeridos; nada é enviado sem prévia e confirmação específica.
- Não inclui nome civil, e-mail, nascimento, altura, aplicações, diagnósticos, observações ou fotos privadas.
- O resumo é um retrato do momento do envio. Alterar o perfil depois não atualiza uma mensagem já compartilhada. Se os valores mudarem entre a prévia e o envio, o servidor pede nova prévia.
- Fotos são selecionadas pelo usuário, processadas em canvas (JPEG, resolução até 1800 px, remoção dos metadados do original) e guardadas no bucket privado `neo-community`. Não copia nenhuma foto de `neo-private`.
- Limite de entrada de 5 MB, formatos JPEG/PNG/WebP. HEIC precisa ser convertido para JPEG/PNG antes de selecionar.
- Permissões de leitura: autor; administrador para revisão; membros para fotos de mensagens aprovadas. URLs temporárias de 60 segundos são credenciais de acesso transitórias; podem permanecer válidas até expirar após remoção da mensagem.
- Consentimentos de texto, resumo e foto separados. Mensagens com somente foto ou resumo são permitidas após a atualização SQL.
- Rascunhos ficam somente na memória e são eliminados ao trocar de conta. Campos e anexos não são restaurados após recarregar a página.
- Mensagens enviadas usam identificador estável para evitar duplicação ao repetir uma operação cuja resposta se perdeu.

## Ativação no projeto existente
1. Fazer backup e abrir SQL Editor > nova consulta no mesmo projeto Supabase.
2. Executar `supabase/migrations/202611120005_community_chat.sql` inteiro. Depende da comunidade 003 e da base 001/002 já instaladas; não depende da configuração de push 004. Migração adicional, transacional, reexecutável, preserva mensagens e administradores.
3. Atualizar a prévia. Até executar o SQL, texto continua usando a API anterior e os botões Foto / Resumo ficam desabilitados com explicação.
4. Publicar novamente a função existente `delete-account`, cujo código agora remove arquivos tanto de `neo-private` quanto de `neo-community` antes de excluir a conta:

```sh
supabase functions deploy delete-account --project-ref cpslafpzjtbpmoxxysaa
```

Manter a configuração segura de origem e autenticação existente. A implantação da função exige acesso ao projeto e não foi feita automaticamente. Não anunciar exclusão integral de anexos da comunidade antes de validar essa função em ambiente de teste.

## Arquivos órfãos
Após exclusão de mensagens ou saída da comunidade, o navegador tenta limpar fotos próprias sem mensagem associada. Há também um botão Limpar fotos não utilizadas. A limpeza preserva arquivos com menos de uma hora para não interferir em outro envio ainda em andamento; arquivos com referências ativas são sempre preservados. Falhas de conexão podem deixar arquivos fisicamente armazenados até uma nova limpeza, sem acesso aos demais membros após remoção da referência. Uma rotina periódica de limpeza no servidor fica como melhoria operacional antes de escalar a plataforma.

## Validação
Testes PostgreSQL exercitam resumo escolhido, adulteração rejeitada, consentimentos, identificação do autor, fotos pendentes/inacessíveis a outra conta, acesso por administrador, aprovação, exclusão e reexecução da migração. Testes DOM verificam alinhamento por proprietário, ordem de conversa, compositor depois das mensagens e ausência de moderação para usuário comum. Testes anteriores de registros, cálculo, privacidade, PWA e autenticação permanecem necessários.

Validar Safari/iPhone real: teclado virtual, campo inferior, rolagem, foto da galeria, consentimentos, perda de conexão, troca de conta e aprovação vista em outra conta. Teste visual automatizado indisponível nesta execução por ausência de `cua_repl.js` no ambiente gerenciado. Nenhuma foto real de usuário foi consultada nem enviada durante o desenvolvimento.

## Compositor compacto e resumo ampliado
A conversa passa a ocupar a largura e a altura disponíveis, com cabeçalho compacto e botão de voltar. A navegação principal reaparece ao sair da conversa. O menu + abre foto e escolha dos indicadores. A prévia fica na mesma superfície do campo de mensagem, atualiza ao selecionar categorias e rejeita respostas atrasadas de seleções anteriores. Enviar constitui a ação explícita de compartilhamento; não há checkbox adicional de texto, resumo ou foto. Uma frase curta informa o destino do conteúdo antes do envio. A aprovação pelo administrador continua em vigor.

O resumo inclui as opções de variação de peso, dias, peso atual, meta, peso inicial e altura; também permite selecionar peso, medidas, diário, aplicações, protocolos e lembretes (últimos três registros de cada categoria). A seleção de uma categoria inclui os detalhes e observações desses registros, mostrados integralmente na prévia rolável. Fotos são adicionadas separadamente pelo menu +; não há publicação automática de fotografias de evolução nem de dados de autenticação. Não são compartilhados identificadores técnicos dos registros. O resumo tem limite de 32 KB e pode pedir para selecionar menos categorias quando observações muito longas excederem o limite.

Para ativar as categorias novas, executar a migração adicional `202611120006_community_summary.sql` no mesmo SQL Editor após a 005. É reexecutável e não altera mensagens existentes, dados de saúde nem permissões. O envio direto e o novo layout já funcionam com a API atual; campos novos dependem deste SQL. Se a resposta de prévia indicar função anterior, a interface orienta executar a atualização.

## Correção dos seletores e da exibição de fotos
Regra global `[hidden]` com prioridade impede que estilos genéricos de inputs revelem os seletores nativos de foto e backup. A função de backup é preservada; o seletor só abre por sua ação correspondente. Na conversa, foto, resumo, informação de compartilhamento e opção de enviar estão no menu +; a seta continua oferecendo envio direto.

Fotos na conversa recebem dimensões explícitas e carregamento imediato para evitar área vazia em rolagem interna. Falhas exibem Tentar novamente e renovam a URL temporária. Quando uma mensagem própria rotulada Foto compartilhada chega sem metadados de anexo, a interface tenta recuperar a referência pelo export autenticado exclusivo do autor. Não relaciona fotos órfãs por aproximação e não consulta fotos de outras contas. Se nenhuma referência existir, informa a ausência em vez de apresentar só o rótulo como se fosse uma foto carregada. Nenhuma imagem real do usuário foi acessada nesta correção. Verificação em Safari real ainda depende do dispositivo do usuário.

## Entrada direta, chamada inicial e publicação administrativa
A tela inicial inclui uma chamada para Comunidade antes do painel e do card principal. O contador alimenta a chamada sem inventar atividade: dados ausentes usam texto de convite, sem números fictícios. Ao abrir a comunidade autenticado, o app entra usando o primeiro nome do perfil, sem novo formulário de apelido. Um apelido já escolhido anteriormente é preservado. Abrir a área não publica registros corporais nem ativa avisos push. O convite informa o uso do nome e a privacidade dos registros.

A migração `202611120008_community_entry.sql` adiciona entrada autenticada derivada do perfil e aprovação automática somente na inserção de novas mensagens de administradores existentes. O papel vem de `neo_private.admin_members`, não de campos editáveis no perfil ou do payload. Essas são as contas que hoje possuem permissão de moderação; não foi criado um papel independente de administrador nem foram concedidas permissões a novas pessoas. Mensagens de participantes comuns continuam pendentes. Mensagens antigas não são aprovadas em lote. O trigger roda antes do evento de publicação, preservando a contagem e a fila de avisos da 007, quando instalada.

Para ativar no Supabase: SQL Editor > nova consulta > executar a migração 008 inteira, depois atualizar o app. Não precisa repetir migrações anteriores. A entrada direta tem compatibilidade com a API anterior usando o primeiro nome do perfil local já sincronizado, até a 008 ser aplicada; a aprovação automática depende obrigatoriamente da migração. O arquivo é transacional e reexecutável, e depende da base 002 e comunidade 003 já instaladas.

A aparência usa superfícies mais brancas e leitosas no modo escuro, com bordas e brilho discretos e transparência preservada. Alterações de cores limitadas à tela, sem mudar a exportação impressa/PDF. Conferir contraste e aparência em iPhone real; o ambiente gerenciado não dispõe de `cua_repl.js` para validação visual nesta execução.

## Última mensagem, marcador e documentos
- Toda abertura explícita da Comunidade abre Conversa e vai ao final. O carregamento de imagens mantém o final visível até a primeira interação do usuário.
- A API v2 captura o marcador de leitura anterior ANTES de confirmar a abertura. O separador Novas mensagens aparece antes da primeira publicação de outro membro com sequência posterior à leitura anterior, dentro das 100 mensagens disponíveis. A confirmação de leitura para limpar o badge continua acontecendo ao abrir.
- O separador não some com rolagem automática ou atualizações internas. Some após interação de ponteiro, toque, roda do mouse ou teclado na comunidade e não reaparece durante a mesma visita. Uma nova abertura consulta novamente a posição de leitura do servidor; não usa dados inventados.
- Menu + tem Foto, Arquivo e Resumo. A seleção de resumo tem seu próprio Concluir, que fecha o menu e mantém a prévia no compositor. Envio ocorre somente pela seta da mensagem, permitindo adicionar texto ou outros anexos antes.
- Menu e prévia preservam scrollTop durante reconstruções, e o foco do seletor é restaurado com preventScroll. Respostas antigas de prévia continuam sendo descartadas.
- Arquivo: um PDF ou TXT por mensagem, até 5 MB, podendo acompanhar foto e resumo. Não inclui upload de executáveis, HTML ou outros formatos. O cliente verifica assinatura PDF e rejeita texto binário. O bucket impõe tipo/tamanho e a RPC valida proprietário e compartilhamento.
- Arquivos no bucket privado neo-community-files. Upload reservado ao autor. Autor acessa seus arquivos; administradores revisam anexos efetivamente enviados; demais membros acessam somente mensagens aprovadas. Download por link temporário de 60 segundos, preservando o nome. O documento não é incorporado como HTML executável no app.
- Registro da mensagem e vínculo do documento são confirmados na mesma transação. Retentativa usa o mesmo ID sem duplicar. Remover uma mensagem revoga o acesso dos demais; URLs emitidas anteriormente podem continuar válidas até expirar. Limpeza de órfãos tenta remover arquivos próprios sem referência após uma hora, preservando uploads recentes. Continua recomendada uma limpeza operacional no servidor antes de escalar.

### Ativação
Executar `supabase/migrations/202611120009_community_files.sql` inteiro no mesmo SQL Editor, após as configurações de conversa 005 e avisos 007 já instaladas. Migração adicional, reexecutável e transacional, não remove mensagens nem arquivos existentes. Sem ela, o menu simplificado e a preservação da rolagem funcionam, mas Arquivo fica desativado e o separador exato não é apresentado.

Atualizar também a função de exclusão para incluir o bucket de documentos, após executar o SQL:

```sh
supabase functions deploy delete-account --project-ref cpslafpzjtbpmoxxysaa
```

A função atualizada limpa os três buckets privados antes de excluir a conta. A implantação depende de acesso ao projeto e não foi executada nesta etapa. Não afirmar exclusão integral de documentos antes da implantação e validação real. Fotos e dados de saúde existentes continuam usando seus buckets e políticas anteriores.

Testes locais cobrem ordem e posicionamento no fim, captura do separador, descarte na interação, scroll estável entre respostas assíncronas, menu sem botões de envio extras, upload/download de documentos, consentimento, operação atômica, deduplicação, RLS e exclusão. Safari/iPhone real ainda precisa ser conferido: teclado, rolagem, seleção de PDF pelo app Arquivos e download. Sem cua_repl.js, não houve teste visual automatizado nesta execução.

## Engrenagem, publicação livre e compartilhamento individual
O menu da comunidade é aberto exclusivamente pela engrenagem no topo, disponível aos participantes. Inclui Avisos da comunidade para todos. A seção que permite liberar novas publicações sem aprovação só é retornada e exibida para administradores autorizados que atualmente exercem moderação. A RPC rejeita edição de usuários comuns e não revela a configuração global a eles. Com aprovação exigida, somente administradores publicam diretamente; com a opção desativada, novos envios de participantes são publicados automaticamente. Alterar a configuração não aprova retroativamente mensagens antigas.

A migração 010 cria configuração privada com RLS e permissões restritas, preserva o padrão atual de exigir aprovação e não concede papéis administrativos. A opção deve ser alterada conscientemente pela engrenagem após executar a migração. Novos participantes passam a ter a preferência de avisos ativada desde a entrada, sem ativar a permissão do navegador por conta própria. Preferências existentes, inclusive desativadas, são preservadas, pois o histórico anterior não distingue um valor padrão de uma escolha explícita. O usuário pode desativar e reativar. Não são enviados avisos retroativos; os requisitos de Web Push continuam pendentes até configuração real. O atalho Configurar este dispositivo foi removido desse painel.

Foram retirados da interface comunitária denúncia, exportação geral, saída com exclusão em lote e limpeza técnica de arquivos. Recursos de exportação e exclusão de conta do Perfil continuam disponíveis. Registros, arquivos, denúncias antigas e APIs anteriores não foram apagados. O export próprio ainda é usado internamente apenas para recuperar metadados de fotos quando necessário.

Cada postagem possui um ícone Compartilhar. Ele abre o compartilhamento nativo com texto e indicadores daquela postagem; quando indisponível, copia esse texto para a área de transferência. Não envia dados de outras postagens nem URLs privadas temporárias. Fotos/documentos são mencionados pelo conteúdo/nome, mas seus arquivos binários não são compartilhados por esse botão nesta versão. O destinatário é escolhido pelo usuário no compartilhamento do sistema, sem envio automático pelo app. Ao lado, um ícone pequeno de ações aparece somente para autor ou administrador, com exclusão individual e ações de moderação permitidas. Não há mais o texto Opções ocupando a mensagem.

Ativação: executar `supabase/migrations/202611120010_community_settings.sql` inteiro no SQL Editor do mesmo projeto, com a comunidade e avisos 007 já configurados. Migração transacional e reexecutável; preserva a configuração que o administrador já tenha salvo em execuções anteriores. Testes locais verificam edição e leitura por papel, impossibilidade de autopromoção via metadata, publicação livre reversível, padrões de aviso, preferências preservadas, compartilhamento por postagem e ausência dos controles removidos. Interface real e compartilhamento no iPhone precisam de validação no dispositivo.
