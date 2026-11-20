# Protocolo de atualização da memória

Toda implementação futura deve atualizar a documentação do módulo na mesma entrega do código. Atualize [histórico](../memoria/HISTORICO-DE-ALTERACOES.md), [pendências](../conhecimento/PENDENCIAS.md) e [próximas tarefas](../memoria/PROXIMAS-TAREFAS.md). Registre mudanças de direção em [decisões](../memoria/DECISOES.md), resultados concluídos em [tarefas concluídas](../memoria/TAREFAS-CONCLUIDAS.md) e aprendizados reutilizáveis em [lições](../memoria/LICOES-APRENDIDAS.md).

Preserve os relatos originais, acrescente referências e use as [classificações do contexto mestre](../conhecimento/CONTEXTO-MESTRE.md#evidência-e-classificação). Cite evidências por arquivo, commit, verificação ou ambiente e data. Registre somente conteúdo autorizado e higienizado.

## Campos do registro

Use um ID único, por exemplo `MEM-AAAAMMDD-NNN`, como título e inclua-o na mensagem do commit para localização. Preencha os campos abaixo. Registre “não aplicável” para campos sem impacto e “não verificado” quando faltar evidência.

1. Identificador, data, objetivo e solicitação original, quando disponível e livre de informações confidenciais.
2. Contexto anterior, decisão técnica e justificativa.
3. Arquivos modificados, funcionalidades afetadas, alterações de banco e dependências.
4. Testes realizados, resultados, erros encontrados e soluções aplicadas.
5. Limitações, pendências e procedimento de reversão.
6. Identificação Git com branch e base, mais commit ou referência por ID. Use um link para o hash no relatório da entrega, pois o conteúdo do próprio commit determina seu hash.

Atualize o índice quando criar, mover ou renomear documentos. Mantenha a central em Markdown fora de `dist/`.
