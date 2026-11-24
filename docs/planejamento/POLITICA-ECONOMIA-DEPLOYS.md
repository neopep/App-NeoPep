# Política de economia de deploys Vercel — NeoPep

Início: 24/11/2026 · Decisão do proprietário: **«Só temos que controlar que temos poucos deploys na vercel»**.

## Objetivo
Preservar a capacidade limitada de deploys/builds do projeto NeoPep na Vercel, sem prejudicar testes ou publicações essenciais. Esta política vale para todos os ajustes #001–#014, especialmente a finalização #010.06.

## Regras obrigatórias
1. **Sem deploy automático de desenvolvimento**: conferir e desabilitar/ignorar builds para branches de trabalho, PRs e documentação; não disparar publicação em push antes de checar a configuração efetiva da Vercel. A opção `git.deploymentEnabled` em `vercel.json` deve ser revisada contra as configurações reais dos dois projetos.
2. **Testar localmente primeiro**: executar build, check, testes PostgreSQL isolados, suite de Loja/PWA e browser emulado. Consolidar correções e executar um build idêntico ao de Teste antes de publicar.
3. **Publicação manual por lote**: só executar o menor deploy de Teste depois que o conjunto estiver integrado, verificado, com diff aprovado e roteiro de reversão. Evitar publicar versão parcial, todos os commits ou PRs isoladas.
4. **Produção é separada**: mesmo após Teste READY e aceite, só liberar versão de Produção com decisão específica do proprietário e checklist de dependências. Agrupar módulos aceitos quando seguro.
5. **Não desperdiçar tentativas**: antes do deploy conferir projeto ID e ambiente, Supabase URL/chave pública, domínio/alias, SHA do Git, migrations dependentes, variáveis e status do build; não usar Vercel para descobrir erro simples de compilação.
6. **Observabilidade**: registrar para cada deploy data, projeto, ambiente, commit, ID, status READY/ERROR/CANCELED, motivo, evidência e se foi necessário um segundo build. O número realmente disponível e critérios de contabilização dependem do plano/cotas Vercel e devem ser verificados, sem suposição.
7. **Incidentes**: depurar logs locais primeiro; se um deploy falhar, corrigir a causa-raiz e reagrupar antes de tentar novamente. Preservar artefato READY anterior para rollback quando possível.

## Regra específica para #010.06
**Zero deploys durante a implementação e os testes locais.** Ao concluir toda a 010.06, preparar uma única versão integrada com 010.04 e 010.05 para homologação em Teste, registrar o gate e pedir a liberação do deploy. Novas migrações no Supabase são decididas separadamente e nunca reaplicadas por divergência de prefixos.

## Linha de base conhecida
- Último deploy de homologação financeira em Teste, registrado anteriormente: `dpl_Fb2oKfv8sFgWUx2945BjmFetetif`, SHA `43e31df`, READY no projeto `app-neopep-staging`. Não criar novo deploy apenas para reconfirmá-lo; consultar o existente.
- O número restante de deploys ou limites exatos **não foi medido nesta atualização**.

## Próxima ação do Codex
Ler esta política antes de qualquer push. Garantir que a branch do ajuste #010.06 seja ignorada pelo deploy automático, executar CI e testes isolados, integrar somente após conclusão, documentar os possíveis custos/limites e não publicar sem gate explícito.
