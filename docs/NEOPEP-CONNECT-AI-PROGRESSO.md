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
| 005 Central administrativa | Planejado. Card independente acima de App/WhatsApp. |
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
