# NeoPep Connect AI — progresso

Branch de referência: `desenvolvimento/campanhas-plugin-ia-20261126`.
Base deste incremento: `522a0ab`. O commit do incremento é o que introduz esta entrada.
Ponto de corte: `docs/PONTO-DE-CORTE-20261126.md`. A publicação anterior de Teste pertence a outro ciclo.

| Etapa | Estado |
|---|---|
| 001 Auditoria | Em desenvolvimento. Contrato inicial e fontes nativas identificados no mapeamento. |
| 002 Catálogo | Planejado. Cinco descritores de leitura em rascunho. |
| 003 Autenticação | Planejado. OAuth 2.1, PKCE e autorização escopada. |
| 004 Servidor | Planejado. PoC local antes de Cloudflare. |
| 005 Central administrativa | Planejado. Card independente acima de App/WhatsApp. |
| 006 Criação e edição | Planejado |
| 007 Criativos | Planejado |
| 008 Operações em massa | Planejado |
| 009 Destinatários | Planejado |
| 010 Agendamento e publicação | Planejado |
| 011 Gerenciamento | Planejado |
| 012 Documentação e CI | Planejado |
| 013 Segurança e monitoração | Planejado |
| 014 Homologação e instalação | Planejado |

## Incremento inicial

- Arquivo alterado: `vercel.json`. O deploy Git fica desativado para esta branch de desenvolvimento.
- Verificação: a configuração JSON é válida e mantém as regras das demais branches.
- Migrações e configuração externa: nenhuma.
- Próxima ação: versionar o subconjunto executável de leitura, testar o transporte MCP com dados sintéticos e bloquear por padrão o acesso a serviços reais até existir autorização por conexão.
