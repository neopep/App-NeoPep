# Especificação máxima — #013 Central integrada de Campanhas / WhatsApp / App / NeoPep Connect
Versão 2.0 | 24/11/2026 | Estado: PLANEJADO. Esta especificação documenta a UX desejada e separa contratos existentes de capacidades ainda não confirmadas.

## 0. Decisão de arquitetura e objetivo
- A Central já tem **App** e **WhatsApp**, com listagem de campanhas separadas. Mantê-las.
- Na aba App, preservar o criador atual de campanha interna, pop-up e notificações push; só adicionar ação de reaproveitar no WhatsApp e integração de publicação cruzada.
- Na aba WhatsApp, manter lista de campanhas, Publicações/esteira, Grupos e NeoPep Connect. Substituir **o formulário de criação/edição da campanha WhatsApp** por um editor visual full-screen semelhante à conversa do WhatsApp.
- Não criar outro Connect, outra fila concorrente nem segunda base isolada de grupos; utilizar contratos existentes e estendê-los quando comprovadamente necessário.
- Criar campanha, selecionar destinos, publicar/agendar em poucos passos, sem fluxo duplicado de Salvar campanha e depois Nova divulgação.
- Toda etapa é incremental; automação de envio real é etapa independente, só ativada após validação legal/técnica/operacional e autorização.

## 1. Inventário técnico verificado
### Frontend atual — main consultada em 24/11/2026
dist/admin/whatsapp-navigation.js possui abas Publicações, Grupos, NeoPep Connect e contém instrução de escolher grupos manualmente no WhatsApp.
dist/admin/admin-whatsapp.js possui:
- Prévia em modos Painel (compartilhamento manual com mídia separada) e Connect (simula imagem com legenda).
- Seletor de grupos sincronizados por cloud.campaignWhatsAppSync('catalog'), com estados eligible, stale, disconnected e unavailable.
- Seleção inicial de destinatários por campanha; limite atual de até **30 grupos distintos e elegíveis** no seletor web, sem considerar duplicata do mesmo grupo entre conexões. É um limite implementado no frontend atual, não necessariamente a capacidade futura.
- Formulário de data, horário, fuso America/Sao_Paulo, recorrência, lembrete; operação schedule cria publicação, mas o fluxo web registra confirmação de postagem **manual**.
- Rótulos de status pending, scheduled, late, done ('Concluída manualmente') e cancelled.
dist/admin/admin-connect.js possui abas **Visão geral, Computadores, Atualizações, Contas, Vínculos, Simulação, Histórico, Ajuda**, diagnóstico, conexões WhatsApp e grupos sincronizados com atualização.
connect/windows/CampaignComposer.cs, Connect.cs, WhatsApp.cs e whatsapp-lab são candidatos de reuso. Documentação do Connect 0.2.6 registra envio imediato **manual** de texto/uma imagem a **um grupo**, salvamento local DPAPI, agendamento como lembrete (sem envio automático) e homologação interativa pendente.
### Supabase — catálogo somente leitura em 24/11/2026
Ambos os projetos contêm neo_private.campaigns, campaign_wa_groups, campaign_wa_publications, campaign_wa_recipients, campaign_wa_sync_targets, campaign_push_delivery, connect_devices, connect_wa_connections, connect_wa_selected_groups. O esquema ainda precisa de verificação completa de constraints, RLS e execução real das RPCs. Não concluir que agendamento de publicação automática já é operacional.
### Pendências críticas
O Bridge Windows instalado e a sessão WhatsApp não foram inspecionados nesta revisão. A presença do grupo sincronizado no banco não garante que o computador esteja online, que o WhatsApp esteja conectado nem que o envio automático seja possível. A prévia não equivale à entrega.

## 2. Mapa da navegação final
Painel Admin → Campanhas
- Switch de canal: App | WhatsApp. Cada canal conserva sua própria lista, filtros, ordenação, pesquisa, rascunhos, status e posição na navegação.
- Aba App: Campanhas, Resultados, Públicos e planos existentes; Criar campanha abre o formulário existente; cada campanha oferece Criar também no WhatsApp.
- Aba WhatsApp: Campanhas (listagem), Publicações (esteira), Grupos (cadastrados + sincronizados), NeoPep Connect (abas atuais); Criar campanha abre EDITOR NOVO.
- Dentro do editor: topo com Voltar, nome/status de rascunho, estado real Connect e acesso às configurações; corpo com prévia de mensagens; rodapé com composição e ações; botões compactos para anexos, pincel, grupos, esteira, programar e publicar.
- Abrir Grupos, Publicações ou Connect por drawer/rota de retorno; salvar rascunho e posição para não perder mensagem ao navegar.

