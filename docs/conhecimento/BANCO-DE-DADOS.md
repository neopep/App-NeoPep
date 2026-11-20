# Banco de dados

O projeto usa PostgreSQL com Supabase Auth, funções RPC, RLS e Storage privado. A estrutura inclui perfis, registros, consentimentos e fotos. Comunidade, atendimento, administração, biblioteca, loja e agente têm contratos e permissões próprios. Funções e migrações determinam as permissões efetivas. [Migrações](../../supabase/migrations/) · [Ativação multiusuário](../ETAPA-2-ATIVACAO.md)

| Prefixos das migrações | Evolução observável |
| --- | --- |
| `202611120001`–`002` | Núcleo, perfis e plataforma multiusuário. |
| `202611120003`–`017` | Comunidade, push, mensagens, loja, atendimento e administração. |
| `202611120018`–`202611140026` | Galeria, biblioteca, IA, descontos, anexos e espaço de trabalho do agente. |
| `202611150027`–`202611160036` | Cobrança, endereço, operações, frete, ambientes de pagamento e cancelamento. |
| `202611160038`–`202611160072` | Avisos, controles de membros, acesso a mídia e evolução de identidade/avatar. |

Os prefixos dão a ordem do acervo versionado. A aplicação remota precisa de auditoria própria. `supabase/setup/` oferece instaladores e rotinas por etapa; confira seus pré-requisitos antes de qualquer uso. [Instaladores](../../supabase/setup/) · [Auditoria de metadados](../../release/auditoria-supabase.sql)

1. Ao mudar esquema, crie migração nova. Revise grants, RLS, acesso a Storage, assinatura de RPC e compatibilidade com clientes antigos.
2. Valide em banco descartável a instalação, a atualização de uma base representativa, a preservação de dados e a recuperação. Teste usuários distintos e ações privilegiadas.
3. Para operação autorizada no projeto correto, compare migrações e objetos instalados, faça backup de banco e arquivos e prepare reversão ou correção progressiva. Aplique apenas mudanças pendentes que foram revisadas. [Exportação segura](../EXPORT.md)

## Fundação multiagente

| Objeto | Função na transição |
| --- | --- |
| `neo_private.agents` | Catálogo de UUIDs, agente padrão, identidade, estado, configuração, horários, revisão e referência à integração existente. |
| `neo_private.agent_catalog_knowledge` | Conhecimento de agentes adicionais por UUID e conhecimento compartilhado com escopo nulo. Os itens legados ficam em `agent_knowledge`. |
| `neo_private.agent_catalog` | Projeção privada. Para o padrão, lê ao vivo `agent_settings`. Seleciona metadados da integração sem retornar credenciais. |
| `neo_private.support_threads` | UUID de agente efetivo e associação planejada separada. O worker legado permanece responsável pelas conversas. |
| `neo_private.ai_jobs` e `neo_private.ai_attempts` | UUID efetivo do padrão durante a coexistência. Tentativas também reservam campos opcionais para tokens e custo em micros de dólar. |
| `public.neo_multiagent(text,jsonb)` | RPC com autorização administrativa no servidor. Alterações de configuração usam revisão esperada. Permissões efetivas e funções do worker atual continuam sob os contratos existentes. |

A [migração](../../supabase/migrations/202611200001_multiagent_foundation.sql) é transacional. Exige o workspace legado e falha se a linha singleton estiver ausente. O UUID padrão é estável. A reexecução mantém as definições e os itens novos, além de preservar leases, estados, tentativas e rascunhos. O índice único existente por mensagem e o controle de lease continuam impedindo respostas duplicadas. As novas FKs validam dados existentes. Meça tempo de bloqueio e volume em staging antes da aplicação autorizada.

**Reversão.** Enquanto o worker legado for o único ativo, basta suspender o uso da RPC nova para voltar a operar apenas pelo fluxo legado. Preserve os dados do catálogo e as referências adicionadas. Uma remoção física futura exige um backup e uma migração compensatória revisada, em ordem de dependência. Nunca restaure automaticamente uma configuração antiga por cima de gravações mais recentes.

O ambiente Cloud não tinha credencial de auditoria nem conector Supabase. O proxy negou a consulta de metadados REST e o esquema privado não foi confirmado remotamente. Antes de aplicar, obtenha uma sessão autorizada de leitura e compare somente metadados, por exemplo:

```sql
begin read only;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'neo_private'
  and table_name in ('agent_settings','agent_knowledge','ai_integrations','support_threads','ai_jobs','ai_attempts')
order by table_name, ordinal_position;
select tablename, rowsecurity
from pg_catalog.pg_tables
where schemaname = 'neo_private'
  and tablename in ('agent_settings','agent_knowledge','ai_integrations','support_threads','ai_jobs','ai_attempts');
rollback;
```

Confira também as restrições e assinaturas das RPCs com [a auditoria existente](../../release/auditoria-supabase.sql).
