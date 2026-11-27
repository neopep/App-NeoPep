# NeoPep Connect AI — progresso

Branch de referência: `desenvolvimento/campanhas-plugin-ia-20261126`.
Base deste lote: `83ba99f`. Os incrementos anteriores estão registrados abaixo.
Ponto de corte: `docs/PONTO-DE-CORTE-20261126.md`. A publicação anterior de Teste pertence a outro ciclo.

| Etapa | Estado |
|---|---|
| 001 Auditoria | Parcialmente testado. Fonte nativa do Central localizada; parâmetros de leitura e escrita ainda em auditoria. |
| 002 Catálogo | Contexto disponível no PoC; lista e detalhe WhatsApp testados em Teste simulado. |
| 003 Autenticação | SQL candidato de conexões e concessões, PKCE, emissão JWT e troca/rotação testados localmente. Broker de sessão, consentimento HTTP e provisionamento pendentes. |
| 004 Servidor | PoC testado sob Node. Worker real e clientes MCP ainda não homologados. |
| 005 Central administrativa | Seções iniciais e estados honestos testados em DOM simulado. Gestão autenticada pendente. |
| 006 Criação e edição | Planejado |
| 007 Criativos | Planejado |
| 008 Operações em massa | Planejado |
| 009 Destinatários | Planejado |
| 010 Agendamento e publicação | Planejado |
| 011 Gerenciamento | Planejado |
| 012 Documentação e CI | Geração determinística e workflow preparado. Ainda falta vincular mudanças semânticas nos contratos nativos à revisão obrigatória. |
| 013 Segurança e monitoração | Planejado |
| 014 Homologação e instalação | Catálogo privado e ZIPs de Teste/Produção preparados. Instalação real pendente por cliente, plano e dispositivo. |

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
