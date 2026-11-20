# Protocolo de desenvolvimento

## Antes

1. Leia [AGENTS.md](../../AGENTS.md) e [Contexto Mestre](../conhecimento/CONTEXTO-MESTRE.md).
2. Identifique commit, branch e mudanças locais com Git. Leia o guia do módulo e as [decisões anteriores](../memoria/DECISOES.md).
3. Mapeie contratos, dependências, impactos em dados e permissões, e escolha validações proporcionais. Diferencie origem histórica, código atual e ambiente remoto.

## Durante

4. Use branch de trabalho. Preserve alterações existentes e funcionalidades fora do escopo.
5. Reutilize arquitetura, contratos e identidade visual. Proteja dados, autenticação, compatibilidade de origem e controle de acesso.
6. Prepare mudanças de banco em migração nova, com revisão de compatibilidade e plano de recuperação. Operações remotas exigem autorização.

## Depois

7. Execute os [testes aplicáveis](PROTOCOLO-DE-VALIDACAO.md) e registre resultados, limitações e erros.
8. Atualize o guia do módulo, histórico, pendências e próximas tarefas na mesma entrega do código. [Protocolo de atualização](PROTOCOLO-DE-ATUALIZACAO.md)
9. Apresente escopo, branch, commit, impactos, resultado dos testes e pendências para aprovação. Aguarde autorização para integração e publicação.

## Verificação da integração com o Vercel

Confira identidade local, autoria e committer com os comandos do [AGENTS.md](../../AGENTS.md) antes de cada commit. Preserve a autoria dos colaboradores no histórico do PR. Após uma integração autorizada, registre o PR, o SHA, a conta de integração, o ambiente, o código de saída do Ignored Build Step e o resultado de compilação ou publicação. Para mudanças exclusivamente documentais, a saída esperada é `0` quando a base de comparação está disponível. [Validação confirmada](../conhecimento/INTEGRACOES.md#validação-github-codex-cloud-e-vercel)

## Fluxo operacional entre as duas contas

1. O proprietário autorizou ambas as contas, `neopep` e `rafarwr5`, a desenvolver, editar, criar commits, enviar alterações e publicar o aplicativo, respeitando as autorizações de cada tarefa e as permissões da plataforma. Cada pessoa usa a própria sessão autenticada e identidade legítima, conforme o AGENTS.md.
2. Sincronize a base, desenvolva em branch própria, valide e documente o diff. Antes de cada commit confira as identidades efetivas. Envie a branch e apresente o SHA e as evidências conforme a autorização da tarefa.
3. O Preview direto de `rafarwr5` foi confirmado quando o repositório público permitiu esse fluxo no Vercel Hobby. Preview e Production foram validados com publicação direta por `rafarwr5` nas condições registradas. O merge pelo proprietário é opcional. O repositório é público temporariamente, e voltar ao modo privado pode restabelecer a limitação do Vercel Hobby. Produção exige autorização específica e respeito às regras da branch de produção. Preserve a autoria original em revisões e integrações.
4. Confira o SHA no Vercel, o ambiente Preview, o Ignored Build Step, o build e a URL de teste. Para um marcador estático, confira seu conteúdo no navegador e compare a referência de produção com a anterior. Registre evidência e limitações. A validação de configuração pública do build cobre a estrutura, enquanto a conectividade real do Supabase exige teste próprio. [Integrações](../conhecimento/INTEGRACOES.md#validação-github-codex-cloud-e-vercel)

## Encerramento do teste e limpeza proposta

1. Preserve o PR #3, os SHAs `d99bfb5` e `f7c6154`, os logs e a evidência do marcador e do deployment de produção. Confirme que a `main` segue sem o marcador.
2. Antes de excluir referências, confirme que as pontas das branches continuam correspondendo ao teste, que não há PR aberto ou trabalho posterior que dependa delas e que o Preview não atende domínio de produção. Confirme a política de retenção do deployment de Preview, pois apagar a branch pode não remover sua URL.
3. Após autorização específica, proponha remover primeiro `teste/validacao-deploy-funcional` e depois `preview/validacao-deploy`, com o proprietário responsável pela revisão das referências remotas. Remova cópias locais apenas após verificar seu conteúdo. Se houver autorização para retirar a URL de Preview, encerre somente esse deployment. Confira ao final a referência da `main` e o deployment de produção. [PR #3](https://github.com/neopep/App-NeoPep/pull/3)
