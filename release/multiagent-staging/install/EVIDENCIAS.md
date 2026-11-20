# Evidências de homologação

| Checagem | Resultado |
| --- | --- |
| PostgreSQL local descartável | Preflight, 47 migrações, pós-teste e auditoria executados em PostgreSQL 17, com stubs de Auth, Storage, Vault e pg_net. Sem rede no contêiner. |
| Reexecução da fixture | Dois perfis fictícios, dois agentes adicionais inativos, três itens de conhecimento e zero integrações com credenciais após duas execuções. |
| Frontend de homologação | Gateway e chave fictícios confirmaram a configuração exclusiva do host de staging na raiz e em /neo/. A configuração desta branch inicia com nuvem desabilitada. |
| Supabase remoto | Consulta desta sessão bloqueada pelo proxy com 403. A instalação e o teste real de Auth, Edge e frontend aguardam a conta conectada. |
| Backup operacional | Conforme informado pelo responsável, pg_dump 17.12 concluiu com código 0 e produziu 1.067.243 bytes. Índice e leitura integral passaram em pg_restore. A restauração real continua pendente. |

Os bundles Edge correspondem ao código em `c770682`. Esta pasta contém apenas código, fixtures sintéticas e evidências resumidas. [MEM-20261120-012](../../../docs/memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-012)
