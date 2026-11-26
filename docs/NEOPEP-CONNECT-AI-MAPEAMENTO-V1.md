# NeoPep Connect AI — plano universal e inventário funcional v1
Data: 26/11/2026. Escopo: planejamento; não publicar, não migrar banco nem alterar campanhas nesta etapa.
Base produção a315404729c284475e1f0b1f1d917609e4f2ed11; Teste em f08b7e564902c25c4f62a9dd1c98ce7b5626ddac, candidata fe8ecb2 pendente conforme PONTO-DE-CORTE-20261126.md. IA Studio interno não faz parte deste ciclo.

## Compatibilidade verificada (26/11/2026)
- ChatGPT: caminho pessoal via Sites (Plus/Pro, sujeito à disponibilidade e autorização), plugin privado instalado pelo proprietário. Para servidor remoto próprio, verificar política de conta; documentação de MCP customizado completo lista Business e Enterprise/Edu. Não prometer instalação antes do teste real. https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites ; https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- Claude: conector MCP remoto por URL HTTPS 443, disponível inclusive em planos individuais. https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Gemini Apps: custom connected apps MCP na web; documentação informa 18+, conta pessoal, histórico ligado, EUA, inglês. Preparar adaptador, não tentar contornar região. https://support.google.com/gemini/answer/17209137?hl=en-PR
- Imagens: ChatGPT documenta seletor e transferência de arquivos autorizados (https://developers.openai.com/plugins/reference); provar que a imagem recém-gerada pode ser selecionada/enviada. Claude gera designs/visuais mas não fotos/ilustrações como gerador de imagem (https://support.claude.com/en/articles/9002504-can-claude-produce-images); permitir upload ou ferramenta de imagem opcional com autorização de custo. Gemini validar transferência quando disponível. Não presumir IDs/URLs de arquivo universais nem que MCP é gerador de imagem. Base64 grande não é transporte padrão.

## Arquitetura
Um serviço MCP remoto Streamable HTTP, preferencialmente projeto separado do frontend (candidato Vercel e backend Supabase existente, confirmar limites). ChatGPT Sites pode hospedar adaptador autorizado para conta pessoal, chamando mesma API central. Não expor service_role, RPC genérica, SQL, segredos, fotos de membros ou listas de contatos. Autorização individual OAuth 2.1 + PKCE, audience/resource, scopes de campanha, revogação e renovação, revalidar administrador/owner por chamada. Projetos e credenciais separados por ambiente. V1 rascunhos + preparação; confirmação explícita por lote para envio/agenda, cancelamento e exclusão. Auditar ações e recibos, não registrar tokens ou prompts sensíveis.
A API deve executar operações existentes sob identidade real autorizada (não falsificar JWT nem usar service_role para burlar auth.uid/issuer); provar fluxo OAuth -> identidade NeoPep -> RPC com token de sessão válido, ou projetar adaptadores escopados com os mesmos gates antes de ativar escrita. Não alterar RPC atual de produção sem testes.

## Inventário confirmado no commit publicado e Supabase dos dois ambientes
| Capacidade | Base existente | MCP proposto / fase |
|---|---|---|
| Contexto de marca e regras | Identidade NeoPep, editor e configurações; guia estruturado ainda a criar | get_brand_context, get_capabilities (1) |
| Lista/detalhe das campanhas e agenda | neo_campaign_central_v1 list/get/load e app_list/app_get/app_load | list_campaigns, get_campaign (1) |
| WhatsApp e App, campanha pai | central create/app_create, request_id UUID idempotente, owner | create_campaign_draft (1) |
| Publicação independente | central save/app_save -> neo_campaign_editor_v1; revisão, UUID, request_id, draft | add_publications, update_publications (1) |
| Texto e formatação | editor text, image, link, product, document, community, file; limites WhatsApp 6 blocos, texto 2000, legenda 1000, link 160 | validar blocos por canal; texto primeiro (1) |
| Mídia privada | campaignMediaUpload em src/cloud.js, neo-campaign-images: JPEG <=1 MiB, path owner/uuid.jpg; arquivos PDF/MP4 <=5 MiB quando autorizados | attach_creatives, upload ticket único escopado, estado mídia (2) |
| Referências | Biblioteca, Loja e Comunidade no editor; neo_library_campaign_share e permissões próprias | list_authorized_assets, attach_reference (3); jamais expor dados pessoais/saúde nem promover medicamentos controlados/experimentais |
| Destinos WhatsApp | neo_campaign_wa_sync catalog, diagnósticos neo_campaign_rich_admin_v1; seleção atual sincronizada, até 30, revalidar antes de programar | list_destinations, assign_destinations (2) |
| Público App | app_settings: audiência all/plan/segment, pop-up, push, janela, prioridade, limite por conta, dias | configure_app_audience (2) |
| Programar em massa | central schedule/app_schedule, revisão e local_time exatos, request_id, confirmed, diagnósticos; staging App exige destination_count/audience_key | prepare_schedule / confirm_schedule (2), separar aprovação de execução |
| Publicar agora | central publish/app_publish e gates existentes | prepare_publish / confirm_publish (3) |
| Repetição | neo_campaign_weekly_v1; app repeat_drafts, repeat_list, repeat_replace, repeat_cancel; UI até 24 em 89 dias | preview_recurrence, apply_recurrence (3) |
| Duplicar e copiar canal | central duplicate/app_duplicate e copy_channel; cópia como rascunho, rever destinos | duplicate_publications, copy_campaign_channel (3) |
| Gerenciar | rename/archive/delete/set_enabled e equivalentes app_; delete_publication, cancel | rename, pause/resume, cancel, archive; exclusão só fase posterior e confirmação (3) |
| Aprovação | review_capabilities, review_list, review_schedule, review_publish, review_approve, review_reject; somente quando liberado | request_review, review_status (3); não se passar por outro admin |
| Status e histórico | central get/load, rich status, App status, batch states e recibos | get_schedule_status, get_delivery_receipts (2) |
| Campanhas legadas | legacy_states, adopt, legacy_set_enabled, delete_legacy | somente leitura inicialmente; não migrar automaticamente |

Fontes verificadas: dist/admin/campaign-central.js (scheduleSelected, details, duplicateForm, weeklyForm); dist/admin/campaign-editor.js (dispatchIssues, saveRemote, uploadRichImages, uploadOriginalFiles, appSettingsPane); src/cloud.js. SQL lido diretamente dos dois projetos: neo_campaign_central_v1, campaign_app_central, neo_campaign_wa_sync, neo_campaign_rich_admin_v1 e neo_campaign_weekly_v1. Inventário não equivale a teste ponta a ponta ou contrato exaustivo de cada RPC; antes de implementar ferramenta, revisar validator, assinatura, payload, limites, estados e erro, testar autorização e reexecução.

## Manual legível pela IA
MCP tools/list: nome, descrição operacional, input/output JSON schema, exemplos válidos, precondições, anotações readOnly/destructive/idempotent coerentes; get_capabilities retorna versão, ambiente, canais, limites efetivos, operações habilitadas e erros recuperáveis. Recursos/guia de marca versionados, identidade visual (logo autorizado, cores, estilo), conteúdo permitido, formatos, exemplos de campanha, restrições e instruções para mídia. IDs reais retornados pelo servidor. Nenhuma IA deve presumir grupo, produto, link, preço, entrega ou revisão. Erros estruturados por item; status recebido, rascunho, mídia pendente, pronto, aguardando aprovação, agendado, aceito, falha, cancelado. Não confundir aceitação WhatsApp com entrega/leitura.

## Sequência de implantação (sem publicação nesta etapa)
A. Implementar contrato + testes unitários/mocks, autenticação e ferramenta de consulta; menu Campanhas > Integrações com IA com conexões, escopos, ambiente, revogar, instruções, histórico. Teste inicial sem dados reais.
B. Criar campanha sintética com duas publicações de texto no Teste. Repetir request id, validar revision, isolamento, sem envio. Homologar ChatGPT e Claude primeiro.
C. Upload de criativo e vinculação, limites/validação de conteúdo, prevenir SSRF em URLs e reusar storage privado. Fazer prova imagem -> chat -> plugin -> prévia no NeoPep. Adaptadores de arquivo por host.
D. Lote de 30 ou 60 via chunks, progresso persistido, retomada idempotente, mensagens parciais; seleção de destino, prévia/confirmar, agendar utilizando regras atuais; rejeitar destino desconectado/data vencida/revisão alterada. Teste nunca envia a destinatário de produção.
E. Recorrência, copiar canal, pausar, cancelar, status, revisão, ativos. Testes reais autorizados. Gemini quando elegível. Consolidar com ponto de corte apenas depois de homologação.
F. Instalação e operação: documentação passo a passo para cada host, conta e ambiente; sem garantir acesso no iPhone antes do teste. Status, monitoramento, custo opcional de geração de imagens separado do custo de integração.
