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
