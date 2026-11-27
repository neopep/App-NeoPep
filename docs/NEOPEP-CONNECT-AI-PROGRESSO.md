# NeoPep Connect AI — progresso

Branch de referência: `desenvolvimento/campanhas-plugin-ia-20261126`.
Base deste incremento: `522a0ab`. O commit do incremento é o que introduz esta entrada.
Ponto de corte: `docs/PONTO-DE-CORTE-20261126.md`. A publicação anterior de Teste pertence a outro ciclo.

| Etapa | Estado |
|---|---|
| 001 Auditoria | Parcialmente testado. Fonte nativa do Central localizada; parâmetros de leitura e escrita ainda em auditoria. |
| 002 Catálogo | Testado localmente para duas ferramentas de contexto. Três operações de leitura continuam em rascunho. |
| 003 Autenticação | Interface de verificação por chamada testada com fixtures; OAuth, persistência de conexões e revogação real pendentes. |
| 004 Servidor | PoC testado sob Node. Worker real e clientes MCP ainda não homologados. |
| 005 Central administrativa | Card e painel inicial em diálogo testados em DOM simulado. Gestão autenticada e rota própria pendentes. |
| 006 Criação e edição | Planejado |
| 007 Criativos | Planejado |
| 008 Operações em massa | Planejado |
| 009 Destinatários | Planejado |
| 010 Agendamento e publicação | Planejado |
| 011 Gerenciamento | Planejado |
| 012 Documentação e CI | Geração determinística e workflow preparado. Ainda falta vincular mudanças semânticas nos contratos nativos à revisão obrigatória. |
| 013 Segurança e monitoração | Planejado |
| 014 Homologação e instalação | Planejado |

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
