# NeoPep Connect AI — progresso

Branch de referência: `desenvolvimento/campanhas-plugin-ia-20261126`.
Base deste lote: `51c34f0`. Os incrementos anteriores estão registrados abaixo.
Ponto de corte: `docs/PONTO-DE-CORTE-20261126.md`. A publicação anterior de Teste pertence a outro ciclo.

| Etapa | Estado |
|---|---|
| 001 Auditoria | Parcialmente testado. Fonte nativa do Central localizada; parâmetros de leitura e escrita ainda em auditoria. |
| 002 Catálogo | Contexto disponível no PoC; lista e detalhe App/WhatsApp, agenda, estados e recorrência App testados com fixtures. |
| 003 Autenticação | Consentimento explícito, broker SQL, sessão NeoPep e OAuth PKCE implementados para Teste. Fixtures locais aprovadas. Homologação real pendente. |
| 004 Servidor | Worker Teste com entrada desativada e bundle validado em dry-run. Runtime e clientes reais ainda pendentes. |
| 005 Central administrativa | Consentimento, listagem e revogação pelo painel Teste exercitados em DOM simulado. Instalação prática pendente. |
| 006 Criação e edição | Preparação de criação e edição textual com revisão e preservação de campos testadas. Escrita pelas ferramentas permanece desativada. |
| 007 Criativos | Planejado |
| 008 Operações em massa | Planejado |
| 009 Destinatários | Planejado |
| 010 Agendamento e publicação | Planejado |
| 011 Gerenciamento | Planejado |
| 012 Documentação e CI | Geração determinística e workflow preparado. Ainda falta vincular mudanças semânticas nos contratos nativos à revisão obrigatória. |
| 013 Segurança e monitoração | Testes locais de RLS, armazenamento cifrado e rotação. Roteiro de diagnóstico e reversão pronto. Métricas e alertas reais pendentes. |
| 014 Homologação e instalação | Catálogo privado, ZIPs separados e verificação reprodutível em CI. Instalação real pendente por cliente, plano e dispositivo. |

## Incremento inicial

- Arquivo alterado: `vercel.json`. O deploy Git fica desativado para esta branch de desenvolvimento.
- Verificação: a configuração JSON é válida e mantém as regras das demais branches.
- Migrações e configuração externa: nenhuma.
- Próxima ação: versionar o subconjunto executável de leitura, testar o transporte MCP com dados sintéticos e bloquear por padrão o acesso a serviços reais até existir autorização por conexão.


## Incremento 002–004 — Catálogo e transporte

- Continuidade inicial confirmada no remoto em `9897f85`.
- Implementação em `integrations/campaign-mcp/src/`, configuração local em `integrations/campaign-mcp/wrangler.jsonc`, testes em `integrations/campaign-mcp/tests/` e documentação gerada em `docs/NEOPEP-CONNECT-AI-FERRAMENTAS.md`.
- O protótipo processa POST Streamable HTTP com JSON, possui limite de corpo e valida origem e versão. A entrada padrão nega todas as chamadas. As fixtures provam os controles de conta, escopo, validade, revogação e ambiente; não autenticam nenhuma conta real.
- Testes locais: `node --test integrations/campaign-mcp/tests/*.test.mjs` (3 aprovados) e `node integrations/campaign-mcp/src/generate-docs.mjs --check`.
- Referências Cloudflare/MCP: a tentativa de leitura direta pelo terminal recebeu HTTP 403. A compatibilidade de runtime, clientes e plano continua pendente.
- Migrações preparadas ou aplicadas: nenhuma. Configuração externa: nenhuma além dos pushes da branch.
- Próxima ação: revisar lista e detalhe do RPC em `release/campaign-central/20261125143000_campaign_central.sql`; implementar um contrato escopado que revalide vínculo e administração sem usar service_role. Homologar transporte com cliente oficial antes de adicionar escrita.

## Incremento 005 — Entrada administrativa

- Incremento de transporte confirmado no GitHub em `d51305b`.
- Arquivos: `dist/admin/admin-connect-ai.js`, `dist/admin/admin.js`, `dist/admin/index.html`, `dist/style.css`, `integrations/campaign-mcp/tests/admin.test.mjs` e workflow de contrato.
- O card independente fica acima dos seletores App e WhatsApp. A visão inicial abre em diálogo nativo e conserva os campos e a rota da Campanha. Mostra Cloudflare aguardando homologação e executores complementares planejados. Rotas próprias, gestão de conexões, métricas e histórico autenticado ainda pendentes.
- Leitura do SQL candidato: `list` usa proprietário e limite de 50 com offset. `get` verifica proprietário e agrega publicações e lotes, incluindo metadados de destino. Um adaptador de leitura precisa projetar apenas campos autorizados e impor limites antes de anunciá-lo. O emissor do SQL candidato é específico do Teste. Nenhuma variante de produção foi presumida.
- Verificações locais: `npm ci` com lockfile, 4 testes do Connect AI, checagem de sintaxe dos scripts administrativos e verificação do catálogo gerado. Ainda falta validar interação no navegador e nos temas reais.
- Migrações e configuração externa: nenhuma. Sem operações de campanha ou publicação.
- Próxima ação exata: implementar autorização escopada de Teste em incremento isolado. Validar identidade e revogação por conexão e demonstrar leitura nativa com projeção mínima. Só então ampliar a Central com estado real.

## Incremento de autorização e SDK

- Base remota confirmada: `4807a0e`. O commit desta entrada acrescenta `src/authorization.mjs`, dependências isoladas com lockfile e testes em `integrations/campaign-mcp`.
- Etapa 003 parcial. O verificador valida assinatura, emissor, recurso, validade e vínculo com conexão, conta, cliente e ambiente. A cada chamada consulta o estado atual e revalida o papel administrativo. Duas conexões da mesma conta são independentes. O emissor OAuth, a persistência durável e a ligação à sessão NeoPep continuam pendentes. A entrada padrão continua fechada.
- Etapa 004 parcial. O cliente do SDK oficial MCP 1.32.2 negociou protocolo e executou a ferramenta em transporte HTTP simulado. Isso não comprova o runtime Cloudflare, OAuth no cliente ou instalação nas plataformas.
- Testes locais: seis aprovados. Sem migrações, configuração externa ou deploy.
- Próxima ação: dar continuidade ao pacote portátil e implementar o adaptador de leitura com sessão NeoPep validada em Teste.