## 3. Editor WhatsApp — comportamento pixel/fluxo
### Layout
Full-screen no espaço útil, respeitando safe areas iPhone e barra de teclado. Cabeçalho fixo compacto com título, sair, status de conexão e ação sincronizar; região central de conversa rolável, prévia do balão do destinatário; campo inferior multiline com teclas/emoji, anexo +, pincel e confirmação. Controles primários Publicar agora / Programar próximos à parte inferior ou em painel de revisão.
Não sobrepor o teclado à composição, não esconder confirmação, usar altura visual dinâmica e rolagem ancorada ao último balão.
### Edição de conteúdo
- Mensagem é sequência ordenável de blocos: texto, imagem com legenda, imagem isolada, arquivo, link, produto, Biblioteca, Comunidade.
- Digitar texto → confirmar bloco → renderizar no chat. Tocar bloco → editar, duplicar, reordenar ou excluir, com desfazer onde viável. Auto-save debounced e explícito status Salvando / Salvo / Falha; evitar perder conteúdo offline.
- Título administrativo da campanha é metadado, não enviado automaticamente ao WhatsApp.
- Prévia separa o que foi inserido do que será efetivamente transmitido. Mostrar aviso em recurso indisponível no bridge.
- Ao sair, preservar rascunho em andamento e seleção de grupos; ao retomar, apresentar blocos, anexos e versões do conteúdo.

### Formatação de trecho selecionado
Pincel abre menu contextual com Negrito, Itálico, Riscado, Monoespaçado e estilos de lista/quote apenas quando suportados pelo mecanismo de envio validado. Seleção funciona em teclado touch e mouse. Negrito via *palavra*, itálico via _palavra_, riscado via ~palavra~, monoespaçado via três crases quando confirmado no cliente real.
Manter modelo interno estruturado para seleção/formatos, emitir payload de texto literal com marcações adequadas ao canal. Escapar caracteres especiais, tratar sobreposição de estilos, links, quebras de linha, emoji e limite de caracteres. **Não permitir sublinhado nem cores arbitrárias como se fossem WhatsApp nativo.**
Prévia deve refletir o que a automação instalada consegue enviar; limitar recursos se modo Painel/manual e Connect divergirem.

## 4. Catálogo de anexos (botão +)
Opções: Foto/Imagem, Documento, Link, Produto da Loja, Material da Biblioteca, Publicação da Comunidade. Busca e seleção sem sair do editor ou com retorno ao bloco atual.
### Imagem
No momento de inserir, escolha:
A. Imagem com legenda no mesmo envio (se bridge/sessão suportar).
B. Imagem separada seguida/precedida por texto como bloco próprio.
N imagens têm ordem explícita, limites de formato/dimensões/tamanho por mídia confirmados no conector; falhas parciais visíveis e reenvio apenas de blocos/destinos necessários, não de toda a campanha. Reusar bucket privado atual quando apropriado, controlar validade da assinatura e impedir URL pública permanente.
### Documento
Título, tipo MIME, tamanho e acesso autorizado. O envio como anexo de arquivo requer capacidade real do Connect; se indisponível, permitir somente prévia/link/compartilhamento manual sem afirmar entrega.
### Link
URL HTTPS válida, título/descrição opcional, preview quando permitido; evitar phishing e URL de Teste em campanha Produção. Deep link interno deve ter fallback web/PWA e respeitar autorização.
### Produto da Loja
- Abrir lista de produtos reais da Loja com filtro, miniatura, nome, preço em centavos convertido para BRL, visibilidade e disponibilidade; nunca carregar custo administrativo.
- Selecionar produto → gerar bloco promocional contendo imagem do produto, nome, preço atual, texto personalizado e link para a ficha do próprio NeoPep. Permitir texto abaixo ou legenda, conforme modo.
- CTA «Ver produto/Comprar» só como link clicável ou botão nativo quando suporte real for comprovado; uma imagem com desenho de botão não é um botão interativo.
- Preço e disponibilidade revalidados antes de publicar. Se oculto para todos ou restrito a membros, verificar público e permissões: não publicar oferta de produto inacessível ao público final. Desconto, cupom e regras de estoque permanecem no checkout atual.
- Link direto abre produto e autentica usuário conforme fluxo existente, com fallback se instalação PWA ausente. Não criar outro checkout.
### Biblioteca
Seleção de publicações e arquivos autorizados (imagem, PDF/vídeo/material) com busca, capa/título e resumo; bloco de link profundo e, se permitido, anexo. Não tornar conteúdo Premium público, nem permitir URL de assinatura temporária que falha após agendamento. Revalidar autorização e mídias no horário real do envio.
### Comunidade
Pesquisar publicações de usuários no Grupo/Comunidade do NeoPep por data/autor/texto e selecionar; prévia com imagem e texto opcional, comentário do administrador e link ao original. Preservar autor/atribuição. Respeitar escopo de visibilidade, consentimento de republicação, conteúdo privado e moderação; bloquear se o autor remover postagem, trocar visibilidade ou revogar compartilhamento antes do disparo.
### Arquivos e segurança
Não embutir dados médicos, registros pessoais ou links privados em campanhas em massa. A fonte selecionada pode mudar entre criação e execução; snapshot visual não dispensa verificação de acesso/validade no despacho.

