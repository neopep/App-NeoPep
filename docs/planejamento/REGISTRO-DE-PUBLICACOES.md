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

## Publicação exclusivamente em Teste — integração financeira #010.04+#010.05 — 24/11/2026
- Tipo: **HOMOLOGAÇÃO_TESTE** (não é PUBLICADO_PRODUCAO). Escopo: editor de custos e dashboard financeiro. #010.04 aceita pelo proprietário, #010.05 ainda aguarda aceite.
- Git: branch `homologacao/loja-010-04-010-05`, SHA `43e31dfcc703e08192acc93d596c566cfd783260`, [PR #53](https://github.com/neopep/App-NeoPep/pull/53) draft. Base staging `0970ae6`; sem merge.
- Vercel Teste: projeto `app-neopep-staging` (ID `prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq`), deploy `dpl_Fb2oKfv8sFgWUx2945BjmFetetif` **READY**, URL `https://app-neopep-staging-eggkjzt1y-neo-pep.vercel.app`, alias oficial de Teste `https://teste.app.neopep.com.br/neo/`. Verificação HTTP 200 na página e no `/config.js`: `NeoPep Teste`, Supabase Teste `qnuluspqfazdppciermw`, SHA correspondente.
- Supabase Teste: ledger fundação `20261124164148`, editor `20261124170927`, dashboard `20261124172822`; script `release/shop-finance/verify-test-integration.sql` passou com consultas somente de leitura e impressão digital RPC. Sem novas migrações.
- Baseline recuperação Vercel Teste anterior: `dpl_F7crpVWtyrBkc7ZpddMNb7XjpMRg` READY. Restaurar alias somente em caso de regressão e após verificar estado; sem rollback SQL por falha de UI.
- QA: permissões com JWT real, fluxos admin, história/câmbio e iPhone físico pendentes. Testes locais Codex não reexecutados. Backup atualizado não comprovado (proprietário aceitou risco ao autorizar mudanças anteriores no Teste).
- Produção `app-neopep` `prj_Qd8luBAEbXtJgk5dIwwoSbnrBIki`: **intocada**, sem release, merge ou troca de alias. Checkout e webhook Mercado Pago intocados.

## Aceite de proprietário — #010.04+#010.05 — 24/11/2026
- Proprietário declarou **«Está validado e aceito»** sobre a integração em Teste da [PR #53](https://github.com/neopep/App-NeoPep/pull/53), SHA `43e31dfcc703e08192acc93d596c566cfd783260`, Vercel de Teste READY `dpl_Fb2oKfv8sFgWUx2945BjmFetetif` no domínio `https://teste.app.neopep.com.br/neo/`.
- Estado: **ACEITO_PELO_PROPRIETÁRIO / PUBLICADO_SOMENTE_TESTE / AGUARDA_DECISÃO_DE_PRODUÇÃO**. Nenhum merge ou deploy de Produção por causa deste aceite. #010.06 não iniciado; contrato e inventário financeiro devem ser reconciliados antes de novo release.
