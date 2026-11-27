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

## Continuidade auditada — 27/11/2026
- `313c0e3`: contrato preview.4 e guia 2026-11-27.3 incluem nove métodos criativos. `09e7aff`: corrigida referência de legenda para update_publications (mediaCaption); `14dd2e7`: teste de coerência do catálogo e isolamento. Execução dos novos testes ainda não comprovada.
- Consulta real ao projeto Supabase Teste confirmou dez tabelas neo_private.connect_ai_*: audit_events, connections, consent_claims, draft_job_items, draft_jobs, environment, job_assembly, media_tickets, oauth_grants, sessions. Todas têm RLS e não concedem SELECT direto a anon/authenticated. Esta evidência substitui a anotação anterior de ausência das tabelas; não comprova a integridade de todas as migrações nem autoriza reaplicá-las.
- Consulta à Cloudflare confirmou somente neopep-connect-ai-production. O Worker Teste ainda não existe. wrangler.staging.jsonc já existe com flags ENABLED/READ_APP/DRAFTS em zero; environment-worker.mjs já integra OAuth, broker e adaptador de rascunhos. Reutilizar estes componentes.
- Próximo gate: validar identidade do banco e funções/privilégios do broker, provisionar Worker Teste e segredos exclusivos, sem custo novo não autorizado; comprovar OAuth e isolamento antes de ativar escrita. Não reutilizar credenciais de Produção. Nenhuma migração, deploy manual ou envio executado nesta rodada.

## Provisionamento isolado Teste — 27/11/2026
- Banco confirmado pelo marcador project_ref. Perfil neo_connect_ai_broker existente, sem login/superuser/bypassrls; privilégios de leitura por coluna verificados para connections e oauth_grants; políticas RLS existentes. Nenhuma ampliação de privilégios do broker.
- Migração remota Teste `connect_ai_test_broker_login` aplicada com sucesso: usuário dedicado neo_connect_ai_test_login criado NOLOGIN, INHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, membro de neo_connect_ai_broker. Consulta posterior confirmou NOLOGIN, sem superuser/bypassrls e associação ao broker.
- Hyperdrive incluído no plano gratuito Cloudflare (100 mil consultas/dia conforme documentação oficial). Configuração proposta exclusiva Teste, cache desligado, limite de cinco conexões à origem. A transferência automatizada de credencial foi bloqueada pelo ambiente; verificação posterior confirmou usuário ainda NOLOGIN. Não tentar contornar o bloqueio; provisionar senha via interface segura Supabase/Cloudflare ou operador autorizado, sem gravar senha no GitHub/chat. Hyperdrive/Worker ainda não criados. Flags mantidas zero. Produção intacta.

## Hyperdrive Teste confirmado e vínculo do Worker
- Proprietário concluiu configuração manual das credenciais e Hyperdrive. Consulta Cloudflare confirmou neopep-connect-ai-teste, ID 3d481b9cf7c848888a6982ba3c1b1eb4, host do projeto Teste, usuário neo_connect_ai_test_login, cache desativado. Hyperdrive de Produção permanece distinto. Tráfego pelo Worker ainda não comprovado.
- `1258d84`: binding NEO_CONNECT_AI_DB adicionado ao wrangler.staging.jsonc; ENABLED, READ_APP e DRAFTS permanecem zero. `9985fdf`: workflow connect-ai-contract passa a incluir branch atual, preservando a antiga. Consulta Actions ainda não retornou execução; não declarar testes aprovados.
- Worker Teste ainda não implantado. Próximo gate: build real com dependências fixadas, verificar CI, configurar segredos próprios e publicar inicialmente desativado. Não usar bundle ou segredos de Produção. Nenhuma ação de campanha executada.

## Bundle Teste aprovado — 27/11/2026
- `b19545b`: script build-staging-bundle.sh derivado do procedimento de produção com assert de Hyperdrive Teste e flags zero. `2f4052a`: CI compila e disponibiliza artefato sem deploy.
- GitHub Actions 46014527297 success; artefato 15205706304 recuperado; SHA-256 do ZIP externo coincide com digest GitHub b5e1123804c7e1cef010ff3c7ecc8a0edf6884d64fc227b8d81f92a63ab42d97. SHA256SUMS interno validado para staging-entry.js e wrangler.staging.jsonc. Configuração confirma nome Teste, Hyperdrive exclusivo e flags zero. Nenhum deploy ainda; transferência do bundle compilado ao API Cloudflare não disponível diretamente pelo conector. Usar Wrangler com o ZIP homologado em sessão autorizada, sem inserir credenciais no GitHub/chat. Depois configurar hostname e segredos Teste, validar OAuth/leitura, só então escrita.