## 5. Grupos sincronizados do Windows
### Fonte de dados atual
O Windows já possui função de listar/selecionar grupos locais e contratos de sincronização. A lista web atual consulta os grupos **selecionados e sincronizados**, não necessariamente TODOS os grupos do WhatsApp local. É necessário decidir/validar se haverá solicitação explícita para sincronizar grupos adicionais do Windows sem captar lista completa indevidamente.
### UX
- Abrir painel Selecionar grupos com pesquisa, categoria/conta/conexão, grupos elegíveis e estados, quantidade de participantes quando disponível, último sync, seleção individual/múltipla/todos visíveis.
- Preservar seleção durante busca e filtros; identificar grupo pelo ID + conexão, sem confundir nomes iguais.
- Recarregar a lista com Sincronizar grupos; distinguir Atualizar consulta web de Iniciar sincronização Windows: o primeiro só consulta e o segundo depende de um comando confirmado pelo cliente.
- Mostrar seleção de grupo indisponível mas impedir envio até nova validação; permitir trocar conta/conexão vinculada com confirmação.
- Limite atual observado: até 30 destinos distintos no seletor do código main. Qualquer ampliação deve ser deliberada com política de ritmo, anti-spam, limites do provedor, retries e consentimento; não remover limite sem análise.
- Respeitar dispositivos revogados, titulares, RLS, identificação de grupos e grupos que passaram a não existir.

## 6. Estado real do NeoPep Connect no topo do editor
Não mostrar verde apenas por último estado registrado. Diagnóstico é composto de: dispositivo aprovado, heartbeat fresco, conta WhatsApp conectada, sessão validada, última sincronização de grupos e capacidade do bridge/versão para cada tipo de mensagem.
Estados visuais recomendados:
- PRONTO: dispositivo recente, sessão válida, destinos elegíveis, capacidade necessária, sem fila bloqueada.
- SINCRONIZANDO: operação de atualização real em andamento, com horário e eventual erro.
- ATENÇÃO: heartbeat recente mas grupos desatualizados, mídia não suportada ou capacidade insuficiente.
- DESCONECTADO: dispositivo sem heartbeat, sessão encerrada ou revogada.
- DESCONHECIDO: sem evidência suficiente ou erro de consulta, nunca exibir PRONTO.
Mostrar «Última comunicação»/«Últimos grupos sincronizados» com horários do servidor e indicador de obsolescência configurável. Botão sincronizar e atalho «Abrir NeoPep Connect»; ao voltar, rascunho intacto.
Publicar agora só fica habilitado quando há pré-condições reais. Programar pode permitir armazenamento do agendamento mesmo com Windows offline, **mas jamais declarar que será enviado enquanto offline**; verificações e fila pendente no momento agendado.