## Incremento de distribuição portátil

- Ponta anterior confirmada no GitHub: `7f9f566`. O commit desta entrada acrescenta o pacote em `integrations/campaign-mcp/plugin/`, o gerador `build-plugin.py` e a validação ZIP no workflow.
- OpenAI Developers confirmou o layout portátil `plugin.json` + `mcp.json` + `skills/`, com configuração OAuth por servidor e submissão remota por HTTPS. Os guias oficiais de Claude e Gemini descrevem a conexão por URL, sujeita à elegibilidade. Links e pré-requisitos no README do pacote.
- Gerar com `python3 integrations/campaign-mcp/build-plugin.py /tmp/neopep-connect-ai-0.1.0.zip`. Duas gerações locais foram idênticas, e `unzip -t` aprovou todos os arquivos. O pacote usa os ativos oficiais de `dist/assets`. A configuração candidata de Cloudflare continua em `integrations/campaign-mcp/wrangler.jsonc`, separada do ZIP.
- Etapa 014 parcial: empacotamento validado localmente. Endpoint HTTPS, OAuth, instalação concreta, descoberta, políticas e evidências para submissão ainda pendentes. Nenhum serviço provisionado, migração aplicada ou pacote submetido.
- Próxima ação: implementar o adaptador com credencial NeoPep individual e projeção de campos, depois testar as ferramentas reais com dados de Teste autorizados.

## Incremento de leitura nativa

- Pacote portátil confirmado no GitHub em `c2ba0c0`.
- `integrations/campaign-mcp/src/campaign-reader.mjs` implementa a projeção inicial de lista e detalhe WhatsApp via o RPC nativo de Teste. O adaptador usa somente a credencial de sessão do titular, consulta a identidade no Supabase antes do RPC, não permite redirecionamentos e omite destinos e recibos brutos.
- `tests/campaign-reader.test.mjs` valida com HTTP simulado a projeção, a rejeição de sessão de outra conta, outro ambiente e tentativa de publicação. Sete testes locais aprovados.
- Estado parcial da etapa 001: este contrato tem primeira página limitada. Filtros, paginação, canal App e estados da agenda exigem auditoria adicional. O adaptador ainda não está ligado ao catálogo do Worker. Nenhuma chamada real, migração ou configuração externa.
- Próxima ação exata: implementar o vínculo durável da conexão OAuth com uma sessão de usuário NeoPep e validar seu contrato com JWTs sintéticos. Depois habilitar apenas as leituras testadas. Manter escrita, agendamento e publicação indisponíveis até os respectivos testes e autorização.

## Registro de conexões e PKCE

- Base remota `383f8b4`. `release/connect-ai/001-connections.candidate.sql` prepara registro persistente de Teste, vinculado à sessão e ao proprietário. Expiração padrão de 30 dias. O RPC verifica emissor e ACL administrativa. A revogação do próprio registro continua possível após perda do papel.
- `src/pkce.mjs` valida S256, expiração, cliente, redirect e recurso. A comparação é um componente para a futura troca atômica de código. Emissão OAuth, consumo atômico, renovação e vínculo no Worker ainda pendentes.
- Testes locais de JWT, PKCE e isolamento em PGlite. Nenhuma migração nem configuração externa.
- Próximo: distribuição privada por catálogo local e ligação do registro ao fluxo OAuth.

## Catálogo privado

- Base confirmada no GitHub em `31e82d8`. O catálogo local GitHub em `.agents/plugins/marketplace.json` adota a estrutura oficial. O gerador agora separa manifestos, URLs e nomes de Teste e Produção, e materializa a árvore local quando solicitado.
- Ambos os ZIPs foram gerados e passaram em `unzip -t`. As URLs são candidatas. A documentação oficial confirma o mecanismo local de Desktop e Codex. Compatibilidade real da conta Plus em Desktop, Web e iPhone continua pendente de endpoint HTTPS autorizado e teste em cada cliente.
- Instalação, atualização, remoção e nova autorização estão no README do pacote. Submissão pública fora da entrega. Nenhum provisionamento, migração real ou publicação.

## Leitura MCP de Teste e ampliação do painel

- Catálogo privado confirmado no GitHub em `fe031c3`. O Worker pode anunciar lista e detalhe WhatsApp somente quando um adaptador explícito é fornecido em Teste, após a autorização de administrador e escopo. A entrada padrão segue fechada e Produção não anuncia essas operações.
- Arquivos: `src/worker.mjs`, `src/catalog.mjs`, manual gerado, teste do Worker e `dist/admin/admin-connect-ai.js`. A central apresenta seções de conexões, ferramentas, conhecimento, histórico e processamento, ainda sem dados operacionais.
- Validação local: dez testes aprovados, documentação gerada conferida. A sessão real, o canal App, filtros, paginação, agenda, recorrência, histórico real, renovação OAuth e escrita continuam pendentes.
- Próxima ação: implementar consumo transacional do código e rotação de refresh, com integração à sessão NeoPep e testes de reuso, antes de operar contra o Supabase Teste. Depois auditar o contrato App e ampliar os filtros. Nenhuma operação remota realizada.

## Critérios obrigatórios de clientes

- Preservado o commit remoto `e755827`, que define ChatGPT, Claude e Gemini como alvos obrigatórios e Codex como cliente adicional. A integração local foi reaplicada sobre ele sem force push.
- A matriz em `docs/NEOPEP-CONNECT-AI-COMPATIBILIDADE-CLIENTES.md` distingue instalação, OAuth, superfícies, plano e região. Todos compartilham transporte, catálogo e contratos por ambiente. Assertivas de disponibilidade real permanecem pendentes.
- Próxima ação: finalizar a transação do emissor OAuth em Teste, ligar o registro persistente e testar duas conexões independentes. Em paralelo, validar os contratos nativos do canal App e estender a leitura sem bloquear pelo resultado de um cliente.


