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

## Proposta de teste controlado de publicação funcional

No projeto Vercel Hobby, o responsável informou que os deploys de branches com commits de rafarwr5 são bloqueados. O teste proposto depende de autorização e execução pela conta proprietária neopep.

1. Após autorização explícita, a conta neopep confirma que a branch de teste gera apenas um **Preview** isolado, sem promover para Production, associar domínio de produção ou usar dados de usuários. Se esse isolamento não puder ser confirmado, suspenda o teste.
2. A conta neopep cria uma branch descartável a partir da `main` e prepara um recurso estático de diagnóstico, por exemplo `dist/diagnostico-preview.txt`, com um marcador sintético único. Mantenha o recurso fora da navegação. Ele altera o conteúdo servido e exercita o caminho funcional da publicação sem mudar fluxos existentes. Reproduza localmente o diff da regra com a base conhecida, espere saída `1` e rode `npm run check` e o build em uma cópia de trabalho.
3. Após revisão do diff, a conta neopep cria e envia o novo commit de teste usando sua própria sessão autenticada e identidade Git verificada. Preserve a autoria dos commits existentes, inclusive os de rafarwr5. Em seguida, observe a execução automática em Preview. Registre SHA, base comparada, identidade reconhecida, saída do Ignored Build Step e status do build. Para validar a regra, confirme que a base estava disponível e que a saída `1` veio do diff funcional, em vez de um SHA vazio. Erros de Git ou ausência da base tornam o teste inconclusivo.
4. Verifique na URL de Preview HTTP 200 e o marcador esperado no recurso de diagnóstico, além das rotas públicas de entrada `/` e `/neo/`. Confirme que o domínio de produção continua associado à publicação anterior. Se qualquer critério falhar, preserve os logs e suspenda a promoção. Encerre o Preview e remova a branch de teste apenas quando autorizado. O teste valida publicação funcional em Preview. Uma publicação em Production exige aprovação própria.