## 7. Publicação e agendamento com poucos passos
### Caminho imediato
1. Compor blocos de mensagem (salvar rascunho automático).
2. Selecionar grupos de destino e canais adicionais.
3. Revisar a prévia efetiva e confirmar «Publicar agora».
A confirmação cria/atualiza campanha e registra trabalho na esteira existente, nunca simula «Enviado». Quando a operação exigir intervenção humana por limitação do Connect, mostrar explicitamente «Aguardando envio manual».
### Agendamento
Usar data/hora/fuso reais, validação DST e UTC interno; configurar recorrência somente se suportada por worker confiável. O agendamento durável deve persistir no backend e conter a versão do conteúdo, destinos, autorização e política de retry. Quando o Windows estiver offline, ficar em Programado/Aguardando conexão ou Falhou conforme política aprovada, com aviso e sem alegar postagem.
### Estados e semântica
Rascunho → Programado → Na fila → Em preparação → Enviando → Aceito pelo cliente (quando confirmável) / Falha. Separadamente: Concluído manualmente (por confirmação humana), Cancelado, Parcial, Expirado. «Aceito pelo cliente» NÃO equivale a «Entregue» nem «Lido»; não inventar essas confirmações.
Registrar transições apenas por ator autorizado, recibo de bridge verificado e idempotência. Repetir mensagem enviada por timeout incerto requer revisão humana ou prova de que não foi aceita.

## 8. Esteira existente e monitoramento
Manter aba Publicações e listagens antigas; acrescentar visualizações por canal, grupo, horário, estado, bloqueio e falhas por destino. Acesso rápido no editor sem destruição de rascunho.
Cada tentativa deve ter ID, campaign_id, versão do conteúdo, destino, vínculo da conexão, programado_em, tentativa, status, erro seguro, horário de confirmação e ator.
Ao selecionar 5 grupos, registrar 5 unidades de destino; uma falha não marca as outras como falhas e não altera o status dos outros grupos. Reenviar somente falhados quando segurança de duplicação permitir. Cada tentativa deve ter chave de idempotência e auditoria.
Proteger contra reprocessamento após alteração de grupo, cancelamento, revogação do Connect, exclusão de produto/biblioteca ou rejeição do provedor. Não despachar campanhas em produção sem credenciais, quotas e revisão da conformidade do canal.

## 9. Publicação cruzada App ↔ WhatsApp
### WhatsApp → App
No editor novo, opção «Publicar também no aplicativo». O editor apresenta prévia do canal App com título, resumo, imagem e destino da notificação; permite adaptar texto e público. Deve oferecer escolha explícita entre exibição interna no App, notificação push ou ambas conforme recursos já existentes. Push depende de opt-in do destinatário, cadastro do dispositivo, regras de público e worker real; não reutilizar a lista de grupos WhatsApp como público do App.
No agendamento WhatsApp, permitir também agendar App na mesma data/hora ou separada, editável individualmente.
### App → WhatsApp
Em campanha App existente, adicionar «Criar também no WhatsApp»; abrir editor novo com conteúdo convertido e pré-preenchido. Usuário ajusta blocos, grupos, mídia e formatação antes de confirmar. Não publicar automaticamente apenas pelo clique.
### Modelo de vínculo
Uma campanha lógica (origem) pode ter versões de App e WhatsApp com conteúdo, público, data e status independentes. Sugestão: parent_campaign_id ou relação entre versões após análise das tabelas atuais, sem migrar de forma destrutiva. Duplicar para canal mantém referência e versão originária, mas não sobrescreve publicações anteriores.
Separar rascunho da versão congelada usada no agendamento, para que editar texto futuro não altere mensagens já programadas sem ação explícita.
Se um canal falhar, o outro pode concluir; mostrar status parcial por canal. Cancelar um canal não cancela o outro por padrão, mas oferecer ação explícita quando cabível.