## Emissão e troca OAuth

- Base remota confirmada em `83ba99f`. Arquivos: `src/oauth-issuer.mjs`, `src/worker.mjs`, `tests/oauth-issuer.test.mjs`, `release/connect-ai/002-oauth-grants.candidate.sql`.
- O PoC registra apenas hashes, serializa a troca por conexão, emite access token ES256 de cinco minutos e roda o refresh. Reuso de refresh válido invalida a conexão. Descoberta e endpoint de token são ligados apenas com configuração injetada. A entrada padrão continua fechada.
- 11 testes locais passaram, incluindo duas tentativas concorrentes pelo código no PGlite, troca com PKCE incorreto, verificação de assinatura, rotação, rejeição de reuso e ACL da função interna.
- Integração pendente: sessão Supabase real com consentimento protegido contra CSRF, autorização HTTP, JWKS público, armazenamento/renovação da sessão NeoPep, credencial de acesso ao banco do emissor e implantação autorizada. A resposta de autorização e o fluxo nos clientes ainda não estão homologados.
- Nenhuma migração aplicada ou infraestrutura alterada. Próximo: estender leitura nativa e validar separadamente os contratos App do ambiente Teste.


## Leitura dos dois canais e preparação de rascunho

- Base remota `c9fb992`. O adaptador projeta lista, detalhe, agenda resumida, histórico e, quando habilitada, recorrência App. Usa filtros e offset nativos, retorna cursor de continuação e distingue arquivo, problema, agenda, andamento, rascunho e estado desconhecido.
- App e recorrências continuam opt-in no runtime porque o SQL conhecido possui variante oficial de Produção e a sua disponibilidade no Teste precisa ser comprovada. Nenhum acesso remoto foi tentado. Os testes usam fixtures dos contratos candidatos.
- `src/draft-plan.mjs` prepara apenas os parâmetros nativos de criação para os dois canais, com UUID de idempotência e sem destino ou envio. Nenhuma mutação está anunciada.
- 13 testes locais aprovados e manual gerado. Próximo: gestão das conexões no painel e validação automatizada do catálogo privado. Sem alterações externas.


## Instalação privada no painel e verificação dos pacotes

- Preservado o commit concorrente `a8c84b1`, que traz `docs/NEOPEP-CONNECT-AI-INSTALACAO.md`. A leitura dos dois canais está confirmada no GitHub em `7a8fb57`.
- A seção **Instalar integração** oferece ChatGPT, Claude, Gemini e Codex, seleção de superfície e ambiente, links oficiais, cópia do endereço candidato e orientação de atualização. Sites é opcional para Web/iPhone. A versão instalada não é inferida. O download homologado e a verificação ficam desativados até revisão de pacote e endpoint.
- `integrations/campaign-mcp/verify-packages.py` compara duas gerações de cada ZIP, valida os arquivos, o catálogo, os ativos e a separação das URLs OAuth. Boa estrutura conferida contra os exemplos oficiais já registrados. A obtenção do JSON Schema oficial pelo terminal voltou HTTP 403, portanto não houve validação integral com o schema remoto.
- Testes locais de DOM e integridade dos pacotes aprovados. Nenhuma instalação, migração, infraestrutura ou emissão real.
- Próximo: ligar consentimento NeoPep ao emissor e à sessão do titular, expor JWKS apenas com chave pública, e homologar distribuição em cada cliente antes de habilitar download e verificação no painel.

## JWKS pública e edição textual candidata

- Preservado o gate remoto `e387062` para Plus e clientes. O painel de instalação foi confirmado antes disso em `e451bb2`.
- O emissor só retorna JWKS quando configurado com uma chave pública P-256 e projeta exclusivamente campos públicos. O teste confirma que um campo privado fornecido por engano não aparece na resposta.
- A edição candidata prepara o envelope de revisão, IDs e blocos de texto. Nenhuma ação de escrita é anunciada ou chamou o RPC. Antes de habilitar, carregar o rascunho autorizado e preservar seus demais campos, aplicar os validadores nativos e testar conflitos de revisão.
- 14 testes locais aprovados. Sem alterações externas. Próximo: concluir autorização e consentimento HTTP, broker NeoPep e autorização real do primeiro leitura, seguindo o gate Plus.


## Incremento da primeira integração privada de Teste

- Base remota `51c34f0`. `08b7410` integra servidor, sessão NeoPep e consentimento HTTP. `c23546c` adiciona a confirmação explícita no painel, gestão das conexões e preservação de campos de rascunho.
- Entrada em `integrations/campaign-mcp/src/staging-entry.mjs` e `wrangler.staging.jsonc`. O broker em `src/session-broker.mjs` usa Hyperdrive e a migração candidata `003-session-broker`. A sessão NeoPep é verificada no projeto Teste. O acesso guardado é cifrado e expira com o token de acesso original. A rotação MCP revalida essa sessão. Novos consentimentos removem sessões expiradas ou revogadas.
- SQL 001–003 testado em PGlite com papel restrito, prova de uso único, leitura cifrada isolada por proprietário e revogação. Composição OAuth até a leitura MCP exercitada com upstream simulado. A suíte da integração reúne 16 testes. Build local, check, catálogo e reprodução dos ZIPs também passaram. Wrangler empacotou o Worker com as duas flags em zero em modo dry-run.
- Nenhuma migração aplicada ou configuração externa alterada. Os pushes servem para continuidade do desenvolvimento privado. Não houve instalação em Plus, Claude, Gemini, Codex ou Sites.
- Rascunhos: o contrato textual preserva título, mídia, destinatários, agenda e configurações, a partir da revisão nativa. A ferramenta ainda não executa gravações. Etapas independentes de mídia, operações em massa, agendamento e métricas reais continuam pendentes.
- Próxima ação exata: revisar a [implantação de Teste](NEOPEP-CONNECT-AI-IMPLANTACAO-TESTE.md), identificar um cliente com callback HTTPS registrável, validar os privilégios efetivos do login do broker e solicitar autorização para preparar os recursos privados de Teste. Executar o roteiro antes de ampliar escopo ou clientes.

### Verificação final do incremento

