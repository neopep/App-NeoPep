# Contador e avisos de postagens

## Funcionamento
- O ícone Comunidade mostra o total de mensagens atualmente publicadas; a marca visual destaca a existência de mensagens novas de outros autores. Exibe 99+ quando o total ultrapassa 99; o rótulo acessível mantém o número completo.
- A contagem só é retornada a participantes da comunidade. Mensagens pendentes e removidas não entram no total. Após ler a conversa até o final, o destaque é removido, mas o total continua visível.
- O app consulta o contador a cada 30 segundos enquanto está visível e também ao recuperar o foco. A conversa consulta novidades a cada 15 segundos, preservando rascunhos. Não é uma promessa de atualização instantânea.
- Contagem de leitura sincronizada por conta; não armazena o texto das mensagens nas preferências.
- Menu Comunidade > Minha participação (•••) > Avisos da comunidade permite optar por receber avisos. Padrão: desativado. Sair da comunidade remove a preferência; entrar novamente não reativa automaticamente.
- Push ocorre apenas para novas publicações aprovadas de outros autores, posteriores à ativação e ainda não lidas. Mensagens antigas não geram avisos retroativos. Uma reaprovação da mesma mensagem não gera outro evento.
- O servidor usa fila própria, limites de tentativas e identificação estável por dispositivo/mensagem. Remove inscrições expiradas. Pausar avisos ou sair impede novas retiradas da fila; uma requisição já entregue ao provedor pode ainda chegar.
- Mensagem na tela bloqueada: “Há uma nova postagem na comunidade.” Não inclui autor, conteúdo, fotos ou dados corporais. Tocar abre a conversa. Com app aberto, preserva a confirmação antes de descartar um formulário não salvo.

## Ativar o banco
No mesmo projeto Supabase, SQL Editor > nova consulta, executar `supabase/setup/community-alerts.sql` inteiro. O arquivo instala a base de dispositivos push somente se ainda estiver ausente e aplica a migração 007. Reexecutável, transacional e sem envio automático. Pressupõe base e comunidade já instaladas. Não concede administração a novas contas.

## Ativar o envio real (pendente)
O frontend permanece com `pushVapidPublicKey` vazia. Sem chaves, função implantada e cron ativo, nenhum aviso em segundo plano está funcional.

1. Seguir `docs/ATIVAR-NOTIFICACOES.md` para gerar VAPID e segredo de cron, guardados somente nos segredos do Supabase. Não enviar chave privada pelo chat.
2. Publicar a versão atualizada da função existente:

```sh
supabase functions deploy push-dispatch --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
```

A função é protegida pelo segredo próprio de cron; a opção acima é exclusiva dela. O código agora consulta as filas de lembretes e comunidade, mantendo suas confirmações separadas.
3. Configurar/confirmar a tarefa a cada minuto descrita no guia. Se ela já existir, não criar duplicata: a atualização da mesma função é suficiente.
4. Configurar apenas a chave VAPID PÚBLICA em `dist/config.js` e publicar a prévia.
5. Cada participante ativa avisos da comunidade no menu e ativa o dispositivo em Lembretes. No iPhone, usar iOS compatível (16.4+) e abrir o app instalado pela tela inicial, concedendo permissão pelo botão.
6. Validar com duas contas: B ativa os avisos, A envia uma postagem, administrador aprova, B recebe no app fechado e abre a conversa. Verificar opt-out, leitura antes do envio e ausência de duplicação.

Capacidade inicial: até 20 avisos de comunidade por execução, além dos 20 lembretes. A fila considera publicações dos últimos dez minutos. Com cron a cada minuto, o envio costuma ocorrer na execução seguinte, mas não há garantia de prazo/entrega do sistema operacional. A capacidade precisa ser ampliada antes de escalar.

## Validação e limites
Testes locais verificam autorização, contagem, leitura, opt-in, aprovação, exclusão de preferência ao sair, deduplicação e mensagem discreta. SDK/Edge e provedor de push usam transporte simulado nos testes. SQL ainda exige execução pelo responsável; implantação da função e entrega real no iPhone não foram validadas. O acesso da hospedagem continua restrito à prévia existente.

## Ajuste: aviso apenas de novidades
O número sobre o ícone passa a representar somente mensagens não lidas de outros autores. Ao abrir a comunidade visível, o app confirma a leitura até o marcador capturado da conversa e o aviso desaparece após a confirmação do servidor. Novas publicações posteriores voltam a gerar o número. O total de mensagens continua disponível no convite da tela inicial e no rótulo acessível, sem manter o aviso numérico quando não há novidades. Essa alteração usa a mesma API de leitura e não requer novo SQL; depende da configuração de avisos 007 já aplicada.
