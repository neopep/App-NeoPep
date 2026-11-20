# Protocolo de validação e publicação

1. Confira diff, dependências e escopo. Valide links, âncoras e rastreabilidade da documentação.
2. Execute `npm run check` e testes pertinentes. Para mudanças no pacote, rode `npm run build` e `node scripts/stage-preview.cjs`. Teste a raiz e `/neo/`. Registre o commit, toolchain, comandos, resultados e falhas preexistentes confirmadas.
3. Para alterações de banco, teste instalação e atualização em ambiente isolado. Teste papéis e isolamento entre contas. Para serviços autorizados, use contas descartáveis e evidências no ambiente alvo. Para interface e PWA, execute QA nos navegadores e aparelhos afetados.
4. Antes de publicar, registre as evidências em [web-readiness](../../release/web-readiness.json) e rode `npm run release:check`. Revise retorno de autenticação, escopo do service worker, compatibilidade e reversão. Separe implantação web, migração de banco e publicação de Edge Functions.
5. Após aprovação explícita, publique de acordo com [lançamento web](../LANCAMENTO-WEB-E-LOJAS.md) e o guia do ambiente autorizado. Confirme o resultado e a compatibilidade após a mudança. [Vercel](../VERCEL.md)

## Estratégia proposta para GitHub Actions

| Verificação futura | Estratégia |
| --- | --- |
| Código e documentação | Compare a base e o HEAD do PR. Mapeie caminhos de frontend, migrações, funções e configuração aos guias e exija atualização pertinente e registro de memória. Preveja justificativa revisada para exceções. |
| Links e âncoras | Percorra Markdown, resolva caminhos no checkout e valide fragmentos de títulos. Inclua links relativos de entradas dos agentes e trate destinos externos em checagem separada. |
| Registros de alterações | Valide ID único, campos obrigatórios, convenção das datas e referência ao registro. Detecte IDs repetidos e referências sem registro. |
| Divergências documentais | Compare comandos e caminhos citados com scripts e arquivos reais. Sinalize estados contraditórios e evidências ausentes para revisão humana, que confirma fatos operacionais e semântica. |
| Revisão antes de integrar | Comece com relatório informativo em PRs, calibre regras com exemplos e, após aprovação, adote verificações requeridas e revisão humana na política da `main`. |

A automação está **proposta**. A ativação de workflows e proteções fica para outra entrega.
