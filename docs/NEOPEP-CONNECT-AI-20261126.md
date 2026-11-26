# NeoPep Connect AI — integração de campanhas a partir de chats externos
Decisão de produto 26/11/2026: criação no chat da IA (não no NeoPep); menu separado em Campanhas > Integrações com IA. Esta branch é baseada na candidata de loja a315404729c284475e1f0b1f1d917609e4f2ed11. Não inclui a função de geração interna de IA Studio; aquela candidata permanece isolada, sem deploy. Não alterar agentes existentes nem credenciais de provedores.

## Interface NeoPep
Conexões (ChatGPT e outros clientes MCP compatíveis), conectar/revogar, conta/ambiente, escopos, identidade visual e instruções exportáveis, campanhas recebidas, status por publicação e mídia, histórico de sincronização, auditoria de alterações, link para abrir campanha na Central. Não recriar o editor ou agenda.

## Integração proposta
Backend privado NeoPep, adaptador MCP autenticado e plugin "NeoPep Connect AI". Separação por ambiente, autenticação individual, expiração/revogação, autorização server-side de administrador de campanhas. OAuth 2.1 + PKCE, audience/resource vinculada ao servidor; token escopado somente a campanhas, nunca service_role no cliente. Validar opção de plugin hospedado em ChatGPT Sites para uso pessoal (documentação permite em qualquer plano se Sites disponível), ou servidor MCP próprio com conexão/instalação compatível, inclusive Business/Enterprise/Edu para MCP remoto completo. A existência de uma chave API de IA não concede permissão MCP nem acesso ao chat.

## Ferramentas propostas (contrato, não endpoints publicados)
- get_campaign_context: guia visual, regras de conteúdo, canais, limites e identidade da marca; não fornecer dados pessoais ou segredos.
- list_eligible_destinations: somente destinos autorizados e vigentes no canal/ambiente; não expor telefones ou membros.
- list_campaigns, get_campaign_status: consulta administrativa resumida e paginada.
- create_campaign_draft: título, canal, external_request_id idempotente; reutilizar contrato central.
- add_campaign_publications: campaign_id, lote de publicações editáveis com IDs externos estáveis, título, blocos em ordem, planned_local e timezone America/Sao_Paulo; validar datas, conteúdo, limites atuais e mídias.
- attach_creatives: associar arquivos recebidos a publicações por IDs estáveis; ferramenta MCP com campo top-level files, _meta["openai/fileParams"]: ["files"], esquema file_id/download_url obrigatórios, mime_type/file_name opcionais. Confirmar teste real de imagem gerada pelo chat; se não houver referência elegível, seleção de arquivo no chat ou upload autenticado no NeoPep. Nunca baixar URL arbitrária: origem autorizada, HTTPS, redirects controlados, validação de MIME e conteúdo, tamanho máximo, processamento seguro e storage privado. Preservar os limites do editor.
- update_draft_publications: edição com revisão esperada, datas, destinos autorizados e remoção apenas de blocos não enviados; evitar duplicidades e conflitos.
- prepare_schedule: prévia do calendário, destinos e pendências; nunca agenda implicitamente.
- confirm_schedule: ação separada e explícita, reconfirma autorização, revisão, mídia, destinatários, limites, conexão WhatsApp e gates existentes; usar fluxo nativo de agendamento em lote, não implementar disparo paralelo. Retornar sucesso/erro individual, status verificável e idempotência.

## Fluxo
Usuário menciona plugin no chat, solicita planejamento e criativos, revisa material no chat, autoriza envio ao NeoPep, recebe recibo de cada rascunho e imagem, pede revisão, configura destino e agenda, confirma agendamento explicitamente. A Central mantém as publicações editáveis e histórico. A IA não pode contornar as permissões de envio, inventar IDs de destinos, enviar dados privados ou publicar conteúdo sem confirmação. Não gerar conteúdo promocional de medicamentos sujeitos a prescrição ou experimentais nem alegações médicas infundadas.

## Critérios de aceite
1. Provar conexão elegível para uso pessoal e uma operação de escrita com dados sintéticos.
2. Provar passagem de imagem criada no chat e vínculo correto ao texto; alternativa de seleção/upload se host não entregar arquivo.
3. Criar duas publicações em rascunho, reexecutar sem duplicação, editar, verificar agenda e status.
4. Testar sessão revogada, papel não administrativo, outro ambiente, URL não autorizada, tamanho inválido, grupo desconectado, data vencida, falha parcial e confirmação.
5. Não chamar APIs pagas de geração do NeoPep por padrão. Custos da própria plataforma de IA e infraestrutura dependem do plano/uso.
6. Só publicar após homologação e consolidação; ordem Produção → Teste quando autorizada.

## Referências oficiais verificadas
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://help.openai.com/en/articles/20001256-plugins-in-chatgpt
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://developers.openai.com/plugins/reference (file inputs)
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/submission

Status: especificação apenas, sem servidor, plugin instalado, alterações no banco, deploy ou chamadas pagas.