- `8569d0b` acrescenta broker, migração 003 e reversão. `8ccc5d3` registra os limites dos clientes e ajusta a verificação da versão do SDK no painel.
- Suíte do aplicativo: 544 de 545 testes passaram. A falha de badges no tema escuro foi reproduzida isoladamente com os arquivos originais de `51c34f0`. O teste focal adicional confirma CSP exclusiva do painel Teste e inserção única da política de referrer em builds repetidos.
- O dry-run do Wrangler 4.54.0 gerou o bundle com as duas flags em zero. A documentação oficial de Sites exige que o proprietário publique o Site para criar o plugin e limita compartilhamento direto em contas pessoais. O ensaio individual com Web e iPhone ainda depende de autorização para uma publicação privada e de elegibilidade da conta.

## Candidatas para Produção e Teste

- Base reconciliada com o remoto em `11cb8fc`, incluindo o registro do deploy anterior de Teste. Produção publicada em `a315404` e Teste em `fe8ecb2` são as bases de comparação.
- Configuração imutável compartilhada do Worker e entradas separadas. O broker confere o identificador gravado pela migração 001 antes de usar o banco. Migração 001 separada por ambiente e migrações 002/003 compartilhadas. Consentimento e gestão no painel usam apenas o MCP pareado com a origem e o Supabase da página.
- Instalação privada prioriza cadastro MCP direto no ChatGPT Windows. Ícone PNG oficial de 96 × 96, 2.140 bytes, disponível no painel. O ensaio real depende de callback HTTPS aprovado e cliente elegível.
- Próximo passo: reconciliar o pacote visual sobre a base publicada de Teste, conferir os dois bundles e registrar a ordem de ativação. Nenhuma implantação ou migração remota executada.

### Regressão e reconciliação de frontend

- `cc4de1c` introduz as entradas isoladas, os SQL candidatos e o ícone. Os dois bundles foram empacotados localmente pelo Wrangler 4.54.0, com as flags de integração e leitura App em zero. Os 19 testes do pacote cobrem consentimento e leitura nas duas configurações, host incorreto, projeto associado ao broker, RLS, revogação e revisão de rascunhos. Os ZIPs de instalação foram verificados como reproduzíveis.
- O patch `release/connect-ai/frontend-teste-fe8ecb2.patch` resolve os três conflitos de frontend preservando o código da base publicada de Teste. `git apply --check --binary`, build e check passaram. O teste PWA da revisão `fe8ecb2` espera sufixo de cache `pwa-v67-agenda` e recebe `pwa-v67-agenda-loja-ofertas-2`; a falha ocorre também no checkout original. Os testes focados de PWA e SDK na branch de desenvolvimento passaram.
- Rascunhos: revisão local em lote de até 20 edições textuais. A preparação reaproveita o contrato individual, detecta duplicação de publicação e chave de requisição e identifica rejeições por item. O MCP continua em leitura. Mídia, execução de operações em massa, destinatários, agendamento, publicação e métricas reais continuam em desenvolvimento.
- Próxima ação: confirmar gates de plano/custo, recuperação, privilégios efetivos e cliente OAuth registrado. Solicitar autorização específica para Produção, comprovar a leitura no Windows com conta elegível e confirmar saúde oficial antes de promover Teste. Web, iPhone, Sites, Claude, Gemini e Codex mantêm ensaios separados.

## Continuidade de 27/11/2026 — após homologação Desktop

Decisão do proprietário: deixar Nuvem, ChatGPT Web/iOS e Codex Nuvem pendentes. ZIP Desktop 1.0.5 e servidor publicado permanecem intactos. Último deploy da área Desktop/Nuvem no Vercel confirmado READY.

- **Conciliação**: 11 recibos na campanha visível e 3 em campanha excluída; diferença para os 14 registros gerais explicada.
- **Leitura App**: app_list, app_get e app_repeat_list verificados em Produção; uma campanha e uma publicação, zero séries e zero batches. Código candidato diferencia exibição App de envio WhatsApp. A flag de leitura App não foi ativada em produção.
- **Etapa 006**: no ambiente Teste, ensaio transacional com role authenticated, identidade administrativa de fixture, duas campanhas sintéticas e duas publicações por canal. Replay de request_id não duplicou; revisões 1→2 e conflito de revisão verificados; nenhum batch. Rollback integral. Candidato draft-writer.mjs restrito ao Teste, desativado por padrão e requer campaigns:drafts além de campaigns:read; o novo escopo ainda não é emitido. Não está registrado no MCP ativo. Lotes preliminares até 20; replays de edição retornam conflito quando revisão mudou, sem duplicação. Faltam consentimento granular, testes de isolamento e idempotência ponta a ponta e auditoria.
- **Etapas 007/009**: candidato get_publication_content/list_authorized_assets/list_destinations, sem URLs privadas, JIDs, dados de membros nem envio. Catálogos nativos consultados em Teste: 2 documentos e 0 grupos no momento do ensaio. Marcador deleted_at em app_get/get adicionado em migração candidata e testado em transação revertida. Não aplicar em produção sem homologação. Upload de mídia, vinculação e seleção de destino ainda não implementados.
- **Etapa 012**: catálogo candidato versionado preview.2 e manual determinístico regenerado; regras editoriais ampliadas; CI ainda deve concluir a suíte completa. Corrigido teste administrativo obsoleto após deploy do painel.
- **Etapa 013**: Cloudflare já registra telemetria HTTP. Trilhas de ações por conexão, quotas, custos e alertas próprios pendentes.
- **Validação focal**: 3 testes simulados do adaptador de rascunho e 6 do leitor passaram; teste SQL transacional validou 4 publicações; segundo ensaio confirmou marcador nos dois canais. Nenhuma publicação, envio, agendamento, alteração persistente do banco ou nova implantação executada neste ciclo.
- **Próxima ordem**: integrar emissão/consentimento explícito campaigns:drafts e homologar escrita apenas em Teste; homologar leitura editorial e catálogos e ativar App mediante release autorizado; preparar mídia privada, jobs persistentes e aprovação verificável. Não habilitar agendamento/publicação nem alterações destrutivas antes dos gates 010/011. Nuvem/ChatGPT fora do ciclo.

