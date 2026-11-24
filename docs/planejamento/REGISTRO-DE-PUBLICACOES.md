# Registro de releases e promoção seletiva — NeoPep
**Início:** 24/11/2026. Fonte de releases do ciclo: atualizada somente quando uma publicação/rollback ocorrer. O Marco Zero é histórico e não é uma publicação deste ciclo.

## Política
- Uma entrega aprovada pelo proprietário pode ficar em espera e **não será promovida sem solicitação de publicação**.
- O proprietário pode autorizar release de somente um ID/sub-ID, ou de um lote de diversos IDs aceitos.
- Antes de cada publicação, conferir projeto exato, SHA base atual, compatibilidade de dependências e banco/Edge, migrações, RLS, arquivo de config, domínio, rollback, CI e revisão de diff. Usar o menor conjunto de alterações autorizado.
- Se a mudança individual não puder ser isolada da base atual da Produção, registrar BLOQUEADO_POR_DEPENDENCIA e apresentar a menor proposta de compatibilização. Não arrastar funções de outras PRs silenciosamente.
- Versão de Teste aprovada não significa código já em Produção, e um Vercel READY não significa que o usuário recebeu a versão no domínio/PWA. Comprovar alias e testes.
- Não ligar por implicação pagamentos reais, webhook diferente, cron de campanha, envio WhatsApp em massa ou migração irreversível.
- Rollback de frontend não reverte banco automaticamente: planejar compatibilidade progressiva, snapshots/backups e compensação, respeitando dados existentes.
- O deploy inicial dos projetos, antes deste ciclo, está em MARCO-ZERO-2026-11-24.md.

## Releases deste ciclo
**Nenhum release deste ciclo foi executado.**

| Release ID | IDs/sub-IDs incluídos | Tipo | Aceite proprietário | Base Produção SHA | Novo SHA | Migrações/Edge | Data/hora UTC | Testes/rollback | Estado |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | Nenhuma publicação realizada |

## Template obrigatório
### REL-AAAA-MM-DD-NNN — [resumo]
- Solicitado por / autorização explícita de publicação:
- Tipo: individual ou conjunto.
- IDs/sub-IDs e **versões exatas** aprovadas; links de aprovação:
- Decisão de incluir/excluir dependências e justificativa:
- Git SHA de origem, base/main e commit final; PR; diff de módulos afetados:
- Projeto Teste, Supabase e Vercel do Teste: migracões, Edge, front, URLs, evidência:
- Projeto Produção, Supabase e Vercel oficial: migrations/Edge, main, URLs/alias/PWA, evidência:
- Backups/ponto de recuperação e rollback testado:
- Checklist de compatibilidade: login, sessão, RLS e módulos diretamente dependentes; outros fluxos críticos quando afetados:
- Resultado do deploy e validação pós-release:
- Erros/alertas observados e monitoramento:
- Novo marco de saída, SHA real publicado, timestamp:
- Conclusão: PUBLICADO_PRODUCAO / VALIDADO_PRODUCAO / BLOQUEADO / REVERTIDO:
- Próxima etapa:

## Fila para release conjunto
**Vazia.** Itens entram somente após aceite do proprietário e decisão explícita de publicar em conjunto.
