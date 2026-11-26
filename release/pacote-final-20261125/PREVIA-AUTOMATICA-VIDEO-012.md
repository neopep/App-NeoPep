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

## Continuação — fila e backfill
- Inventário somente leitura: Produção 4 vídeos vinculados (60.276.944 bytes), 3 pertencem a contas com dispositivo aprovado; Teste 1 vídeo vinculado com dispositivo aprovado. Não baixar nem compartilhar originais por fora da autorização existente.
- Candidata SQL prepara fila privada, deduplicação por revisão Storage, trigger de anexação, backfill de metadados e leases com fence, limite de tentativas, confirmação do Storage e gate separado desativado. Worker Node isolado usa transporte fornecido pelo host autenticado; integração no Connect e provimento FFmpeg ainda necessários. Acesso restrito ao proprietário, sem delegação implícita. Artefatos órfãos exigem limpeza autorizada posterior pela API Storage. Não aplicado em nenhum banco. Sem processamento real.
- CI anterior da Produção aprovada (503 passed, 1 skipped: conversão sem FFmpeg). Ensaio local equivalente de comandos FFmpeg sobre vídeo sintético revelou duração 5,75s; ajuste de timestamps/padding produziu 5,83s, 266031 bytes, H.264 270×480 sem áudio. Teste integral do módulo e integração de fila ainda precisam confirmação. Nenhum deploy.

## Integração Windows candidata
- Host Windows consulta fila após heartbeat, sem depender do WhatsApp, só quando conversor local está disponível e gate servidor permite. Download limitado, conversão em subprocesso local sem credenciais, upload privado sem sobrescrever, confirmação por fence, isolamento de ambiente e conta. O instalador candidato inclui os scripts, não os binários FFmpeg/FFprobe. Provisionamento de binários com origem, versão, SHA-256 e licença ainda precisa ser concluído. Nenhum release, migração ou deploy. Testes de compilação e execução pendentes.

## Fechamento candidato — provisionamento e editor
- O bucket de distribuição do Connect tem limite de 50 MiB; o FFmpeg ZIP 9.0.2 tem 114.768.076 bytes. O instalador permanece leve: botão explícito Preparar prévias de vídeo baixa diretamente do distribuidor indicado pelo FFmpeg, versão fixa, tamanho e SHA-256 conferidos (Gyan e GitHub), extrai somente os dois executáveis e licença, sem credenciais Supabase. Compartilha a pasta por versão do conversor entre os perfis, sem redistribuir binários. Código ainda requer teste real do download e extração Windows.
- Seletor no editor de capa+link, prévia curta+link e original. Originais e prévias só quando a capacidade de envio é confirmada e o arquivo permite download. Limite atual de 5 MiB para originais; prévia 500 KiB. A prévia reproduz em loop e sem áudio no editor, respeitando movimento reduzido. Usa o contrato de arquivo existente e bloco de link separado. Não há promessa de autoplay no WhatsApp. Nenhum gate de envio alterado.
- Corrigida incompatibilidade C#5 (await no catch); compilação anterior confirmada. CI desta rodada, ensaio SQL, provisionamento em máquina real, compatibilidade de versão 0.2.15 com gates e release assinado ainda pendentes. Nenhuma migração, release, geração real ou deploy.

## Compatibilidade 0.2.15 — candidata, sem ativação
- Candidata de arquivos originais aceita explicitamente o Connect 0.2.15, preservando versões anteriores autorizadas e exigindo capacidade originals_v1, autorização e gate de originais. Sem alteração no limite de 5 MiB dos anexos de campanha. A biblioteca continua independente.
- Consulta em ambos os ambientes: rich_enabled=true, dispatch_enabled=false, três mensagens no estado accepted; sem leases em andamento nessa fotografia. A proteção da migração de Produção permanece; NÃO pausar envios ou executar migração automaticamente. A compatibilidade da RPC de despacho legado de Produção (versão fixa 0.2.13) ainda precisa ser resolvida em conjunto e testada antes de atualizar o dispositivo. Revalidar as migrações dependentes e as definições/fingerprints.
- Upload retomável: CI das revisões corrigidas aprovada nos dois ambientes. Ainda exige teste real com rede interrompida.
- Solicitação de compilação privada 0.2.15 Teste registrada (fonte e798a5ae729e07aa930febdb00abb873aaf8d5cf; já compilada na CI). Não distribuído nem assinado para instalação. Nenhuma mudança no Supabase ou deploy Vercel nesta rodada.

## Despacho legado — revisão 0.2.15
- CI das candidatas anteriores aprovada: 45812781308 e 45812803553. Produção: RPC de heartbeat usa versão exata 0.2.13, fingerprint 62d9843fac2b58925416672f52e2d2f5; helper de prontidão não verifica versão. Teste: heartbeat não contém versão fixa. Candidata SQL `campaign_official_dispatch_0215_candidate.sql` altera somente o predicado da versão para 0.2.13/0.2.14/0.2.15, preservando autenticação e todos os gates. Exige migração de originais e janela sem processamento; não pausa nem ativa nada. Não aplicada. Não publicar 0.2.15 a dispositivos de Produção antes de homologar o conjunto.
- A consulta de execuções do repositório privado pela API genérica foi recusada; pedido de build permanece registrado em release-requests/0.2.15-staging.json. Sem confirmação de artefato, sem distribuição.

## Homologação real — 26/11/2026
- Connect 0.2.15 aprovado em Teste, instalado e online nos dois perfis. Primeira prévia real Teste pronta às 12:04:16 UTC, 311.994 bytes, MP4, uma tentativa; conferidos estado e metadados privados. Reprodução visual e envio de campanha ainda não homologados.
- Produção: aplicadas as migrações library_video_preview_queue_20261126 e library_video_preview_capacity_200mb_20261126; quatro registros de fila. Nos dois bancos aplicada library_video_preview_respect_download_20261126 (ver arquivo SQL correspondente), que exige allow_download=true para processar/ler a prévia. Teste preservou a prévia pronta. Produção: três fontes permitem download, duas têm proprietário com dispositivo online. Fila independente habilitada; não foi alterada a fila de WhatsApp. Capacidade da Biblioteca em Produção ainda não migrada; plano Free permanece.
- CI da correção do heartbeat de Produção (45813135977) aprovada; migração ainda não aplicada. Não houve deploy Vercel.