## Continuidade em lote — 27/11/2026
Autorização do proprietário para avançar nas tarefas independentes sem confirmação por etapa; passar as delicadas e registrar bloqueios. Nuvem e ChatGPT continuam adiados.
- 2994880 / b665b8c: escopo drafts opt-in exclusivo de Teste; consentimento distincto, tokens emitidos conforme escopo registrado, read-only antigo preservado, três operações de rascunho candidatas anunciadas somente a conexões habilitadas. 007 ensaiada junto das 001–003 em transação revertida no Supabase Teste. Seis testes do catálogo/handler passaram; CI completo do commit b665b8c retornou success.
- O Supabase Teste não tem tabelas Connect AI persistentes e a Cloudflare só tem o Worker de produção. Infraestrutura Teste isolada, login broker, configuração de cliente e bundle frontend continuam bloqueios de implantação; não reutilizar credenciais de Produção. A flag de escrita permanece zero. Nenhum deploy neste ciclo.
- 5c406a0: planejamento de mídia privada JPEG até 1 MiB, PDF/MP4 até 5 MiB; rejeição de URL arbitrária, tamanho e assinatura básica dos bytes, vinculação de proprietário/conexão/publicação/bloco/revisão; ainda exige parser/reencode seguro, ticket persistente e upload real. Planejamento de 60 rascunhos em chunks 6; 3 testes focalizados aprovados.
- 96a96c8: migração candidata 008, fila persistente de identificadores e resultados, leases, idempotência de criação de job, bloqueio de replay de resultado e registro mínimo de auditoria. Ensaio de 60 itens aprovado no Supabase Teste com rollback; leases expirados viram incertos sem retry automático. Ainda falta integrar runner e reconciliação, payload/digest e retenção.
- Manual regenerado com ferramentas candidatas e escopos. Painel candidato diferencia permissão de leitura e rascunhos. Nenhum novo pacote Desktop, alteração de Produção, envio, agendamento ou custo novo.
- Próximos gates: montar infraestrutura Teste sem novos custos não autorizados; compilar frontend de Teste sobre base correta; validar OAuth real com consentimento e isolamento, incluindo tentativas concorrentes de alterações/revogação; completar upload, job runner e confirmação verificável antes de publicação. Não ativar nenhuma ação externa automática.

## Continuidade 27/11/2026 — mídias 5 MiB e legendas
Pedido do proprietário: imagem até 5 MB, legenda opcional em imagem/vídeo/documento, texto separado, negrito. Produção primeiro, Teste junto. Nuvem e ChatGPT adiados.
- Editor publicado: Produção 7943d3c (Vercel dpl_4ZT5G36BgoNrWK6GvV4uDcfekcvN READY); Teste d4d9e35 (Vercel dpl_6Ny6vhGy16RXKXW2rjFxkEpXGByv READY), sobre bases independentes. Sem alterações de fila. Conversão legenda/texto separado cria bloco textual real e preserva marcas. Código integrado à branch de desenvolvimento.
- Storage privado já 5 MiB em ambos. Executor Produção 0.2.15 ainda limita imagem a 1 MiB. Candidato 0.2.16 (confirmar versão antes de liberar): C#, bridge, provider, IPC e media-plan 5 MiB; capability image5_v1, validação de conexão antes de envio e timeout maior; editor candidato adapta compressão ao max_image_bytes e mantém 1 MiB na ausência de capability.
- 009-image5.candidate.sql: flag false, limites por versão/capability e checagem no claim/start. Candidata, NÃO aplicada; revisar integralmente em ambos ambientes, validar rollback e assinaturas. App popup 5 MiB independente ainda pendente. src/cloud.js alterado, bundle dist/cloud.js precisa ser regenerado por build oficial. Não ativar 5 MiB antes do instalador assinado e compatibilidade confirmada.
- prepareMediaCaptionEdit é planejador candidato, sem operação registrada no MCP ativo; integrar a revisão protegida e tool schema antes de homologar.
- Próximo pacote Codex: compilar Windows, testes de bridge 5 MiB e 5 MiB+1, legenda marcada, sem legenda e texto separado, PDF/MP4; revisar gates de ambos ambientes e migração; atualizar editor e bundle; rodar CI completa e testes de navegador; preparar releases Produção e Teste em bases próprias, sem alterar pagamentos/autenticação/IA existentes. Não enviar mensagens reais automaticamente nem contratar recursos adicionais.

## Manual universal e consulta prévia obrigatória (candidato)
Fonte única em publication-guide.mjs, ferramenta get_publication_guide, instruções no initialize, versão obrigatória nas ferramentas candidatas de escrita. O servidor rejeita versão antiga/ausente antes de chamar adaptador. Isso não comprova leitura semântica nem autorização de envio; validações e consentimento continuam independentes. ChatGPT/Codex, Claude e Gemini usam o mesmo contrato; nenhum novo cliente OAuth habilitado, ZIP Desktop e produção ativos preservados. Atualizar guia e catálogo em toda mudança relevante do editor. Próximo gate: testar host real Claude e Gemini quando elegível, antes de ativar escrita.

Comprovante temporário assinado implementado: a consulta retorna guide_receipt às conexões de escrita de Teste. O handler rejeita comprovante ausente, vencido ou pertencente a outra conexão. Sem mecanismo configurado, as ferramentas de escrita não aparecem. Não prova compreensão do modelo; prova recuperação do manual. Não implantado.

## Candidata Windows 0.2.16 e qualidade de mídia

