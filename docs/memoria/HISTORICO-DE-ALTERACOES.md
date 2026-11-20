# Histórico de alterações

## Cronologia recuperada

| Evidência temporal | Acontecimento | Classificação e fonte |
| --- | --- | --- |
| Até a auditoria de 12/11/2026 | Elo era um app estático privado de registros locais na chave `elo-v1`. A auditoria descreve pesos, medidas, aplicações e configurações, sem conta própria ou banco. | Histórico. O commit `ecce8791b78b531f175e6f7cc34cae14b65f1acf` é citado, com objeto ausente neste checkout. [Auditoria](../AUDITORIA.md) |
| 12/11/2026 | A transição acrescentou PWA, temas, perfil, fotos, relatórios e preparação Supabase. A primeira prévia validou regras e preservação. A consolidação documentou a retirada do pacote antigo e o mesmo NeoPeptídeos na raiz e em `/neo/`. | Histórico. [Validação](../VALIDACAO.md) · [Consolidação](../CONSOLIDACAO.md) |
| Prefixos de 12 a 16/11/2026 | A sequência SQL passa por multiusuário, comunidade, push, atendimento, biblioteca, administração, loja, agente, pagamentos, frete e ajustes de identidade e mídia. | Implementado no acervo versionado. As datas dos prefixos não comprovam implantação. [Banco de dados](../conhecimento/BANCO-DE-DADOS.md) |
| Sem data explícita no relato | SQL aplicado pelo responsável corrigiu a ausência das tabelas no schema cache. Houve recusa de acesso anônimo e CAPTCHA exigido, além de relato de persistência em uma conta e limite de e-mail na segunda. | Histórico com verificação remota limitada. [Conexão](../CONEXAO-SUPABASE.md) |
| 19/11/2026, data Git registrada | Inicialização segura (`1ba8375`) e exportação completa (`8cf6bc7`). O relatório cita a fonte `cefd8e81bbaab2b246942be79c40edc00cd3f890`, cujo objeto não está no histórico acessível, e registra correção de avatar. | Histórico. [Exportação](../EXPORT.md) |
| Após a exportação, conforme os pais Git | `4e7e2da` em `teste-integracao-colaborador` acrescenta um arquivo de teste. `8166fe4` em `teste-codex-cloud` registra leitura, checagem e escrita controlada em branch separada. | Histórico. Commits observados no Git. |

A ordem entre fatos de fontes diferentes só foi estabelecida quando os registros a sustentam. O [índice de origem](../estudo-original/INDICE.md) preserva os relatos de módulos.

## MEM-20261120-001

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Solicitação original, trecho do objetivo: “Implementar uma base de conhecimento permanente, centralizada, versionada e evolutiva dentro do repositório neopep/App-NeoPep.” A entrega é exclusivamente documental. |
| Contexto anterior | Guias distribuídos por módulo e etapas. O histórico Git acessível começa na exportação segura. |
| Decisão e justificativa | Centralizar orientação atual, evidências, decisões e protocolos em Markdown e preservar os documentos legados, para manter contexto auditável entre ferramentas. |
| Arquivos modificados | Quatro entradas de agente na raiz e em `.github/`, além dos arquivos novos em `docs/conhecimento/`, `docs/memoria/`, `docs/processos/` e `docs/estudo-original/`. |
| Funcionalidades e banco | Entrega de documentação. Escopo funcional e de esquema vazio. |
| Dependências | Repositório existente, guias legados e histórico acessível. Nenhuma dependência de execução adicionada. |
| Testes e resultados | Checagem de links relativos e cobertura do índice, revisão do diff, `npm run check` aprovado e `npm test` com 229/296 aprovados. |
| Erros e soluções | A suíte repetiu os mesmos 67 casos com falha da base do onboarding, com falhas que incluem objetos e papéis ausentes no banco emulado. As falhas foram registradas para investigação separada. |
| Limitações e pendências | Estudo integral indisponível, objetos Git históricos ausentes e infraestrutura do aplicativo sem inspeção nesta entrega. [Pendências](../conhecimento/PENDENCIAS.md) |
| Reversão | Reverter apenas o commit documental com `git revert` em branch de trabalho e revisar referências de entregas posteriores. |
| Identificação Git | Branch `docs/memoria-permanente`, base `8cf6bc7aac6711ea3b952d62ddaab0b59b577bd1`. Localize o commit deste registro com `git log --all --oneline --grep=MEM-20261120-001`. |

