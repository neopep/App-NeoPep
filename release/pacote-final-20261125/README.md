# Pacote final de 25/11/2026

O pacote preserva os ajustes das PRs #68 e #69, incluindo as três seringas, os cálculos e o saldo consultado das aplicações vinculadas ao frasco. Da branch parcial, aproveita apenas a preseleção visual e a direção de paleta neutra. O código para enviar PDF ou MP4 original fica fora do pacote.

Os controles da primeira tela são preselecionados no formulário. A RPC só recebe as escolhas depois de OK. O botão Agora não conclui a etapa sem gravar novas concessões. Localização e notificações solicitam a autorização nativa no gesto de confirmação, conforme suporte e configuração. A região aproximada usa a conexão, e as coordenadas GPS são descartadas. As logos derivam do PNG RGBA fornecido. O ícone mascarável tem margem própria e mantém as proporções e transparência.

Os três SQLs versionados alteram somente a Central e sua fila.

- Exclusão lógica cancela itens aguardando ou apenas reservados pelo worker, mantém resultados e recibos e recusa a exclusão durante um envio iniciado ou com despacho legado pendente.
- Capas de PDF e vídeo passam pelo contrato de imagem JPEG. O servidor executa a leitura autorizada da Biblioteca, confere o arquivo JPEG privado do administrador e mantém título, legenda e URL do material no ambiente correto. A mídia original permanece no leitor privado.
- A agenda semanal cria ocorrências atomicamente para até 24 datas dentro dos próximos 89 dias. Exige confirmação da lista exata e usa as validações de destino e idempotência existentes. Pausa ou cancelamento neutraliza itens que ainda não iniciaram. Editar as datas substitui pendências numa transação, mantendo a série anterior e os recibos.

O ensaio SQL deve ser feito em transação revertida em cada projeto antes da aplicação. Uma reversão de interface é independente do banco. Em incidente, as filas e flags existentes operam como bloqueio de despacho. Preservar as novas colunas, séries e auditoria já registradas. Testes automatizados usam somente filas simuladas ou transações revertidas.
