# Ajuste 012 — Prévia automática de vídeo (candidata, sem deploy)

## Contrato aprovado
- Biblioteca: gerar automaticamente ao cadastrar vídeo e preparar os existentes em lote. Separar a miniatura JPEG 160 px da prévia MP4. Não baixar o original durante a listagem.
- Prévia: até 6 segundos, idealmente 3 trechos de 2 segundos, evitar trechos escuros, sem áudio, H.264 baseline, lado maior até 480 px, até 500 KiB. Respeitar proporção; vídeo curto pode gerar prévia menor. Nenhuma promessa de autoplay no WhatsApp.
- Editor: Capa + link (legado), Prévia animada + link, Arquivo original. A prévia é vídeo curto com legenda/link, não GIF nativo. PDF mantém capa + link ou original.
- Reutilizar prévia gerada, não regenerar a cada campanha. Não usar a miniatura JPEG como mídia animada.
- Manter gates e revisão de envio integral. Não alterar pagamentos, IA, nem permissões do catálogo. Não disparar mensagens de teste para grupos reais.

## Implementado nesta rodada
- Módulo isolado connect/whatsapp-lab/video-preview.mjs: recebe bytes autorizados pelo futuro worker, chama executáveis FFmpeg/FFprobe locais provisionados via caminhos absolutos (sem shell, sem download automático), amostra trechos, evita trechos majoritariamente escuros, codifica H.264 sem áudio e valida tamanho/duração/formato. Diretório temporário exclusivo e limpeza ao finalizar. Testes unitários e teste de conversão com vídeo sintético quando FFmpeg disponível.
- Não incluído no instalador 0.2.14, não ligado ao worker ou à Biblioteca, não habilitado na interface. A preparação inicial não equivale à funcionalidade automática entregue.

## Próximas etapas obrigatórias
1. Provisionamento de versão fixa e verificada dos binários para Windows; verificar licença, hash, compatibilidade, distribuição e impacto no tamanho do instalador. Não executar binário obtido de URL arbitrária nem depender do PATH para produção.
2. Fila autenticada por ambiente, deduplicada por material + versão do arquivo + algoritmo; registro de estados pendente/processando/pronto/falha, lease com fence e limite de tentativas. Enfileirar por publicação/alteração autorizada do material e backfill idempotente dos vídeos existentes. Não processar mídias sem autorização; revogação, exclusão e troca de conta invalidam tarefas. Worker Windows baixa apenas a origem autorizada com URL assinada curta, limita bytes e tempo e persiste derivado em bucket privado. Evitar qualquer ampliação de permissões ou exposição de link assinado na mensagem.
3. Integrar seletor ao editor com capacidade confirmada pelo servidor, renderização em loop e mudo apenas para prévia pronta, fallback explícito para capa + link. Referência e modo persistidos na revisão, sem baixar arquivo integral no catálogo. Manter aprovação independente de anexos bloqueada até validação de acesso.
4. Adaptar contrato de mídia do Connect, atualmente MP4/PDF condicionado aos gates de originais; enviar prévia MP4 com legenda/link apenas após homologação. Não forçar gifPlayback sem teste real. Verificar versão e capacidade, limites, idempotência, retenção e entrega. Validar com mídia fictícia em ambiente isolado.
5. Validar CI, fila, cancelamento, segurança, desempenho, dispositivos iOS/Android/Windows, pacote assinado, e somente então publicar conforme autorização. Nenhum deploy ou SQL aplicado nesta rodada.