## MEM-20261120-002

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Integrar a documentação à main e registrar o Ignored Build Step. O responsável autorizou o push mesmo com possibilidade de compilação e publicação automáticas. |
| Contexto anterior | A integração aguardava confirmação do risco de deploy. A comparação inicial com barras antes dos asteriscos retornou 1 para o diff documental. |
| Decisão e justificativa | Registrar a configuração confirmada pelo responsável e suas condições de execução, mantendo intacta a branch documental histórica. |
| Arquivos e impactos | Guia de integrações, histórico e próximas tarefas. Escopo funcional, de banco e de configuração versionada vazio. |
| Dependências | Vercel, variável VERCEL_GIT_PREVIOUS_SHA e disponibilidade do objeto Git no checkout da compilação. |
| Testes e resultados | A regra sem barras retornou 0 para o diff documental e 1 para o histórico com mudanças funcionais. SHA vazio retornou 1 e objeto indisponível retornou 128. A checagem de sintaxe do aplicativo e a revisão do diff fazem parte da integração. |
| Erros e soluções | O responsável confirmou o padrão corrigido no painel. As limitações de SHA e de diff acumulado permanecem documentadas. |
| Limitações e pendências | A execução do Ignored Build Step no Vercel depende de evidência do provedor. [Integrações](../conhecimento/INTEGRACOES.md#ignored-build-step-do-vercel) |
| Reversão | Reverter este commit documental em branch de trabalho se necessário. Uma eventual mudança no painel é operação separada, sujeita a autorização. |
| Identificação Git | Base documental 2b938fb09eeb3e08111ac7c8fa1be938b8d46353. Localize o registro com git log --all --oneline --grep=MEM-20261120-002. |

## MEM-20261120-003

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Consolidar a correção de identidade Git e testar a associação do commit em uma branch documental. |
| Contexto anterior | O responsável relatou bloqueio de publicação pelo Vercel por e-mail de autoria sem verificação no GitHub. A identidade anterior vinha da configuração global. |
| Decisão e justificativa | Usar a identidade autorizada somente no checkout e conferir autoria e committer antes de cada commit, evitando metadados incorretos em novos commits. |
| Arquivos e impactos | AGENTS.md, integrações, pendências, decisões, histórico e próximas tarefas. Escopo restrito à documentação e à identidade local. Alteração de banco não aplicável. |
| Dependências | Configuração local do Git, associação da conta no GitHub e critérios de publicação do Vercel. |
| Testes e resultados | A configuração local permaneceu disponível ao reabrir o checkout. Autoria e committer foram conferidos localmente. [Pendências](../conhecimento/PENDENCIAS.md) |
| Erros e soluções | A identidade global foi substituída neste checkout pela configuração local autorizada. |
| Limitações e pendências | Associação da conta e resultado do Vercel exigem evidência dos serviços. Persistência em clone novo depende do provisionamento. |
| Reversão | Reverter o commit documental na branch de trabalho e, se autorizado e necessário, restaurar separadamente a configuração local anterior. |
| Identificação Git | Branch docs/identidade-git. Localize o registro com git log --all --oneline --grep=MEM-20261120-003. |

## MEM-20261120-004

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Registrar a conclusão da validação documental GitHub, Codex Cloud e Vercel e propor um teste funcional isolado. |
| Contexto anterior | Os registros MEM-20261120-002 e MEM-20261120-003 aguardavam evidência do provedor. |
| Decisão e justificativa | Encerrar a validação documental com as evidências do PR #1 e manter a publicação funcional como única pendência desta integração. A conta proprietária executará o teste em Preview após autorização, considerando a restrição de autoria relatada para o Vercel Hobby. |
| Arquivos e impactos | Integrações, histórico, pendências, próximas tarefas, tarefas concluídas e protocolo de desenvolvimento. Impactos funcionais e de banco não aplicáveis. |
| Dependências | GitHub, Codex Cloud e configuração existente do Ignored Build Step no Vercel. |
| Testes e resultados | O Git confirma o merge pela conta `neopep` em `d5dfe11` e a preservação do commit `8b229f5` de `rafarwr5`. O responsável confirmou que o Vercel reconheceu o proprietário, passou pela verificação de permissões e cancelou a compilação documental com saída `0`. A entrega documental passou em `npm run check`, checagem de links e revisão do diff. [PR #1](https://github.com/neopep/App-NeoPep/pull/1) |
| Erros e soluções | A integração validada passou pela etapa de identidade e permissões. O cancelamento foi o resultado esperado da regra documental. |
| Limitações e pendências | Validar publicação funcional. [P-009](../conhecimento/PENDENCIAS.md) |
| Reversão | Se necessário, reverta somente a futura alteração documental correspondente a este registro. |
| Identificação Git | Branch local `docs/validacao-github-codex-vercel`, base `d5dfe11`. |

## MEM-20261120-005

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Preparar e validar localmente um marcador estático para testar a publicação funcional. |
| Contexto anterior | A compilação documental do PR #1 foi ignorada conforme esperado. A publicação funcional segue pendente. |
| Decisão e justificativa | Adicionar um recurso de texto sintético fora da navegação e preservar a autoria real do colaborador. A publicação isolada depende de aprovação do proprietário. |
| Arquivos e impactos | `dist/diagnostico-preview.txt`, integrações, pendências, histórico e próximas tarefas. Nenhum fluxo existente, configuração ou banco alterado. |
| Dependências | Build estático, empacotador de prévia e regra de comparação Git do Vercel. |
| Testes e resultados | `npm run check`, build, geração da prévia e `git diff --check` passaram. O marcador foi conferido no pacote da raiz e de `/neo/`. A simulação com a base da main retornou 1 para o diff do marcador. |
| Erros e soluções | O build rodou em cópia de trabalho para isolar a regeneração de arquivos rastreados. |
| Limitações e pendências | O Vercel Hobby pode bloquear Preview do colaborador. O ensaio local cobre a regra de diff com o SHA conhecido. [P-009](../conhecimento/PENDENCIAS.md) |
| Reversão | Descartar a branch após autorização ou reverter o commit de teste caso esteja numa branch que precise ser preservada. |
| Identificação Git | Branch `teste/validacao-deploy-funcional`, base `c1afad6`. Localize o commit com `git log --all --oneline --grep=MEM-20261120-005`. |
