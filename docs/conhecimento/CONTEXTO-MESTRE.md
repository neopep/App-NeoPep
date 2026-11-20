# Contexto mestre

NeoPeptídeos evoluiu de um aplicativo local chamado Elo. A versão de referência é o snapshot web/PWA da `main` em `8cf6bc7aac6711ea3b952d62ddaab0b59b577bd1`. A central é mantida no Git para que o contexto acompanhe o código entre sessões e ferramentas. Comece pelas [instruções obrigatórias](../../AGENTS.md) e confira o commit que está efetivamente em uso. [README do aplicativo](../../README.md)

## Navegação

| Assunto | Documento |
| --- | --- |
| Inventário e divergências | [Estado atual](ESTADO-ATUAL.md) |
| Camadas, entradas e armazenamento | [Arquitetura](ARQUITETURA.md) |
| Módulos e guias originais | [Funcionalidades](FUNCIONALIDADES.md) |
| Esquema, migrações e autorizações | [Banco de dados](BANCO-DE-DADOS.md) |
| Proteção de dados e autenticação | [Segurança](SEGURANCA.md) |
| Temas, interface mobile e acessibilidade | [Identidade visual](IDENTIDADE-VISUAL.md) |
| Serviços e hospedagem | [Integrações](INTEGRACOES.md) |
| Atendimento assistido | [Inteligência artificial](INTELIGENCIA-ARTIFICIAL.md) |
| Loja e pagamentos | [Monetização](MONETIZACAO.md) |
| Cobertura e resultados | [Testes](TESTES.md) |
| Sequência de evolução | [Roadmap](ROADMAP.md) |
| Lacunas e comprovação necessária | [Pendências](PENDENCIAS.md) |

- Memória de trabalho: [decisões](../memoria/DECISOES.md), [histórico](../memoria/HISTORICO-DE-ALTERACOES.md), [lições](../memoria/LICOES-APRENDIDAS.md), [tarefas concluídas](../memoria/TAREFAS-CONCLUIDAS.md) e [próximas tarefas](../memoria/PROXIMAS-TAREFAS.md).
- Procedimentos: [desenvolvimento](../processos/PROTOCOLO-DE-DESENVOLVIMENTO.md), [atualização](../processos/PROTOCOLO-DE-ATUALIZACAO.md) e [validação](../processos/PROTOCOLO-DE-VALIDACAO.md).
- Acervo: [índice de fontes e reserva para o estudo original](../estudo-original/INDICE.md).

## Evidência e classificação

A classificação vale para uma afirmação e seu contexto. Registre fonte, commit ou ambiente e data da verificação quando disponíveis. Para comportamento atual, confira o código do commit analisado. Um relatório antigo descreve o que foi observado ou decidido naquela etapa. Para operação remota, use evidência autorizada no ambiente específico e mantenha seu alcance explícito.

| Classificação | Aplicação |
| --- | --- |
| Implementado | Presente no código ou na configuração versionada. |
| Confirmado na infraestrutura | Observado diretamente no ambiente nomeado, com evidência e alcance registrados. |
| Validado por testes | Verificado pelo teste identificado, incluindo o tipo de ambiente e os resultados. |
| Parcialmente validado | Um subconjunto foi verificado. Registre as partes cobertas e as que faltam. |
| Planejado | Trabalho futuro com sequência ou dependências documentadas. |
| Proposto | Alternativa em avaliação, sujeita a decisão. |
| Histórico | Relato, resultado ou decisão de uma etapa anterior. |
| Descontinuado | Fluxo, pacote ou componente retirado, com evidência da substituição quando disponível. |
| Não verificado | Evidência atual ausente ou insuficiente. |
