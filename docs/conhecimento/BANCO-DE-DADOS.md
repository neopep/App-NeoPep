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
