# WhatsApp — contrato candidato de álbum

Baileys 7.0.0-rc14, `lib/Utils/messages.js`: `album` gera `albumMessage`; `albumParentKey` gera associação `MEDIA_ALBUM` em cada filho. O provider usa essas duas APIs. O bridge aceita o comando somente com a opção de construção `enableAlbums`, desligada no ponto de entrada Windows.

## Limites e legendas

- Candidata JPEG: duas a quatro imagens, 5.242.880 bytes por imagem e 10.485.760 bytes no total. Base64 e JSON continuam abaixo do teto de IPC de 16 MiB.
- Legenda individual com até 1.000 unidades UTF-16, preservada sem trim. Legenda vazia é válida. Legenda geral exige validar representação no cliente real; o payload pai do rc14 expõe somente contagem de imagens e vídeos. Para texto separado, usar um bloco textual nativo fora do álbum.
- O pai informa zero vídeos nesta entrega. O futuro suporte misto exige validar os tipos, contagem, limites, upload e preview em separado.

## Integração requerida

1. Editor e MCP compartilham um bloco com IDs estáveis dos itens, ordem, referências privadas e modo de legenda. Seleção em lote e reordenação alteram o rascunho e preservam IDs em edições. Modo individual é escolha editorial anterior à confirmação e gera blocos de imagem existentes. Sem fallback automático depois de enfileirar.
2. Supabase valida limites e mídia privada no preparo e na execução. O álbum é uma unidade de fila por destino e ocorrência. Cada tentativa armazena recibo do pai, dos filhos por posição e estado incerto de qualquer elemento não confirmado. Preservar as regras nativas de pausa, recorrência e autorização. Usar fence/idempotência persistentes, inclusive entre processos e reinstalações.
3. Capacidade candidata `album_v1` deve ser distinta de `image5_v1`. Exigir versão homologada, heartbeat, conectividade e autorização nos gates de claim e start. Sem suporte, deixar o álbum bloqueado, inclusive se as imagens forem de até 1 MiB. Nunca decompor silenciosamente o álbum em disparos.
4. O Windows deve persistir ou registrar como incerta toda tentativa iniciada, inclusive se o bridge encerrar antes de responder. Aceite local/pelo transporte não comprova entrega nem leitura. Nenhuma repetição automática após início incerto. A trava em memória do bridge só cobre uma sessão e complementa a trava persistente.
5. Antes de liberar o capability, homologar a apresentação nativa em grupo de teste autorizado com os clientes WhatsApp usados pelo projeto. Verificar ordem, 2 e 4 imagens, legenda por mídia, formatação, troca de sessão, perda de conexão após o pai e falha após filho aceito. Integrar ao pacote Windows e publicar Produção, verificar, então Teste.