## Worker Teste publicado, domínio e configuração criptográfica — 27/11/2026
- Upload manual confirmado (versão 11f9e535-2c18-4a10-b945-4882387e7067), Worker neopep-connect-ai-teste, Hyperdrive exclusivo, flags zero. Cloudflare confirmou domínio connect-teste.neopep.com.br vinculado ao Worker Teste, Produção permanece distinta.
- Geradas no ambiente Cloudflare chaves de sessão, CSRF e par ES256 exclusivo Teste, identificador e chave publicável Supabase Teste; API confirmou gravação e lista de seis nomes. Nenhuma chave privada foi devolvida no resultado nem gravada no repositório. CLIENTS configurado para mapa vazio, a ser consumido pelo novo candidato; validar bindings antes de ativar.
- `abf87f9`: permite mapa estático vazio somente em Teste, reutilizando descoberta CIMD oficial existente; `0654b64`: regressão verifica metadata, rejeição de cliente desconhecido, configurações inválidas e preservação do requisito Produção. Não criar clientes fictícios nem copiar configuração de Produção. CI e novo bundle pendentes de confirmação. Worker atual permanece desligado até publicar candidato atualizado, verificar metadados/Hyperdrive e homologar OAuth real. Sem escrita ou envio.

## Atualização operacional — 27/11/2026
- Proprietário implantou bundle 01c9181 via Wrangler; versão informada no terminal e219eb8a-c7c1-4927-9f8d-ed7d9c0f07e6. Cloudflare confirmou domínio e sete secrets preservados, Hyperdrive Teste correto.
- PATCH de settings exclusivo Teste bem-sucedido; consulta posterior confirma ENABLED=1, READ_APP=0, DRAFTS=0, sete secrets preservados. Nenhuma alteração em Produção. WhatsApp leitura somente após autenticação.
- Tentativa de consultar endpoints discovery/JWKS pela ferramenta web retornou indisponibilidade da ferramenta, sem status HTTP verificável do servidor. Próximo passo: validar HTTP pelo operador (curl), discovery e JWKS, confirmar 401 sem token e então autenticar plugin Desktop no Teste. Se resposta real 503 persistir, desativar ENABLED e investigar Hyperdrive/configuração. Não reimplantar/recriar recursos já confirmados sem necessidade. Não habilitar escrita.

## Evidência HTTP real — 27/11/2026 14:46:27 UTC
- Operador executou curl.exe -i https://connect-teste.neopep.com.br/.well-known/oauth-authorization-server e apresentou captura com HTTP/1.1 200 OK, JSON de discovery, issuer e endpoints exclusivos Teste, JWKS URI, PKCE S256, authorization_code/refresh_token, CIMD true e scopes_supported exclusivamente campaigns:read. Pelo fluxo do environment-worker, a verificação inicial do banco e configuração OAuth passou; não comprova consentimento, emissão de token ou leitura de campanhas.
- Próximo gate: testar JWKS público e rejeição 401 do MCP sem token; depois autenticar Desktop apontado para Teste, consentimento e leitura real. DRAFTS=0 e READ_APP=0 mantidos. Não repetir deploy, domínio, Hyperdrive ou secrets.

## Validação HTTP inicial concluída — 27/11/2026
- Capturas do operador: discovery HTTP 200 às 14:46:27 UTC; JWKS HTTP 200 às 14:47:14 UTC com chave pública EC P-256 ES256, kid exclusivo Teste, sem componente privado; POST /mcp sem token HTTP 401 às 14:47:41 UTC, WWW-Authenticate Bearer apontando resource_metadata exclusivo Teste. Três gates HTTP iniciais aprovados.
- Próximo gate único: autenticar Codex Desktop existente no endpoint https://connect-teste.neopep.com.br/mcp, confirmar consentimento no app Teste e executar leitura real. Não reinstalar plugin nem repetir deploy ou testes HTTP já aprovados. READ_APP e DRAFTS continuam zero; não enviar/publicar/agendar. Ainda não comprovados emissão de token, sessão autenticada ou leitura real.