- Ponta remota reconciliada em `c516cb7`, descendente de `ad932d5`. Editor mantém os bytes e a resolução de JPEG válido dentro do limite negociado. Sem capability, segue o limite anterior de 1 MiB. Bundle do SDK web regenerado.
- A edição candidata de rascunho no MCP aceita alterar legenda, remover legenda ou inserir texto separado em bloco de imagem, vídeo ou documento já existente no WhatsApp. Reusa ACL, escopo de rascunhos, comprovante do manual, revisão e RPC existentes. Validação com marcas, emojis e quebra de linha; sem execução de envio.
- Pipeline Windows da branch compila candidata 0.2.16 sem distribuição. Authenticode, teste de instalação no Windows e assinatura da atualização são gates independentes.
- A migração 009 passa a ser atômica. As assinaturas e os pontos de substituição de texto precisam ser confrontados com os RPCs reais antes de aplicar. A versão histórica de Teste não contém todos os marcadores da variante de originais. A migração continua candidata com flag falsa. Não ampliar o limite do App nem promover antes da homologação da capacidade no Windows.
- Resultados locais: 33 testes MCP, 21 testes Windows/bridge e nove testes focados de frontend. Os executores de teste usam fixtures e não enviam mensagens reais. Pacote Desktop 1.0.5 preservado.
- `16a1cbb` foi enviado ao remoto. A regressão SQL em PGlite com funções sintéticas validou flag desligada, 5 MiB exatos, 5 MiB + 1, metadado inválido, capacidade ausente, executor legado e heartbeat expirado. Esse ensaio não comprova a forma das funções instaladas. Nenhuma migração remota executada.
- Suíte web final: 568/569, com a falha preexistente de badges no tema escuro. Build e check passaram. CI Windows configurado no commit `16a1cbb`, mas a API Actions respondeu 403 nesta sessão e não houve confirmação de compilação/assinatura. Nenhuma publicação foi feita. O primeiro gate de release continua sendo binário homologado e conferência das definições SQL instaladas, seguido de Produção e verificação antes de Teste.

## Consolidação da camada criativa e validação Windows — 27/11/2026
- Integradas as duas revisões da branch especialistas-criativos (313c0e3) sem sobrescrever o trabalho Codex (dea55b1). 20 referências externas, 9 métodos próprios, skill candidata e manual central 2026-11-27.3. GPTs externos não são invocados e métodos privados não foram extraídos.
- GitHub Actions 45993241414: compilação Windows 0.2.16 aprovada no commit 16a1cbb, manifesto validado; workflow sem release nem artefato de instalador disponível. Assinatura, instalação real e homologação continuam pendentes. CI MCP 45993562289 aprovado no dea55b1.
- Nenhum deploy ou alteração de banco neste ciclo. Manter limite efetivo de 1 MiB até release assinada, verificação das RPCs reais e executor homologado. Nuvem/ChatGPT Web/iOS adiados; Claude/Gemini ainda não homologados. Próximo: disponibilizar artefato candidato privado de CI e testar instalação/assinatura, revisar badges do tema escuro e preparar infraestrutura de Teste isolada.

## Continuidade após 4276b86

- [Matriz consolidada](NEOPEP-CONNECT-AI-MATRIZ.md) cobre as 20 prioridades e as próximas ações.
- A candidata 008 agora serializa operações por lote, bloqueia uma segunda janela enquanto existem leases ativos e retorna estado de cada item. Pausa e cancelamento impedem novas concessões. Leases expirados viram incertos e não são repetidos. Cancelamento preserva rascunhos salvos e permite registrar o resultado de operações em andamento. PGlite confirmou comportamento com 60 itens, replay de criação e isolamento por papel e proprietário. O executor e o painel ainda precisam ser conectados ao broker após teste de autorização.
- O preflight de leitura da 009 encontrou os cinco marcadores esperados nos dois bancos, com duas ocorrências do limite JPEG, uma do limite de referência, uma da flag retornada e uma em cada condição de claim/start. Os hashes dos RPCs diferem entre os ambientes, ambos usam SECURITY DEFINER e search_path fixo. Nenhuma função ou flag foi alterada remotamente. A distribuição assinada da candidata Windows ainda é pré-requisito para habilitar 5 MiB.
- Inventário real de Teste: sem tabela de ambiente, fila ou RPC de conexões. Cloudflare retornou somente o Worker Connect AI de Produção. O caminho cifrado e isolado de secrets e login do broker de Teste segue pendente.
- Build e check passaram. Web 569/569, MCP 36/36, contratos Windows e bridge 21/21, geradores e pacotes reproduzíveis aprovados. A compilação Windows anterior foi informada no run 45993241414. Nenhum instalador assinado ou implantação foi produzido neste ciclo.

## Álbum nativo WhatsApp — incremento de transporte

Baileys rc14 confirmado no pacote npm. Implementados pai, associações dos filhos e recibos conhecidos, com interrupção em falha e bloqueio de repetição por ID na sessão do bridge. Máximo de quatro JPEGs, 5 MiB por item e 10 MiB por álbum. O ponto de entrada Windows não habilita o comando. Testes Windows/bridge/provider 26/26, sem rede WhatsApp. [Contrato e gates pendentes](../release/connect-ai/010-whatsapp-album-contract.md). Não houve ativação ou deploy.

## Seleção múltipla no editor nativo

O seletor de fotos existente do WhatsApp importa até quatro imagens de uma vez como mensagens individuais, na ordem selecionada. Mantém os mesmos controles de legenda, ordenação e remoção dos blocos existentes. Uma foto continua pelo fluxo anterior. A conversão termina antes de gravar o conjunto no IndexedDB em uma única transação; falha de conversão não cria rascunho parcial. O guia 2026-11-27.5 e o painel gerado registram a capacidade efetiva. O bridge normaliza o UUID para bloquear replay na mesma sessão inclusive com maiúsculas.

O álbum agrupado ainda depende do bloco compartilhado, validação do Supabase, fila e recibos persistentes, executor Windows e integração MCP. O protótipo de transporte continua desligado. Nenhum envio, migração ou deploy executado.
- Incremento `cb5a368` enviado ao GitHub. Build e check passaram, com 570/570 testes web, 36/36 MCP e 26/26 contratos Windows/bridge/provider. Geradores conferidos. Sem homologação física no WhatsApp.

## Prévia agrupada no seletor nativo

Base remota confirmada em `1c86ead`. O seletor WhatsApp oferece mensagens individuais (padrão) ou prévia local agrupada. Agrupa blocos JPEG existentes pelo mesmo `album_id`, mantendo ID, ordem, texto e mídia local de cada item. Edição de legenda, remoção, ordenação interna e ampliação reutilizam o fluxo de imagem. A separação explícita remove o agrupamento. Ao separar uma legenda, o texto independente entra depois do álbum. Limites locais de duas a quatro imagens na seleção, até o limite JPEG negociado por item e 10 MiB no total. A versão do guia e da base gerada passa a 2026-11-27.6.