## 10. Contrato entre painel, banco e Windows (a desenhar)
### Proposta de responsabilidades
- Frontend: editor/preview, seleção de destino, confirmação e acompanhamento; não guarda segredo do Connect.
- Backend: permissões, catálogo de fontes, versões de campanhas, destinos, agenda, fila, locks, retries e auditoria.
- Windows/Bridge: heartbeat autenticado, sincronização de grupos selecionados, capacidades por versão, confirmação/recusa da operação e resultado por destino.
- WhatsApp: canal externo cujas políticas, interface e suporte a automação variam; tratar envio real e recibos como fatos observáveis, não como garantia.
### Mensagens de contrato sugeridas (ainda NÃO presentes)
capabilities(): text, image_caption, separate_image, document, product_preview, multi_destination, scheduled_automatic, status_receipt.
prepare(): campaign_version, group_ids, message_blocks, attachments_refs, request_key e channel_config; validate(): autorização, validade, tamanho, política de canal; dispatch(): envio autorizado com token de lease; ack(): resultado com ID da tentativa e idempotência; heartbeat(): estado, versão, last_seen; sync_groups(): solicitação autenticada e revisão.
Se capacidades não existirem, esconder ações não suportadas ou usar rota manual preservada.

## 11. Privacidade, segurança e limites
- Reutilizar RLS, RPCs de finalidade restrita e direitos de administração; não expor conversas privadas, lista completa de membros nem credenciais Windows.
- Lista de grupos sincronizados é dado pessoal/contextual: sincronizar somente o necessário, preferir grupos selecionados, registrar permissão e respeitar revogação.
- Posts comunitários devem ter regra de compartilhamento autorizada, não presumir que post público dentro do App é público no WhatsApp.
- Mídias de saúde, fotos comparativas e arquivos privados não devem ser republicados em massa por padrão.
- Adotar limites de taxa, quantidade de destinos, tamanho de campanha, cancelamento e bloqueios anti-duplicidade. Rever termos do WhatsApp e requisitos legais antes de qualquer automação.
- Status exibido depende de telemetria e deve expirar; usar timezone claro, sem mascarar erros do Windows.

## 12. Critérios de aceitação fim a fim
1. Aba App mantém lista, fluxo de campanhas e push antigos sem regressão.
2. Aba WhatsApp mantém Campanhas, Publicações, Grupos e NeoPep Connect; botão Criar abre full-screen responsivo.
3. Texto digitado/formatado é representado fielmente no payload e na prévia; não inventar recursos de texto.
4. Imagem com legenda vs separada gera mensagens realmente distintas quando suportadas.
5. Seletores de produto/biblioteca/comunidade utilizam dados válidos e segurança do módulo de origem.
6. Produto oculto ou indisponível é identificado na revisão; CTA abre ficha no App sem criar checkout paralelo.
7. Seleção de grupos sincronizados persiste mesmo com filtros, nomes iguais e mudança de conexão.
8. Status PRONTO depende de heartbeat e sessão reais, não de fixture; offline impede envio imediato.
9. Publicar imediatamente não marca ENVIADO antes de evidência; agendar persiste e mostra Programado.
10. Resultado por grupo, falha parcial, reenvio seguro e registros de auditoria.
11. App→WhatsApp preenche editor e preserva campanha original; WhatsApp→App adapta push e cria vinculação sem envio duplicado.
12. Fechar/navegar/recarregar ou trocar abas não perde rascunho salvo; retorno do Connect também preserva.
13. Cada etapa passa por Teste, conta fictícia e grupo explicitamente autorizado; enviar campanha real só após permissão específica.
14. A aba Simulação do Connect permanece separada de envio real.

## 13. Ordem incremental de implementação (sem ativação automática implícita)
013.01 confirmar artefatos/branch publicada e auditoria de Connect/SQL/Windows/RPCs;
013.02 preservar e ajustar navegação (conflito PR #35);
013.03 editor full-screen e autosave com payload somente local;
013.04 formatação precisa, seleção e preview;
013.05 fontes de anexos/mídia e compatibilidade com Windows;
013.06 seletores Loja/Biblioteca/Comunidade, links e privacidade;
013.07 grupos sincronizados e status real de conexão;
013.08 integração com esteira existente, criação/agendamento sem despacho real;
013.09 contrato e homologação do Bridge para envio imediato e confirmação, mediante autorização;
013.10 agendamento automático seguro, política offline e retries, somente se canal aprovado;
013.11 cross-post App→WhatsApp;
013.12 cross-post WhatsApp→App e push;
013.13 testes reais no Windows autorizado, Teste web e dois usuários; 
013.14 rollout seguro com flags e monitoramento.
Cada subetapa documenta baseline, mudanças, testes, evidências, status por ambiente e próximos passos no Controle de Execução.
