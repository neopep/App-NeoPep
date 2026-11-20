# Evidências de homologação

| Checagem | Resultado |
| --- | --- |
| PostgreSQL local descartável | Preflight, 47 migrações, pós-teste e auditoria executados em PostgreSQL 17, com stubs de Auth, Storage, Vault e pg_net. Sem rede no contêiner. |
| Reexecução da fixture | Dois perfis fictícios, dois agentes adicionais inativos, três itens de conhecimento e zero integrações com credenciais após duas execuções. |
| Frontend de homologação | Gateway e chave fictícios confirmaram a configuração exclusiva do host de staging na raiz e em /neo/. A configuração desta branch inicia com nuvem desabilitada. |
| Rede do App-NeoPep | Em 20/11/2026, o proxy abriu os três túneis (CONNECT 200), a validação TLS passou, e os endpoints sem credenciais responderam 401. |
| Supabase remoto | A integração oficial via OAuth confirmou o projeto de homologação. `SELECT 1 AS ok` retornou 1. A escrita temporária com rollback e o preflight com `pg_net` 0.20.4 passaram. |
| Backup operacional | Conforme informado pelo responsável, pg_dump 17.12 concluiu com código 0 e produziu 1.067.243 bytes. Índice e leitura integral passaram em pg_restore. A restauração real continua pendente. |

Os bundles Edge correspondem ao código em `c770682`. Esta pasta contém apenas código, fixtures sintéticas e evidências resumidas. [MEM-20261120-012](../../../docs/memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-012)

## Retomada remota em 20/11/2026

| Etapa | Evidência |
| --- | --- |
| Fonte | `staging/multiagentes-homologacao`, `08a5a87c59e0c14668012a71d21fd41c98c5324f`. |
| Migrações | 6/45 históricas e 0/2 multiagente. Última aplicada: `202611120006_community_summary.sql`. A aplicação pelo SQL da integração não preenche automaticamente o histórico do CLI. |
| Primeiro bloqueio | A revisão automática recusou `202611120007_community_alerts.sql` por criar a fila comunitária de push e permitir ativação antes da validação correspondente. A sequência foi interrompida. |
| Estado remoto parcial | Zero usuários Auth e dispositivos push. Ausentes a fila comunitária de push, os gatilhos HTTP de push, o catálogo de cron, os segredos de agendamento, a configuração de ambientes de pagamento e o catálogo multiagente. |
| Auditoria parcial | Advisor de segurança: 11 avisos informativos de RLS habilitada sem políticas e 16 alertas de execução de RPCs SECURITY DEFINER (1 para anon e 15 para authenticated). Revisar os grants e as guardas de cada RPC na auditoria final. |
| Validação local | `npm run check` e `npm run build` aprovados. 14/14 testes focados passaram, cobrindo fundação, administração do frontend e contratos de `ai-reply` e `agent-integrations` com simulações locais. |
| Pendências | Revisar como garantir push desativado e aprovar a retomada a partir do sétimo arquivo; aplicar os 39 históricos restantes e os dois multiagente; executar pós-teste e auditoria completa; criar e testar contas fictícias; validar Edge e frontend conectado ao staging. |

## Segunda retomada em 20/11/2026

| Etapa | Evidência |
| --- | --- |
| Estado conferido antes da retomada | As seis primeiras migrações estavam presentes. O projeto tinha zero usuários, dispositivos push, entradas no Vault e Edge Functions. O catálogo de cron estava ausente. |
| Aplicação | 16/45 históricas, 0/2 multiagente. Última aplicada: `202611120016_directory_featured.sql`. A migração 10 usou a cópia de staging. A migração 22 tem uma cópia preparada e segue pendente. |
| Bloqueio na migração 17 | A revisão automática recusou a elevação de moderadores a administradores da plataforma por `neo_admin_access()`. O catálogo confirmou que os papéis seguem separados. |
| Isolamento após a migração 16 | Restrição de push validada, zero preferências push ativas, zero dispositivos, zero contas e zero segredos no Vault. Catálogos de cron, pagamentos integrados e agentes ausentes. |
| Advisor de segurança parcial | 27 ocorrências informativas de RLS sem políticas. 34 alertas de funções SECURITY DEFINER executáveis, sendo 1 por anon e 33 por authenticated. |
| Testes locais | `npm run check` e 14/14 testes focados passaram. O ensaio Docker com PostgreSQL 17.12 e rede desativada confirmou restauração de backup sintético, preservação de conhecimento e consentimento legados, cotas por agente, concorrência de leases e publicação única de resposta. |
| Frontend | O gerador validou a chave pública no Auth do staging e gerou o pacote sem instalação remota. A configuração e a CSP em `/` e `/neo/` apontam exclusivamente ao projeto de staging. Cadastro público, push e provedores Google/Apple estão desativados na configuração. |
| Pendências | Revisar a separação dos papéis na migração 17, aplicar 31 migrações restantes, executar pós-teste e auditoria completos e validar cenário real de Auth, Edge e frontend. O conector não tem criação de usuários Auth e o painel de usuários não carregou no navegador Cloud. |