O marcador local ainda não é um contrato de publicação. O editor bloqueia registro remoto, agendamento e despacho enquanto o rascunho contém agrupamento. A fila, a validação SQL, o executor `album_v1`, os recibos persistentes e as ferramentas MCP continuam pendentes; o bridge permanece desligado. Nenhuma migração, publicação ou envio real realizado.
- `eb842b0` enviado ao GitHub. Build, check e geradores passaram. Suítes: 571/571 web, 36/36 MCP e 26/26 Windows/bridge/provider. Inclui teste focal de agrupamento e limite total. Não houve validação visual em dispositivo físico.

## Álbum em versões nativas de rascunho

Base `29a9bac` conferida. A candidata 011 mantém os blocos de imagem, IDs e `album_id` na tabela de versões existente. A revisão nativa conserva a ordem na matriz JSON. A validação confere JPEG privado e pertencente ao titular, caminho vinculado ao ID de imagem, 2–4 imagens consecutivas e distintas e limites de legenda e tamanho. O limite remoto conservador é 1 MiB por imagem até existir negociação homologada no servidor. O editor consulta a capacidade de persistência antes de permitir o upload e o registro. Preserva a prévia local se o servidor ainda estiver na versão anterior.

Os dois bancos têm o mesmo hash de corpo da RPC de edição, a lista de campos esperada e as duas tabelas de lotes com a coluna de revisão. Consultas remotas foram só de metadados. O patch candidato exige o hash e marcadores exatos, preserva a autorização nativa e instala bloqueio de inserção nas duas filas se a revisão contiver álbum. Nenhuma migração remota aplicada; nenhum recurso foi ativado.

Leitura MCP preserva a ordem e o `album_id` sem expor caminhos. A edição `albumEdit` aceita uma permutação completa dos IDs existentes e legendas, com a autorização e o controle de revisão já existentes. Uma legenda convertida em texto separado fica depois do grupo. Guia e base gerada atualizados para 2026-11-27.7.

O ensaio PGlite usa RPC e objetos de Storage fictícios. Ele cobre quatro imagens, duas revisões manuais, consulta e revisão via adaptadores MCP, titularidade, contiguidade e recusa das filas, além de publicação individual legada. Ainda faltam criação MCP com mídia autorizada, lote, suporte ao álbum na fila, recibos duráveis, Windows, agendamento simulado e falha parcial através dessas camadas. Sem homologação ou deploy.
- `84a1381` enviado ao GitHub. Build, check, geradores, web 571/571, MCP 37/37 e Windows/bridge/provider 26/26 aprovados localmente. O teste integrado termina no bloqueio do agendamento; não executa a entrega ou a recuperação de recibos. Nenhum deploy.

## Executor Windows e recibos de álbum

Base remota `583c850` preservada. Candidato C# ligado ao bridge `send_album`, com capability independente em claim/start e transporte bloqueado na build. A migração 012 registra o pai e filhos conhecidos na mesma linha da tentativa nativa, usando o finish autenticado e com fence. O estado aceito exige todos os recibos. Dados parciais permanecem incertos. Teste PGlite liga Baileys simulado com falha parcial ao finish e confirma que tentativa encerrada ou com lease vencido não volta ao claim. Usa uma linha pré-semeada, sem passar pelo agendamento nativo.

Faltam criação da unidade de fila, validação de capability e lease no servidor, ensaio agendado com a resolução real de destinos, compilação física Windows, criação MCP e lotes 30/60. Nenhuma migração, publicação, execução de envio real ou ativação desta capacidade.
- `add_publications` aceita blocos consecutivos de álbum a partir de IDs de JPEGs já armazenados. Caminhos são derivados do titular autenticado, com validação adicional da candidata 011 no Storage. Não há transferência de novos criativos. Guia e base gerada passam a 2026-11-27.8. Testes focais ligam criação e edição do rascunho em uma fixture, e transporte/recibos em outra. O teste obrigatório de ponta a ponta continua pendente.
- `edd9b56` enviado ao GitHub. Build e check aprovados, web 571/571, MCP 38/38, Windows/bridge/provider 27/27, pacotes e geradores verificados. Os testes C# desta sessão são verificações de contrato de fonte; a compilação do candidato pós-álbum e sua assinatura não foram confirmadas.

## Identificação WhatsApp e preflight Connect AI de Teste

Base remota `1fc70fc` incorporada. A candidata 013 atualiza nome e número separadamente no registro atual, com prova de dispositivo, titularidade e vínculo com a mesma conta. A operação não toca grupos, revisão, data de sincronização ou estado. O Windows reporta após o evento account e após o primeiro vínculo. Quando detecta mudança de número, revoga a referência anterior e usa nova conexão sem grupos herdados. O número fica no cofre DPAPI existente no Windows para comparar reconexões; a consulta web usa RPC separada com ACL administrativa, sem acrescentar dados ao catálogo MCP. A interface exibe um cabeçalho por conexão acima dos respectivos grupos. Sem endpoint novo, mantém o rótulo legado.

Em leitura remota, o Supabase Teste não tem tabela de ambiente nem lote Connect AI. No Cloudflare só foram localizados Worker e Hyperdrive de Produção. O bundle Teste foi empacotado com Wrangler 4.54.0 em dry-run e as três flags desativadas. Faltam migrações específicas, login restrito, Hyperdrive independente, secrets OAuth, domínio e homologação. Nenhuma credencial de Produção reutilizada. O contrato de álbuns permanece fechado para envio.

Testes focados cobrem prova de dispositivo, recusa de conta comum, agrupamento de duas linhas sem repetir telefone e manutenção da revisão e seleção. Nenhuma migração remota, distribuição Windows, publicação ou envio realizado. O fluxo completo de rascunhos, mídia, lotes e base de conhecimento persistente continua pendente.

