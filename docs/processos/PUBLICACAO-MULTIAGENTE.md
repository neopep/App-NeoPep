# Publicação controlada da arquitetura multiagente

## Evidência e pré-requisitos

A aplicação integral das migrações e a reexecução da MA-03 passaram em PostgreSQL 17 isolado, com papéis Auth/Storage/Vault simulados e dados sintéticos. Isso cobre uma instalação de referência e disputas reais entre sessões no PostgreSQL. A configuração e o volume reais do Supabase ainda precisam de validação. O Cloud não encontrou binding ou conector de staging, e a consulta de leitura ao destino Supabase recebeu 403 do proxy. Use um projeto de staging separado e autorizado. Mantenha chaves de Auth, Storage, provedor e rotinas exclusivas desse ambiente.

Execute [a auditoria SQL em leitura](../../release/auditoria-multiagentes.sql) no console autorizado, primeiro no destino homologado e depois em produção somente em leitura. A consulta retorna metadados, não dados de usuários ou corpos de funções. Registre o servidor, versões das migrações, colunas e dependências. Compare o resultado com o clone isolado antes de mudar qualquer objeto.

| Dependência | Critério antes de aprovar |
| --- | --- |
| MA-01/02 | Existência de singleton e esquema do workspace `202611140026`, tipos UUID nas tabelas, FKs, unicidade do job por mensagem e leases. Nenhuma colisão nos objetos novos. |
| MA-03 | MA-01/02 aplicada, trilha esperada de wrappers de `neo_support`, `neo_ai_claim`, `neo_ai_finish` e trigger `enqueue_ai`. Diferença no fingerprint exige revisar a definição no ambiente autorizado. |
| Auth e RLS | Papéis `anon`, `authenticated` e `service_role`, integração e funções privadas protegidas, RPCs de administração com teste de identidade e tabelas privadas com RLS. Confirme ausência de grants efetivos inesperados. |
| Regras de execução | Termos, perfil de administrador, relações da fila, Vault/rotinas existentes e notificação de sugestões. Verifique que trabalhos pendentes e versões antigas continuam operando antes de ativar agentes adicionais. |
| Objetos reexecutados | Confirme nomes, tipos e constraints mesmo quando houver `IF NOT EXISTS`. A existência de um nome não garante o contrato. Nunca reaplique só a fundação sobre a MA-03 para corrigir drift. |

## Backup e ensaio

1. Registre o SHA estável do frontend, versões das Edge Functions, ponto de recuperação do banco, configuração de cron e contagens de jobs por estado. Preserve essa evidência sem credenciais nem conteúdo de conversas.
2. Confirme a retenção do backup, faça snapshot autorizado e ensaie a restauração num alvo isolado. Para staging, use dados sintéticos ou uma cópia autorizada e sanitizada, com segredos independentes. Preserve vínculos, configurações, histórico e filas.
3. Remeça bloqueios e latência em staging com volume representativo. Reproduza a concorrência com `python3 tests/multiagent-postgres.py` e verifique rota real de Edge com credenciais exclusivas de staging. Confirme que o mecanismo de rollback está disponível antes da aprovação.

## Ordem de implantação e ativação

1. Com janela e aprovação, confirme a base auditada e aplique [MA-01/02](../../supabase/migrations/202611200001_multiagent_foundation.sql), depois [MA-03](../../supabase/migrations/202611200002_multiagent_runtime.sql). Verifique grants, RLS, trigger, leases e agente padrão antes de expor o catálogo. Mantenha todos os adicionais inativos.
2. Atualize primeiro [ai-reply](../../supabase/functions/ai-reply/index.ts), que deve processar o modelo do job e manter a compatibilidade com o padrão. Atualize depois [agent-integrations](../../supabase/functions/agent-integrations/index.ts), que usa as novas RPCs exclusivas de servidor para testar modelos. Essas são as duas funções Edge alteradas. Push, Auth e demais funções mantêm as versões existentes. Confira CORS, execução da fila e contrato das RPCs sem reaproveitar segredos de produção em testes.
3. Valide o frontend em Preview da Vercel. Antes de promover o SHA autorizado, confira que o artefato aponta ao ambiente correto e que a Vercel registrou o build esperado. Teste atualização do service worker, raiz, /neo/, painel, foco, temas e responsividade em desktop e mobile. Preserve a referência de frontend anterior para recuperação.
4. Após a publicação autorizada, teste o agente padrão e o atendimento humano antes de ativar adicionais. Teste um agente inativo com mensagem sintética. Ative apenas um agente em conversa de teste, com cota baixa e modo Sugestões. Confirme consentimento ligado ao provedor, isolamento de conhecimento, troca de agente, retry, perda do lease e aprovação única.
5. Amplie para automático e outros agentes após revisão das evidências. Monitore idades da fila, falhas dos provedores, limites e rejeições por revisão sem registrar texto de participantes. Se o primeiro piloto falhar, mantenha os adicionais inativos. O Preview do frontend sozinho não valida o backend.

## Reversão

Interrompa novas atribuições e desligue os agentes adicionais. Coloque conversas afetadas em manual, reavalie consentimentos e invalide jobs e sugestões pendentes preservando histórico. Uma chamada já enviada ao provedor pode terminar fora do app. Verifique expirados e leases em voo antes de restaurar as versões estáveis das Edge Functions e do frontend. Confira novamente o atendimento padrão e humano. Mantenha o esquema aditivo enquanto houver dados a preservar. Só considere migração compensatória ou restauração do backup após reconciliar mudanças ocorridas desde o snapshot e aprovar a operação separadamente.
