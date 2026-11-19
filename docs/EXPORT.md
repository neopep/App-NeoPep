# Exportação segura do projeto

Este repositório contém um snapshot completo e executável do aplicativo NeoPeptídeos recuperado da fonte oficial publicada.

- Fonte recuperada: commit `cefd8e81bbaab2b246942be79c40edc00cd3f890`.
- Inclui a correção pendente do avatar compartilhado no cabeçalho, recompilada antes da exportação.
- A publicação existente, o domínio e o projeto Supabase não foram alterados durante a exportação.
- Credenciais privadas não fazem parte do repositório. Consulte `.env.example` e `docs/VERCEL.md`.

As migrations em `supabase/migrations/` representam o histórico existente e não devem ser reaplicadas cegamente em produção. Antes de qualquer futura implantação, compare o estado do banco e faça backup.