## Homologação Desktop bloqueada
- Operador apresentou resposta Codex sem ferramentas MCP Teste expostas na sessão. Consulta Supabase Teste confirmou zero sessões MCP não expiradas. Não comprova causa específica. Próximo passo: conferir configuração local do servidor, URL e estado de autenticação no Desktop; não repetir infraestrutura. Escrita permanece bloqueada.

## Consentimento do painel Teste — 27/11/2026
- Codex tinha apenas plugin Produção. Operador cadastrou MCP personalizado neopep-teste (HTTP streaming, https://connect-teste.neopep.com.br/mcp), habilitou e clicou Autenticar; redirecionamento para teste.app.neopep.com.br/admin/ confirmado. Painel exibiu somente base de conhecimento, sem consentimento.
- Vercel Teste projeto prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq, deploy dpl_BmEi6SBW7imZXCo3XCMnEf95sFB8, commit 9f236f0, branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126, referência 2026-11-27.8. Causa: painel referência-only, SDK sem approveConnectAI e CSP sem host MCP Teste.
- Correção atômica 2826632a0567f38550d5f86b35185d4555ac08db aplicada à branch EXISTENTE de publicação Teste, sobre a versão publicada, não à Produção. Reaproveita validação OAuth, vincula host/projeto Teste, restringe consentimento a campaigns:read, preserva mountKnowledge, adiciona CSP somente host Teste e cache-bust, teste de regressão e gatilho CI. Build oficial Vercel regenera dist/cloud.js. Nenhuma migração, segredo ou Worker alterado. CI e deploy ainda sem resultado confirmado.
- PONTO ATUAL: conferir CI da branch de publicação Teste e implantação do commit 2826632; publicar apenas nesse projeto se não houver deploy automático e CI aprovado. Não publicar branch de desenvolvimento MCP inteira no app. Depois reiniciar autenticação pelo Codex (solicitação expira em 2 min), autorizar leitura e verificar sessão/consulta real. Escrita desativada. Não repetir cadastro do MCP ou infraestrutura.

## CI do consentimento Teste — 27/11/2026
- Run 46021668115 do commit 2826632: build, check e auditoria aprovados; suíte completa 522 pass, 4 fail, 1 skipped; teste novo OAuth não falhou. Falhas: cache PWA esperado antigo, duas verificações de versões JS desatualizadas, teste CSS de badges examinava todos os estilos posteriores em vez do bloco alvo. Conferidos arquivos e logs.
- Commit 0171694219dc34e18e4eece8c547c14d514987ac na branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126 corrige exclusivamente quatro arquivos de testes: mantém asserções de versão exata e restringe teste CSS ao bloco de contadores delimitado pelo próximo comentário. Nenhuma alteração de runtime nesta rodada. Nova execução CI ainda não apareceu na consulta.
- PONTO ATUAL: aguardar evidência CI de 0171694; consultar Vercel Teste projeto prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq e publicar somente commit aprovado se necessário. Domínio ainda estava em 9f236f0 na última confirmação; não declarar correção publicada. Depois reautenticar Codex. Sem escrita e sem alterações Produção.

## Consentimento aprovado em CI; limite Vercel — 27/11/2026
- Staging CI run 46021989574, commit 0171694219dc34e18e4eece8c547c14d514987ac, conclusão success. As quatro verificações reconciliadas; código de consentimento aprovado em CI.
- Consulta por SHA no projeto Teste prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq não encontrou deploy. Tentativa explícita de criar deployment no projeto app-neopep-staging (target production interno desse projeto de Teste) pelo Git source exato retornou HTTP 402 api-deployments-free-per-day (mais de 100), retryAfter 86400. Nenhuma publicação criada; sem CLI autenticado disponível. Não alterar plano, não criar outro projeto para contornar limite.
- PONTO ATUAL: retomar diretamente na publicação do commit 0171694 no projeto Teste quando a cota permitir, sem novo commit de código nem repetir CI/infra. Conferir alias teste.app.neopep.com.br e SHA efetivo; reiniciar OAuth Codex e validar leitura real. Produção intacta; READ_APP/DRAFTS zero.

## Executor de lotes de rascunhos — 27/11/2026
- Vercel segue bloqueada conforme registro anterior; candidato de consentimento 0171694 aprovado e pronto para publicação Teste, não alterado nesta rodada.
- Auditoria de leitura no Supabase Teste confirma funções privadas connect_ai_job_assemble, claim, claim_payload, control, create, create_payload, result com EXECUTE do broker e job_check sem EXECUTE direto. Inspecionadas definições de claim/claim_payload/control/create_payload/result: payload persistente, até seis itens por lease de dois minutos, exclusão mútua de lote ativo, pausa/resume/cancel, status sem payload, recibo com lease e expiração, estado uncertain sem replay. Registro de 008 original não representa todo o esquema atual. Nenhuma migração executada.
- Commit f1c311e0ad1bd606b81146b83ceaae4008915e69 adiciona draft-job-runner.mjs e sete testes de contrato: 60 itens/10 chunks, flags e escopos, pausa/cancelamento, timeout/ambiguidade, recibo rejeitado, revogação/deadline, payload divergente. Executor candidato processa um chunk explícito, revalida por item, só chama add_publications, grava resultado via callback com IDs e lease, não repete resultado incerto e não retorna payload. Flag local default false. Não ligado ao broker, catálogo ou Worker ativo. CI 46023986426 em execução na consulta inicial; ainda não homologado.
- PRÓXIMO: confirmar CI de f1c311e; integrar callbacks privados ao session-broker com flags Teste e revalidação de sessão não cacheada, testar contrato real de claim/status/result em fixture transacional sem efeitos duráveis, e reconciliar leases/recibos incertos antes de expor ferramenta. Manter escopos DRAFTS/READ_APP desligados e nenhum envio, publicação ou agenda. Retomar consentimento pelo deploy 0171694 assim que Vercel permitir.

## Integração privada do executor — 27/11/2026
- CI 46023986426 (f1c311e) e CI 46024220133 (20d984c80b51f64af17fdc98e0177e5abbe297ab) concluídos com sucesso. Novo commit liga executor ao session-broker por método privado runDraftJob, sem rota HTTP/MCP, com SQL parametrizado claim_payload/control(status)/result, marcador de ambiente, sessão administrativa revalidada sem cache, validade do principal e escopos. Exige ENABLED=1, DRAFTS=1 e nova flag NEO_CONNECT_AI_DRAFT_JOBS=1. Nenhuma flag configurada ou Worker implantado. Quatro testes novos verificam assinaturas/recibo, bloqueios, marcador, revogação após claim.
- Banco Teste: assinaturas e EXECUTE do broker reconfirmados. Ensaio com sete itens sintéticos em subtransação foi rejeitado no primeiro claim (42501 forbidden), pois connect_ai_job_check exige drafts_enabled=true no marcador de Teste. Consulta posterior confirma drafts_enabled=false, zero conexões e jobs do fixture. Não houve efeito durável nos registros; não foi alterada a flag nem efetuado upload/escrita de campanha. Evidência real de bloqueio, NÃO de execução positiva. A homologação positiva permanece condicionada à leitura autenticada e à autorização de escrita Teste; não contornar a trava.
- PONTO ATUAL: consentimento Teste 0171694 aprovado, ainda bloqueado pela cota Vercel. Em paralelo avançar implementação de reconciliação de recibos incertos e upload privado sem ativação. Executor privado 20d984c aprovado CI, ainda não exposto; falta homologação positiva de fila, preparação do catálogo/consentimento granular e retenção. DRAFTS/READ_APP desligados, Produção intocada; nenhum envio/agendamento/publicação.

## Reconciliação de resultados incertos — 27/11/2026
- Auditoria de leitura das funções nativas campaign_app_central, neo_campaign_central_v1 e neo_campaign_editor_v1 no Supabase Teste confirmou histórico campaign_editor_versions com request_id único, owner_id, editor_id, source_id, channel, revision e draft. App e WhatsApp ligam publicação nova ao editor por UUID; o RPC load omite request_id. Audit_events aceita item_result/saved. Não expor histórico bruto ao MCP.
- Commit 3a034ac51c1cc6c60fed0777f27beab446ed11fe prepara release/connect-ai/010-job-reconcile.candidate.sql e teste PGlite. Reconciliação privada, escopada por conexão e proprietário, somente estado uncertain sem lease; exige request_id, editor_id, source_id, channel, revisão 1, payload nativo exatamente igual ao original e vínculo Central. Apenas registra receipt saved e auditoria; ausência/divergência conserva uncertain; nunca reenvia, agenda, publica ou transforma em retryable. Prova histórica não indica estado atual da publicação. SQL btrim pode ser mais restritivo que JS trim em whitespace não ASCII, resultando conservadoramente em uncertain. Sem nova permissão pública. Candidata não aplicada, não ligada ao broker/Worker. Teste CI ainda não confirmado.
- PRÓXIMO: conferir CI de 3a034ac, integrar método privado de reconciliação com as mesmas flags do executor, preparar verificação de migração e ensaio positivo somente após autenticação e escrita Teste autorizadas. Em paralelo avançar upload privado. Vercel continua bloqueando consentimento 0171694; não repetir desenvolvimento já aprovado. Nenhuma alteração no banco, Worker ou Produção nesta rodada.

## Consolidação de reconciliação e tickets de mídia — 27/11/2026
- CI 46024656962 (3a034ac) e 46025050323 (4d575242efdb34835d1e3cf6466759cee97c34ba) concluídos com sucesso. Método privado reconcileDraftJob integrado ao session-broker e ao executor com as três flags existentes, revalidação de sessão e marcador, SQL parametrizado, projeção mínima de recibo, sem replay. Migração 010 continua candidata NÃO aplicada. Sem rota MCP ativa.
- Auditoria de leitura do Supabase Teste confirma connect_ai_media_ticket(uuid,uuid,uuid,text,jsonb) com EXECUTE broker e ações issue/inspect/claim/finish, reserva e lease de dois minutos, TTL, validação de propriedade, estado uncertain, até 120 tickets vigentes/conexão e confirmação de metadados Storage. SQL instalado restringe JPEG a 1048576 bytes, PDF/MP4 WhatsApp a 5242880, App somente JPEG; não igualar prematuramente ao alvo 5 MiB. planUpload candidato exige revisão >=1, mantido por segurança nesta fase. Não replicar tabela ou função.
- Commit 4b940d20e2372c1aa8d101ab68729da1d646a7f0 implementa media-ticket-broker privado issue/inspect, ligado ao session-broker, com flags ENABLED/DRAFTS/MEDIA, sessão fresca, marcador, validação do contrato real e recibo sem path/lease. Quatro testes candidatos (limites, isolamento, projeção, divergência). Sem claim/finish/upload; sem parser/reencode, escrita ou publicação; CI ainda não confirmada.
- Vercel Teste reconfirmada em 9f236f0, consentimento 0171694 aprovado continua não publicado. Último erro de cota 402 conforme registro; não efetuar novo deploy sem necessidade. Produção/Worker/flags intocados nesta rodada.
- PRÓXIMO: confirmar CI de 4b940d2; preparar validador completo de bytes e fluxo claim/upload privado/finish com verificação do objeto e reconciliação de mídia, sem ativação. Homologar Windows 0.2.16 assinado antes de ampliar JPEG. Depois do deploy 0171694, autenticar Codex e homologar leitura, autorizar separadamente escrita Teste, migração 010 e fixtures positivas; expor operações por escopo somente após gates. Destinatários, aprovação verificável, agenda/publicação e auditoria operacional permanecem pendentes; Nuvem/Web/iPhone adiados. Nenhuma ação de campanha executada.

## Escopo fechado da primeira versão operacional e transporte privado — 27/11/2026
- Proprietário aprovou concentrar a entrega nos cinco pacotes restantes, sem expansão de escopo: 01 upload privado/validação de mídia; 02 Windows 0.2.16 e imagens 5 MiB; 03 destinatários; 04 aprovação verificável, agendamento e publicação; 05 painel operacional, auditoria e homologação integral. OAuth/leitura real Teste é gate transversal, não nova feature. Nuvem/Web/iPhone adiados. Preservar Produção e Desktop 1.0.5.
- CI 46025148249 do commit 4b940d2 concluído com sucesso: tickets issue/inspect aprovados. Consulta real ao Storage Teste confirma neo-campaign-images e neo-campaign-originals privados, ambos com 5242880 bytes de limite físico, MIME JPEG/PNG/WebP e PDF/MP4 respectivamente, políticas SELECT/INSERT autenticadas já existentes; não alterar ACL. Ticket mantém limite JPEG 1 MiB e App somente JPEG.
- Commit bf72ed7c7824450c9e68e0dc071649f1f7d80b60 adiciona media-storage.mjs e quatro testes simulados: transporte POST sem sobrescrita, GET autenticado, limite de leitura, SHA-256 de conferência, rejeição de redirecionamento, revalidação de sessão, ausência de retry automático. Validador confiável completo obrigatório por injeção; magic bytes não bastam. Validador real, ligação claim/finish e recuperação de mídia incerta ainda pendentes. Não exposto em HTTP/MCP, sem chamada real de storage, nenhuma flag ativada. CI ainda não confirmado.
- PONTO ATUAL: confirmar CI bf72ed7; concluir validador confiável e integrar lease claim/finish/estado uncertain com transporte e revisão do bloco; validar fixture real apenas após os gates de autenticação/escrita Teste. Depois avançar pacote 02–05 na ordem aprovada. Consentimento 0171694 pronto, Vercel com último erro 402; não repetir deploy até cota disponível. Migração 010 candidata não aplicada. Nenhum recurso pago, nenhuma operação de produção ou envio/agendamento/publicação.

## Pacote 01: fluxo privado completo candidato e núcleo de validação offline — 27/11/2026
- CI 46025858158 (bf72ed7), 46026649374 (ec98fd4), 46026745119 (fb8ce58) concluídos com sucesso. ec98fd4 integra inspeção, validação prévia, revisão nativa, claim, POST sem overwrite, GET+SHA256, finish e save com revisão. Falhas ficam upload_unconfirmed ou stored_attachment_unconfirmed; sem retry automático. fb8ce58 exige binding privado NEO_CONNECT_AI_MEDIA_VALIDATOR e prova exata de MIME/tamanho/SHA256/política/fullParse/contentSafety; binding ausente bloqueia upload.
- d81aa21 prepara 011-media-attachment-receipt.candidate.sql, método privado de consulta histórica por ticket/owner/connection/request/revisão anterior e posterior/draft exato. Não reenvia mídia, não modifica publicação e não prova estado presente. Migração não aplicada. CI verificar resultado.
- 126bc4d4c45c4bfa9b4cba52fb58190ea0715167 versiona núcleo offline validator-candidate/validator.py. Blob fa4b3bca8daa89989f9bbef7927a81890c906fde idêntico ao arquivo ensaiado localmente; JPEG/PDF/MP4 sintéticos válidos aceitos na análise estrutural e versões com bytes extras rejeitadas (Pillow 12.3.0, pypdf 5.9.0, FFmpeg 7.1.5). CLI deliberadamente retorna valid=false e contentSafety=false mesmo após parse, até homologação de scanner e isolamento. Sem binding/serviço implantado; dependências exigem revisão de vulnerabilidades e versão fixada antes de operação. Política conservadora rejeita EXIF/ICC, PDF ativo e MP4 fora de H264/AAC fast-start; validar compatibilidade de arquivos reais. Nenhuma mídia real transferida, nenhum recurso pago ou migração aplicada. Não declarar pacote 01 integralmente concluído.
- PONTO ATUAL: concluir validador confiável operacional e scanner/isolamento sem contratar recursos sem autorização, conectar binding Teste, verificar CI de d81aa21 e 126bc4d, preparar recuperação de armazenamento incerto e homologação integrada após desbloqueio Vercel, consentimento 0171694 e autorização escrita Teste. Migrações 010/011 candidatas não aplicadas. Manter flags zero e Produção intacta. Pacote 02 adiado até conclusão integral do 01.