## Continuidade após interrupção do Codex — 27/11/2026
- HEAD recebido 06b3eb8: implementação da identidade WhatsApp. CI MCP 46003505374 e Windows 46003505327 aprovados. Assinatura e instalação não confirmadas. SQL 013 ensaiado em Produção e Teste em transações revertidas; anon sem EXECUTE e authenticated sem SELECT direto na tabela. Não aplicado.
- Supabase Teste qnuluspqfazdppciermw: instaladas, via apply_migration, connect_ai_test_readonly_foundation (001–003) e connect_ai_test_draft_jobs_disabled (007–008 e 014). O gate 014 exige drafts_enabled para registro de escopo de rascunhos e operações de lotes; default false. Nenhuma mudança persistente em Produção.
- Verificação posterior: oito tabelas protegidas por RLS, zero conexões, sessões de ensaio revertidas, zero jobs, itens ou auditorias. Broker NOLOGIN, sem SELECT em campanhas/auth.users; authenticated sem leitura direta de conexões/jobs e anon sem acesso aos RPCs avaliados. Teste autenticado de list/register read/revoke aprovado com rollback. Ensaio de 60 itens verificou uma lease por lote, idempotência, pausa, retomada, cancelamento, resultado incerto e preservação de item salvo. Teste de gate false recusou register_drafts. Ações sintéticas revertidas.
- Advisors retornou INFO de tabelas com RLS sem policy (acesso direto negado por design) e WARN de RPC SECURITY DEFINER executável por authenticated (necessário à função de conexões com ACL/issuer/owner). Revisar antes da ativação, não remover controles. Nenhuma alegação de auditoria global aprovada.
- Inventário Cloudflare ainda mostra apenas Worker/Hyperdrive Produção. Próximo: confirmar backup recuperável/quotas, criar login exclusivo Teste e provisionar Worker/Hyperdrive e secrets independentemente; manter NEO_CONNECT_AI_ENABLED, NEO_CONNECT_AI_READ_APP, NEO_CONNECT_AI_DRAFTS e drafts_enabled desligados até seus gates. Nenhum deploy Vercel/Worker ou envio neste ciclo. Não reutilizar credenciais. Nuvem/Web/iOS continuam adiados.

## Continuidade — intertravamento Worker/banco
- Supabase Teste ACTIVE_HEALTHY. Inventário Cloudflare: um Worker e um Hyperdrive de Produção. Limites oficiais Hyperdrive incluem 10 configurações no Free e 100.000 consultas/dia; sem contratação nova nesta rodada. Backup recuperável e provisionamento seguro de credencial ainda não confirmados. Não criar login nem reaproveitar segredo de Produção.
- Worker candidato consulta drafts_enabled no broker antes de anunciar escopo e ferramentas; revalida antes de chamar o writer; broker reduz escopos ao desligar gate. Produção continua somente leitura. Teste cobre flags desligadas, ligadas, valor não booleano e falha do broker. O gate não cancela transação já iniciada nem substitui autorização e revisão nativas. Nenhum deploy.

## Publicação incremental da base de conhecimento — 27/11/2026
- CI 46004554506 do commit 7ed41f1: success (intertravamento de escrita Worker/banco). Sem deploy do Worker.
- Produção: commit 3164ccc09cca6385867f44fb7d616dc1faac097d na branch desenvolvimento/campanhas-legendas-producao-20261127; deployment dpl_3LbnYh2id5QL1MmpqkncS9GJBUqp READY com alias app.neopep.com.br. Alterados apenas painel, snapshot e index; OAuth e ZIP 1.0.5 preservados. Rollback anterior dpl_4ZT5G36BgoNrWK6GvV4uDcfekcvN.
- Teste: commit 9f236f0910eb54ce82485f8c26ea2cc84ac39b6f na branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126; deployment dpl_BmEi6SBW7imZXCo3XCMnEf95sFB8 READY com alias teste.app.neopep.com.br. Painel somente consulta sobre base própria; sem OAuth, gestão de conexões ou escrita. Rollback anterior dpl_6Ny6vhGy16RXKXW2rjFxkEpXGByv.
- Ambos servem HTTP 200 no /admin/, snapshot 2026-11-27.8 e script do painel; snapshot contém 9 métodos e 20 referências, sem recibos ou capacidades de runtime. Ordem Produção → verificação de assets → Teste cumprida; homologação interativa com sessão admin ainda pendente. O manual publicado é referência candidata, não catálogo MCP ativo. Nenhuma publicação de campanha, alteração de banco ou contratação nova nesta rodada.
- Hyperdrive/Worker Teste ainda pendentes de backup verificável e provisionamento seguro de credenciais isoladas. Não substituir por segredo de Produção. Base de conhecimento editável, upload e executor de lotes permanecem pendentes.

## Lotes retomáveis — integração candidata 015
Persistência imutável de conteúdo de cada publicação em tabela privada existente, criação/claim com payload, e runner interno que chama exclusivamente add_publications do gravador nativo, em blocos de até seis, com revalidação de acesso, pausa e estado. Resultado não confirmado é incerto e não reexecutado automaticamente. Sem nova ferramenta pública, sem migração aplicada, sem execução real; faltam adapter broker/runtime, teste SQL integrado, painel, homologação de acesso e ativação. Os testes JS usam broker simulado. Nenhum envio ou agendamento.

### Verificação e instalação 015 — Teste
CI 46006069555 aprovado. Ensaio transacional de 60 payloads no Supabase Teste: idempotência, rejeição de conteúdo alterado, claim de seis itens, recuperação do conteúdo correto após expiração, bloqueio do gate e ausência de acesso direto avaliados. Aplicada migração connect_ai_test_job_payload_disabled. Após aplicação: drafts_enabled=false, zero conexões, zero jobs/itens, broker NOLOGIN, anon sem EXECUTE do claim. Sem mudanças em Produção. Adaptador privado de jobs adicionado ao broker candidato: operações create/claim/control/result com RPCs parametrizadas, verificação da sessão, titularidade, escopos e flags; NEO_CONNECT_AI_JOBS=0 por padrão. Ainda não registrado no catálogo MCP, sem deploy, sem integração ativa do runner ao handler. Próximos: submissão em partes respeitando limite MCP, runner/runtime, painel, credenciais isoladas e homologação.
