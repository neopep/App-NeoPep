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

## MEM-20261120-006

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo e solicitação | Concluir a validação GitHub → Codex Cloud → Vercel e documentar o fluxo das duas contas e o encerramento do teste. |
| Contexto anterior | O PR #1 confirmou o cancelamento de compilação documental. O ensaio funcional foi preparado no commit `d99bfb5`, de `rafarwr5`. |
| Decisão e justificativa | Usar a branch isolada `preview/validacao-deploy` e o merge do proprietário para validar o Preview no Vercel Hobby preservando a autoria do colaborador. |
| Arquivos e impactos | Histórico, integrações, pendências, próximas tarefas, tarefas concluídas e protocolo de desenvolvimento. A atualização é documental. O marcador fica restrito às branches do ensaio. |
| Dependências | GitHub, identidades autorizadas no Codex Cloud, Vercel Hobby, Ignored Build Step e empacotamento estático. |
| Testes e resultados | O Git confirma o PR #3 integrado por `neopep` em `f7c6154` com autoria de `rafarwr5` preservada. Segundo a evidência confirmada pelo responsável, o Vercel aceitou o merge, permitiu a compilação, marcou o Preview como Ready em 7 segundos e serviu o marcador no navegador. Os logs confirmaram configuração pública estruturalmente válida, PDF.js e fontes locais preparados, SDK oficial do Supabase empacotado, Build Completed e Deployment completed. |
| Erros e soluções | Avisos do npm sobre cache-dir e scripts de instalação do esbuild 0.25.12 foram não impeditivos. A limitação de deploy direto do colaborador no Hobby foi tratada com integração autorizada pelo proprietário em Preview. |
| Limitações e pendências | A compilação não testou conexão real com o Supabase. Produção permaneceu no deployment `8cf6bc7`. Banco, credenciais e domínios de produção permaneceram intactos. P-009 concluída. A proposta de limpeza aguarda autorização. |
| Reversão | Reverter somente a alteração documental se necessário. A eventual remoção das branches ou do Preview exige autorização separada. |
| Identificação Git | Branch local `docs/conclusao-validacao-deploy`, base `c1afad6`, com evidência no [PR #3](https://github.com/neopep/App-NeoPep/pull/3). |

## MEM-20261120-007

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Registrar o Preview direto do colaborador e atualizar o procedimento das duas contas. |
| Contexto | O fluxo anterior via merge do proprietário (MEM-20261120-006) foi confirmado antes do teste com o repositório temporariamente público. |
| Decisão | Ambas as contas podem desenvolver e publicar nos limites da autorização de cada tarefa, preservando a identidade real. O Preview direto dispensa merge do proprietário nas condições verificadas. |
| Evidências | O Git registra `b290acf` com autoria de `rafarwr5`. O proprietário confirmou Preview automático Ready em 6 segundos, abertura normal pelo botão Visit e marcador `NEOPEP-PUBLIC-PREVIEW-OK` visível, sem intervenção da conta proprietária. |
| Arquivos e impactos | Integrações, histórico, protocolo, pendências e próximas tarefas. Escopo documental, sem mudança em dados, credenciais, domínios ou configurações. |
| Dependências | GitHub, visibilidade do repositório, identidade autorizada e elegibilidade no Vercel Hobby. |
| Limitações e pendências | Este registro cobre o Preview. A evidência posterior de Production Ready consta no MEM-20261120-008. [Pendências](../conhecimento/PENDENCIAS.md) |
| Reversão | Reverter apenas o registro documental se necessário. Qualquer ensaio de produção tem preparação e reversão separadas. |
| Identificação Git | Branch local `docs/preview-direto-validado`, base `b76844b`. [Commit do Preview](https://github.com/neopep/App-NeoPep/commit/b290acfd5c8d631d889b5e704777e1e8f9480bfd) |

## MEM-20261120-008

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Consolidar a validação GitHub, Codex Cloud e Vercel em produção e preparar o encerramento dos testes. |
| Contexto | O Preview direto do colaborador foi confirmado no MEM-20261120-007 com o repositório temporariamente público. |
| Decisão | Ambas as contas podem desenvolver, editar, criar commits, enviar alterações e publicar diretamente com identidade real, respeitando a autorização de cada tarefa. |
| Evidência Git | A main remota contém `3f9be6465961640d7209d64a9a7b93ea69451fb6`, de autoria e committer `rafarwr5`, com somente a adição de `dist/diagnostico-producao.txt`. [Commit](https://github.com/neopep/App-NeoPep/commit/3f9be6465961640d7209d64a9a7b93ea69451fb6) |
| Evidência Vercel | O proprietário confirmou no painel que o push direto gerou Production Ready em 7 segundos, sem intervenção de `neopep`. |
| Limitações | O proxy bloqueou a consulta ao domínio com 403 no túnel. A entrega do marcador em produção segue sem evidência. O repositório permanece público temporariamente e voltar ao modo privado pode restabelecer a limitação do Vercel Hobby. |
| Arquivos e impactos | AGENTS.md, integrações, procedimento, histórico e acompanhamento. Consolidação exclusivamente documental, sem alterações funcionais, de banco, credenciais, domínios ou configurações. |
| Verificações | npm run check, build em cópia isolada da main remota e git diff --check. |
| Limpeza e reversão | O proprietário autorizou a limpeza. A remoção de produção é um commit separado com apenas dist/diagnostico-producao.txt. As referências de arquivo usam o prefixo arquivo/testes-20261120/. Preserve os SHAs, o PR #3 e o MEM-20261120-005. A exclusão de branches não confirma retirada das URLs de Preview. |
| Identificação Git | Base documental `3f9be64`. Localize a consolidação e a remoção separada com `git log --oneline --grep=MEM-20261120-008`. A confirmação do deployment da remoção é uma etapa posterior. |

## MEM-20261120-009

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Implementar MA-01 e MA-02, a fundação multiagente e a transição compatível do agente existente. |
| Contexto anterior | A main em `d55b85c` contém a remoção do marcador de produção posterior ao registro MEM-20261120-008. No código, `agent_settings` tem uma linha singleton e `agent_knowledge`, `support_threads` e `ai_jobs` ainda não possuíam UUID de agente. O frontend administrativo consome `neo_agent` e a Edge Function usa claim e finish da fila legada. |
| Decisão e justificativa | Identificar o padrão por UUID fixo e projetar suas configurações e conhecimento ao vivo. Adicionar catálogo, RPC administrativa e referências de execução sem copiar credenciais, alterar o worker ou ativar agentes adicionais. |
| Arquivos e impacto | Migração `202611200001_multiagent_foundation.sql`, teste PGlite e documentação de banco, IA e memória. Painel, Edge Functions, consentimentos e layout mantêm o fluxo legado. |
| Dependências | Workspace legado e RPCs de autorização, integrações cadastradas e PostgreSQL/Supabase. |
| Testes | Linha de base com 229 aprovados e 67 falhas. Com a fundação, 230 aprovados e os mesmos 67 casos com falha. O teste novo verificou segurança, isolamento, reexecução, credenciais intactas, lease sem duplicação e modos manual, sugestão e automático. Check, build isolado e diff passaram. |
| Erros e soluções | Corrigida a expressão SQL de limite no teste isolado. A consulta remota de metadados foi bloqueada pelo proxy com 403. O esquema privado remoto permanece sem verificação. |
| Limitações e pendências | MA-03 deve integrar painel e processamento por agente em staging, com revisão de permissões e estratégia de corte. A implantação depende de auditoria de metadados, validação do tempo de bloqueio, revisão de capacidade e autorização. |
| Reversão | Suspender o uso da RPC nova e manter o runtime legado. Preserve catálogo e histórico até eventual migração compensatória revisada. [Banco de dados](../conhecimento/BANCO-DE-DADOS.md#fundação-multiagente) |
| Identificação Git | Branch `feature/multiagentes-fundacao`, base `d55b85c`. Revisão e teste isolado confirmados antes do envio de `0285b37` por `rafarwr5`. O pacote web e as funções Edge permaneceram intactos na fundação. |

## MEM-20261120-010

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Implementar MA-03, com administração do catálogo e processamento efetivo por agente. |
| Contexto anterior | A fundação foi publicada na branch de trabalho em `0285b37`. Seus agentes adicionais podiam ser cadastrados, e seus vínculos ainda eram apenas planejados. |
| Decisão e justificativa | Integrar o catálogo aos componentes atuais. Usar seleção explícita por conversa, consentimento ligado ao provedor, revisão e cota por agente. Validar modelo alternativo por chamada de teste da integração já cadastrada. Manter as RPCs anteriores disponíveis para a execução padrão e para reversão. |
| Arquivos e impacto | Painel, controles do atendimento, adaptador Supabase, pacote PWA, build, migração MA-03, Edge Functions, testes e documentação. Sem credencial, cobrança, roteamento automático ou troca de configuração de produção. |
| Dependências | Fundação MA-01/02, Supabase Auth e PostgreSQL, funções de atendimento, worker ai-reply, agent-integrations e conexões de provedor existentes. |
| Testes e resultados | Check, build, diff, prévia HTTP nas duas rotas e testes focados passaram. Na suíte completa, 232 de 299 passaram. Os mesmos 67 casos falharam na linha de base de 296 casos. O cenário isolado verificou reexecução, isolamento, troca com nova autorização, modelo e cota por agente, sugestão privada, recusa de duplicata e encaminhamento humano. A Edge Function foi testada com provedor simulado. |
| Erros e soluções | O build regenerado expôs espaço final em um literal do SDK no diff. A geração passa a escapar os caracteres iniciais do literal sem mudar seu valor. |
| Limitações e pendências | Esquema remoto, timing de locks e concorrência em infraestrutura real, layout em aparelhos reais e provedores reais aguardam validação autorizada em staging. Uma resposta já solicitada ao provedor pode terminar externamente, embora o lease inválido impeça publicar no aplicativo. |
| Reversão | Desativar agentes adicionais, manter as conversas afetadas em manual e drenar a fila antes de restaurar código anterior. Preservar históricos e manter consentimentos sob revisão. [Plano completo](../conhecimento/BANCO-DE-DADOS.md#runtime-multiagente-e-implantação) |
| Identificação Git | Branch `feature/multiagentes-fundacao`, base `0285b37`. A consolidação pode ser encontrada com `git log --oneline --grep=MEM-20261120-010`. |

### Consolidação da MA-03

A revisão tornou manual a conversa que volta de um agente adicional ao padrão, evitando transição automática sem revisão da equipe. Foram aplicadas as migrações em PostgreSQL 17.12 descartável, sem rede e sem credenciais de produção. A auditoria de metadados executou antes e depois, e a MA-03 foi reaplicada. Sessões PostgreSQL independentes confirmaram cota isolada, lease único, retomada após expiração e publicação única. O teste DOM e o transporte Edge simulado permanecem complementares. [Roteiro de concorrência](../../tests/multiagent-postgres.py)

A consulta remota ao Supabase foi bloqueada por 403 no proxy. Nenhum staging Supabase foi identificado no ambiente de desenvolvimento. A compatibilidade remota depende do catálogo real e permanece pendente. [Auditoria somente leitura](../../release/auditoria-multiagentes.sql)

Os mesmos 67 casos da linha de base continuam catalogados em dez classes, sem alterações fora do escopo. [Triagem](TRIAGEM-TESTES-BASE-MA03.md) · [Plano de publicação e reversão](../processos/PUBLICACAO-MULTIAGENTE.md)

## MEM-20261120-011

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Preparar a implantação integral de MA-01 a MA-03 e separar evidência local de requisitos remotos. |
| Base | Branch `feature/multiagentes-fundacao` em `c770682`, confirmada no GitHub sem commits posteriores na revisão. |
| Recuperação e preservação | O PostgreSQL 17.12 isolado restaurou um backup lógico sintético em outro banco do contêiner. O fingerprint confirmou configurações, conhecimento, integração, conversa, mensagens, consentimento e job preservados após as migrações. O padrão preexistente continuou ativo. A migração deixou o catálogo sem agentes adicionais, e o teste de cadastro confirma estado inicial inativo. |
| Concorrência e Edge | O ensaio repetiu os testes de cotas, leases, finalização única e horários. Os bundles de ai-reply e agent-integrations passaram na checagem sintática. A execução de contratos usou SDK e provedor simulados. |
| Pendências efetivas | O proxy retornou 403 para o Supabase e para o Preview. Backup, PITR, Storage, estrutura remota e staging Supabase separado aguardam evidência. [Verificações pela conta conectada](../processos/PUBLICACAO-MULTIAGENTE.md#evidências-a-obter-pela-conta-com-acesso) |
| Impacto e aprovação | Trabalho local de teste e documentação. A homologação em staging e a publicação definitiva exigem autorizações separadas. O plano de ativação e reversão continua em [Publicação multiagente](../processos/PUBLICACAO-MULTIAGENTE.md). |

## MEM-20261120-012

| Campo | Registro |
| --- | --- |
| Data | 20/11/2026, America/Sao_Paulo. |
| Objetivo | Preparar a instalação limpa de MA-01 a MA-03 no novo projeto de homologação. |
| Infraestrutura confirmada | A conta principal informou conexão com `neopep-staging` (`qnuluspqfazdppciermw`, PostgreSQL 17.12), sem tabelas do aplicativo nem usuários. O projeto operacional `neopep` permanece em PostgreSQL 17.11. |
| Backup informado | `pg_dump` 17.12 retornou 0 e produziu 1.067.243 bytes. O índice foi lido e a leitura integral por `pg_restore` com destino NUL passou. A restauração do backup real está pendente. Nenhum dado operacional entrou neste pacote. |
| Decisão | Gerar cópias de 47 migrações de `c770682`. Ajustar apenas as URLs dos dois triggers de push nas cópias. A instalação usa preflight, pós-teste e sem segredos ou cron ativos. Configurar a aplicação de homologação somente com a chave publishable e o host do staging. |
| Testes | PostgreSQL 17 isolado com Auth/Storage/Vault e pg_net simulados executou a ordem completa e a auditoria. A fixture repetida manteve dois perfis, dois agentes adicionais inativos, três itens de conhecimento e nenhuma credencial de IA. O artefato web foi ensaiado com gateway e chave fictícios. |
| Limitações e pendências | O proxy retornou 403 para o staging. Aplicação remota, credenciais próprias de homologação e testes reais de Auth, Edge e frontend aguardam a conta conectada. A recuperação do backup real exige alvo separado e autorização. |
| Impacto e reversão | Preparação local. Nenhuma migração original, configuração operacional ou dado de produção foi alterado. Reexecução parcial em staging exige revisar o último arquivo concluído. [Manual](../processos/HOMOLOGACAO-MULTIAGENTE.md) |

## MEM-20261120-013

Em 20/11/2026 (America/Sao_Paulo), a configuração publicada do App-NeoPep foi verificada no ambiente Cloud. O proxy retornou `CONNECT 200` com validação TLS para `mcp.supabase.com`, `api.supabase.com` e `qnuluspqfazdppciermw.supabase.co`. As rotas testadas responderam `HTTP 401` às chamadas sem credenciais. O `403` do proxy deixou de ocorrer nos três testes.

A integração oficial do Supabase via OAuth confirmou `neopep-staging` (`qnuluspqfazdppciermw`). A consulta `SELECT 1 AS ok` retornou `1`. Na retomada de `staging/multiagentes-homologacao` em `08a5a87`, a integração gravou em uma tabela temporária e executou `ROLLBACK`. O preflight versionado passou com `pg_net` 0.20.4. [Roteiro de homologação](../processos/HOMOLOGACAO-MULTIAGENTE.md)

A instalação remota aplicou os seis primeiros arquivos históricos, individualmente pelo SQL da integração oficial e com as transações originais. O registro de execução fica nesta documentação. A revisão automática recusou `202611120007_community_alerts.sql` porque a migração cria a fila de push comunitário e permite ativar push antes da validação específica. A execução parou na primeira recusa. A presença de `community_snapshot(uuid,jsonb)` confirmou o sexto arquivo. A auditoria parcial e o ponto de retomada estão nas [evidências](../../release/multiagent-staging/install/EVIDENCIAS.md).

## MEM-20261120-014

Em 20/11/2026 (America/Sao_Paulo), a retomada de `staging/multiagentes-homologacao` em `08a5a87` verificou os objetos das seis primeiras migrações no projeto `neopep-staging` (`qnuluspqfazdppciermw`). As migrações 7 a 16 foram aplicadas em ordem. A revisão automática recusou o SQL original da 10 porque ele habilita push por padrão. A cópia de staging manteve o padrão desativado e acrescentou uma restrição para rejeitar novas preferências ativas. A cópia preparada para a migração 22 preserva esse padrão e aguarda aplicação. Os originais permanecem no pacote versionado.

A revisão automática recusou a migração 17 porque ela estende os privilégios de administrador da plataforma aos moderadores da comunidade. A verificação remota confirmou que `neo_admin_access()` ainda mantém os papéis separados. Para retomar, revise e aprove o contrato de privilégios da migração 17. Antes de reaplicar arquivos, confira os objetos do staging e a ordem registrada. Em caso de reversão, revise uma migração compensatória de staging considerando os objetos já instalados e suas dependências.

O conector GitHub confirmou `rafarwr5`. O repositório local foi configurado com o nome da conta e o endereço registrado no commit-base, e as identidades efetivas de autoria e committer passaram na conferência. O CLI GitHub recebeu HTTP 403 ao consultar a identidade. O registro está na branch local `docs/homologacao-app-neopep`. Consulte os [resultados de segurança e testes](../../release/multiagent-staging/install/EVIDENCIAS.md#segunda-retomada-em-20112026).

## MEM-20261120-015

Em 20/11/2026 (America/Sao_Paulo), o responsável relatou que a conta principal consultou a produção em modo somente leitura. Segundo esse relato, `public.neo_admin_access()` exige `auth.uid()` e aceita vínculo em `neo_private.admin_members` ou `neo_private.community_moderators`. O responsável encontrou zero moderadores na produção e autorizou reproduzir o contrato histórico no staging. A sessão retomou pela migração 17 depois de confirmar zero usuários, administradores, moderadores, segredos, dispositivos e Edge Functions no staging, catálogo de cron ausente e a restrição de push ativa. A conta de produção não foi consultada nesta sessão.

A separação de administrador de plataforma, moderador da comunidade, operador de atendimento e gestor de agentes fica registrada como melhoria futura. [Decisões](DECISOES.md)

As 31 migrações restantes passaram no projeto autorizado, totalizando 45 históricas e duas multiagente. O ensaio usou as substituições de staging das posições 22, 038 e 039. A revisão automática havia recusado a versão original da 038 por permitir egress de push. As cópias 038 e 039 mantêm os três gatilhos desabilitados e os corpos de despertar sem HTTP ou Vault. O pós-teste adaptado, a auditoria SQL e o teste transacional com usuários fictícios passaram. As duas Edge Functions foram implantadas somente no staging, com JWT obrigatório. [Evidências](../../release/multiagent-staging/install/EVIDENCIAS.md#instalação-concluída-em-20112026)

## MEM-20261120-016

Em 20/11/2026 (America/Sao_Paulo), o proprietário autorizou autonomia para ações rotineiras no escopo das tarefas de homologação. O AGENTS.md e o protocolo registram a autorização, as verificações obrigatórias da plataforma e as exceções de produção, segurança, custos e operações destrutivas.

O ambiente permanente usa `teste.app.neopep.com.br` e o Supabase `qnuluspqfazdppciermw`. A referência remota `staging/multiagentes-homologacao` impede criar a ref `staging`. A branch proposta `staging/permanente` usa build dedicado, URL Supabase fixa, verificação de chave pública, identidade PWA própria e configurações independentes. O build com a chave pública do staging e os dez testes focados passaram.

A revisão do Advisor inventariou 43 avisos SECURITY DEFINER e 48 ocorrências RLS. Nenhuma tabela privada sinalizada tinha grants diretos aos papéis públicos do aplicativo. A única função entre as sinalizadas executável anonimamente é o gatilho DDL `rls_auto_enable()`. A revisão funcional das RPCs com duas contas permanece pendente.

`push-dispatch` versão 1 foi implantada somente em staging com JWT obrigatório. POST sem JWT retornou 401. POST com JWT anon do staging retornou 503 de configuração pendente. A entrega inclui scripts de ativação, fallback e reversão, e regressão do payload de biblioteca e loja. Gatilhos e cron permanecem desativados. O Auth ainda aceita cadastro público no backend, e o ensaio autenticado depende de gestão administrativa do staging.

A configuração manual e o inventário de funções estão no [roteiro permanente](../processos/HOMOLOGACAO-PERMANENTE.md). A [revisão de segurança](../processos/AUDITORIA-HOMOLOGACAO.md) registra os grants e a matriz de verificação. Produção ficou fora do escopo operacional.

A publicação da branch `staging/permanente` foi confirmada no GitHub. A referência da `main` continuou em `d55b85c`. A checagem remota posterior encontrou três gatilhos de push desativados, zero dispositivos, fila HTTP vazia e catálogo de cron ausente. O GUC de URL usado pelos scripts de push não estava definido.

## MEM-20261120-017

Em 20/11/2026 (America/Sao_Paulo), o proprietário informou a primeira publicação de `staging/permanente` no projeto Vercel `app-neopep-staging`, com HTTPS e proteção All Deployments em `https://teste.app.neopep.com.br`. O proprietário confirmou o backend de staging e as URLs de Auth. A sessão confirmou a branch remota e o Auth do projeto `qnuluspqfazdppciermw`: cadastro público e anônimo desativados, e-mail ativo e as duas contas fictícias confirmadas administrativamente. O proxy Cloud negou CONNECT ao domínio do frontend com 403, portanto HTTPS, proteção, artefato servido e redirects exatos não foram verificados independentemente nesta sessão.

O script versionado `release/staging/preparar-contas.sql` passou com todas as guardas. A conta fictícia administrativa foi a única com o vínculo de administração; não havia moderadores. Em transação com rollback, o papel authenticated com as identidades fictícias confirmou acesso administrativo e ao catálogo para a conta admin e recusa para a conta comum. A primeira tentativa em transação somente leitura falhou porque a listagem mantém um contador de rate limit; a repetição com rollback passou. O ensaio SQL não utilizou login ou senha.

`ai-reply`, `agent-integrations` e `push-dispatch` estão ativas com verificação JWT. OPTIONS com a origem do staging retornou, respectivamente para as duas funções de IA, 405 e 403 sem permitir a origem. O próximo ensaio autenticado depende da configuração CORS e de sessões de teste obtidas pelo fluxo seguro da aplicação. Há zero credenciais de IA, agentes adicionais ou agentes padrão habilitados. Seis funções continuam pendentes conforme o inventário.

Push permanece inativo: três gatilhos desabilitados, zero inscrições, zero entradas de push no Vault, fila HTTP vazia e catálogo cron ausente. O próximo ensaio exige VAPID e segredo independentes, chamada do worker autenticada com filas vazias e opt-in em dispositivo isolado. A ativação e o fallback seguem o [roteiro permanente](../processos/HOMOLOGACAO-PERMANENTE.md).

## MEM-20261120-018

Em 20/11/2026 (America/Sao_Paulo), a origem fixa de homologação foi vinculada em código à URL Supabase do projeto `qnuluspqfazdppciermw`. O conector não oferece gestão das variáveis de Edge. As funções `ai-reply` e `agent-integrations` foram reimplantadas na versão 2, e `platform-integrations` foi instalada na versão 1, com JWT obrigatório. As três retornaram 204 com CORS para a origem autorizada, 403 sem permissão de origem externa e 401 em POST sem JWT. A revisão automática bloqueou `delete-account` pela natureza irreversível do endpoint. As dependências das demais funções estão no roteiro.

O ensaio verificou zero dispositivos, zero jobs das quatro filas de push, fila HTTP vazia, três gatilhos desativados e catálogo cron ausente. O worker respondeu 503 usando JWT anon do staging. Foi gerado um par VAPID exclusivo e um segredo em arquivos privados do ambiente Cloud, sem transferência para serviços nesta sessão. O gerador reproduz a preparação local, com a variável pública separada. O escopo manual e os cinco casos de teste estão no [roteiro permanente](../processos/HOMOLOGACAO-PERMANENTE.md).

Os 19 testes focados de Edge passaram. O ensaio SQL emulado `platform-ai` apresentou a dependência ausente `vault.decrypted_secrets`. O GitHub registrou sucesso do projeto Vercel de staging no commit `f498f89`. O proxy Cloud negou o acesso direto ao domínio do frontend.

## MEM-20261120-019

Em 20/11/2026 (America/Sao_Paulo), o responsável confirmou a instalação das quatro variáveis de push nas Edge Functions de `qnuluspqfazdppciermw`, o redeploy Ready na Vercel de staging e `pushVapidPublicKey` preenchida no frontend publicado.

O preflight no staging confirmou zero dispositivos, zero jobs nas quatro filas de push, fila HTTP vazia, três gatilhos desativados e catálogo de cron ausente. O POST a `push-dispatch` com JWT anon do staging e a cópia Cloud anterior do segredo retornou HTTP 401 com `{"error":"unauthorized"}`. Pelo código do worker, o segredo em execução passou pela verificação inicial de comprimento, mas a autenticação do segredo apresentado falhou antes da leitura das variáveis VAPID e das filas. O aceite HTTP 200 com contadores zerados depende de um teste com o segredo efetivamente instalado, fornecido por canal autenticado sem exposição. Nenhum dispositivo, registro de teste ou disparo foi criado.

A requisição a `https://teste.app.neopep.com.br/neo/` recebeu 403 no CONNECT do proxy Cloud, antes de obter resposta da Vercel. A resolução do 404 permanece sem confirmação independente.

## MEM-20261120-020

Em 20/11/2026, a atualização para NeoPep foi preparada localmente em staging e em uma branch independente baseada na main. Os nomes em interface, instalação, manifesto, títulos, notificações e textos institucionais foram atualizados. O build de staging usa NeoPep Teste como nome completo e NeoPep como nome curto. Identificadores da PWA, rotas, dados e contratos de serviços foram preservados. O cache do shell foi versionado para a atualização.

As imagens apareceram na mensagem, mas os PNGs originais não estavam disponíveis no sistema de arquivos da sessão. Logotipo e ícones novos, publicação em staging e validação interativa seguem pendentes. A promoção de produção depende dessas etapas. As verificações estáticas passaram e os testes focados tiveram 65/67 em cada base. As duas falhas de privacidade de push foram reproduzidas na base de staging e não foram corrigidas no escopo de marca.

Complemento: o ZIP com os PNGs oficiais foi recebido. O logotipo molecular foi preservado byte a byte com seu canal alfa. A arte de infinito foi redimensionada sem corte para os ícones PWA, Apple Touch Icon, favicon e variante maskable. A prévia portátil incorpora as imagens. A preparação de produção foi aplicada separadamente sobre a main. As duas falhas já registradas de privacidade em push foram reproduzidas e preservadas: o service worker aceita corpo fornecido no payload para lembrete e comunidade.

## MEM-20261120-021

O build exclusivo de staging gera o manifesto NeoPep Teste com ID, start_url e scope na raiz. Mantém uma página estática de compatibilidade em `/neo/`, as rotas antigas de assets e do service worker na Vercel e o redirect Auth existente. Os caches da raiz e do escopo legado são separados e a limpeza de cache fica limitada ao próprio escopo. A raiz reaproveita uma inscrição push antiga acessível pelo mesmo navegador quando ainda não tem inscrição própria. A correção não desregistra workers, não recadastra VAPID e não apaga armazenamento local. A identidade visual permanece a publicada.

O teste de build confirmou o manifesto, a página legada, o callback, os caches e a configuração de revalidação do worker legado. As simulações de UI e instalação passaram. As duas falhas preexistentes de privacidade em push foram preservadas. Abertura nativa em Windows, iPhone e Android fica para confirmação em dispositivos.

## MEM-20261120-022

Em 20/11/2026, o proprietário confirmou que o PWA já instalado voltou a abrir no Windows após o commit `52b49a9`. O build de homologação passou a gerar `name` e `short_name` como NeoPep Teste, com ID, abertura e escopo em `/`. O teste de build verificou o manifesto usado por Windows e Android e o título Apple da tela inicial do iPhone. A compatibilidade com `/neo/`, os logotipos e as notificações foram preservados.

## MEM-20261121-001

Em 21/11/2026, os dois PNGs fornecidos no novo Logo.zip substituíram as imagens do NeoPep Teste. O logotipo interno RGB de 4000 × 4000 foi copiado sem alterações. Os ícones comuns e o favicon preservam a transparência do original de crescimento. As versões Apple e maskable usam fundo opaco e a versão maskable inclui margem de segurança. O cache de staging avançou para pwa-v3. Nomes, ID, escopo, rotas legadas, autenticação e notificações foram preservados.

A conferência dos originais e dos tamanhos derivados, o npm run check e o teste do manifesto passaram. A suíte focada teve 66/68, com as duas falhas já registradas de privacidade em notificações. A promoção das imagens para a main depende da aprovação visual em staging.

## MEM-20261121-002

Em 21/11/2026, o NeoPep Teste passou a usar em `dist/assets/logo-neopep.png` o PNG original de crescimento de 1254 × 1254 do último Logo.zip, copiado byte a byte. O caminho compartilhado atende login, cabeçalho, administração e páginas relacionadas. Os derivados de instalação, nomes, cache e configuração são os da versão anterior. A publicação é exclusiva de staging/permanente. O npm run check passou, e a suíte focada teve 66/68 com as duas falhas preexistentes de privacidade em notificações.

## MEM-20261121-005

Em 21/11/2026, o NeoPep Teste passou a exibir históricos de evolução e perfil recolhidos, ordenados por dia do mais antigo ao mais recente. A grade pede apenas miniaturas reduzidas visíveis. A foto ampliada e a comparação Antes/Depois pedem a imagem individual. Fotos antigas sem miniatura no bucket aparecem com acesso individual ao original. Fotos locais antigas recebem uma miniatura em memória sob demanda. O arquivo salvo em JPEG e a miniatura privada são separados; geração de miniaturas não reescreve o acervo anterior.

O formulário de evolução aceita seleção múltipla e sucessiva, prévias removíveis, data comum ou EXIF DateTimeOriginal de JPEG quando válida, progresso por fase e contadores. O lote usa até dois envios simultâneos e tem IDs estáveis para retentativas na mesma seleção. O recorte e o envio individual de perfil foram preservados. HEIC depende da decodificação do navegador; sem metadado confiável o formulário usa a data comum informada.

A restauração mantém uma tela discreta até resolver a sessão. Erros de conexão oferecem nova tentativa e o fluxo de retorno de autenticação continua no endereço já configurado. O build passou a emitir dist/app.js a partir de src/app.js e renovou o cache de staging.

Build, check e 91 testes pertinentes passaram. Os testes exercitaram seleção sucessiva, cancelamento, lote de dez, limitação de concorrência, falha parcial, retentativa e isolamento do caminho assinado com transporte simulado. Em leitura, staging confirmou bucket privado de 5 MB, RLS e políticas por conta. Duas falhas de privacidade do conteúdo push da suíte PWA ampla permanecem preexistentes e fora do escopo. A verificação em iPhone real, em conexão móvel e de envio real entre duas contas continua pendente. Não houve alteração de banco, pagamentos, agentes, notificações ou produção.

## MEM-20261121-006

Em 21/11/2026, a galeria do NeoPep Teste ganhou comparação sempre aberta com sliders nativos independentes, ordem cronológica e posições distintas para datas iguais. As legendas e datas são atualizadas imediatamente. As prévias usam miniaturas e o carregamento é agrupado durante deslocamentos rápidos. O histórico de evolução e perfil continua recolhido; a grade compacta tem até quatro colunas e um único controle por foto.

O visualizador abre antes de solicitar a imagem de tamanho integral, mantém uma barra de ações com Fechar, Download e Excluir, usa o fechamento nativo e devolve o foco. A exclusão requer confirmação e atualiza o histórico e a comparação. Novos envios geram miniaturas com lado máximo de 160 px. Fotografias legadas sem miniatura exibem o acesso individual e não provocam download automático de originais. A eventual geração de miniaturas antigas exigirá um backfill privado separado e fica pendente. O upload em lote, o bucket privado e a emissão de links assinados foram preservados.

Build, npm run check e 94 testes pertinentes passaram. Os testes simularam cem fotos, datas iguais, respostas fora de ordem, abertura do visualizador durante o carregamento e recusa da exclusão. Os testes PWA selecionados cobriram manifesto e cache, mantendo fora do escopo as duas falhas preexistentes de privacidade em push. A validação em Safari e PWA em iPhone físico segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-007

Em 21/11/2026, a comparação Antes e Depois passou a compartilhar seleções, metadados e miniaturas entre Fotos e Início. Cada lado oferece somente datas com fotos de evolução e um controle restrito ao dia, com posição acessível e ocultação quando só há uma foto. A troca de data seleciona a primeira foto do dia. A seleção inicial usa a mais antiga e a mais recente. O cartão Minha evolução no Início mostra duas ilustrações locais identificadas como Exemplo com zero fotos, ou uma foto e convite para adicionar a segunda. Não oferece gerenciamento. A tela Fotos preserva históricos, ampliação, exportação e exclusão.

O pré-carregamento usa no máximo dois pedidos simultâneos e uma janela de oito fotos por lado do dia selecionado. Objetos em memória evitam baixar novamente as miniaturas prontas, com limite de 32 entradas prontas e revogação ao sair da conta ou descartar a entrada. Resultados obsoletos são ignorados. A navegação não solicita originais. O shell PWA inclui os dois exemplos locais e o build de staging renova a versão do cache. A prévia portátil incorpora as imagens.

Build, npm run check e 97 testes pertinentes passaram. Os testes simulam zero, uma, duas e muitas fotos, datas iguais, consulta fora de ordem, miniaturas ausentes, isolamento e retomada do lote. Não houve teste físico em Safari/PWA de iPhone nesta sessão. Publicação restrita a staging/permanente. Banco, produção e demais funcionalidades preservados.

## MEM-20261121-008

Em 21/11/2026, a comparação no Início foi movida para a seção recolhida Ver meu acompanhamento. O cabeçalho tem Ver fotos, que abre a galeria completa. Os exemplos locais foram preservados. Início e Fotos compartilham posições fixas de imagem, data, legenda e slider. As imagens usam contain e fundo neutro, e o espaço do slider permanece reservado com uma foto.

Novos envios mantêm o JPEG integral, a miniatura de 160 px e a prévia JPEG privada de até 800 px. As três variantes são separadas e removidas ao excluir a foto. Na nuvem, o legado tenta a miniatura existente quando não há prévia. A geração intermediária para o legado é viável pelo pipeline privado existente, mas um backfill exigiria ler cada original mediante autorização de conta, gravar somente o derivado no bucket privado e preservar o original. Nenhum backfill foi iniciado. O legado local pode gerar prévia diretamente do Blob existente.

A fila prepara as prévias dos dias selecionados com prioridade para a foto visível e máximo de dois pedidos simultâneos. O cache de sessão retém imagens decodificadas quando o navegador permite, revoga URLs descartadas, estima o limite de 24 MiB com até 32 entradas prontas e limpa ao trocar de conta. URLs assinadas são renovadas após recusa de acesso, e resultados obsoletos são ignorados. A versão do cache de staging foi incrementada. Build, npm run check e 101 testes pertinentes passaram. Retina, Safari e PWA em iPhone físico seguem sem verificação nesta sessão. Publicação restrita ao NeoPep Teste.

## MEM-20261121-009

Em 21/11/2026, a comparação do Início passou a aparecer imediatamente após Seu resumo, dentro de Ver meu acompanhamento. Evolução substituiu o botão isolado pelo componente compartilhado e manteve os gráficos. Fotos usa o mesmo componente desde zero registros, sem o aviso técnico visível. Início e Evolução oferecem Ver fotos. Com zero dias há dois exemplos. Com um dia, mesmo com várias fotos, Antes mostra uma foto real e Depois mostra um exemplo sem data. A partir de dois dias, o padrão mostra a mais antiga e a mais recente. Exemplos são imagens estáticas; nenhuma entra no histórico.

O CSS removeu as alturas conflitantes de imagens. A moldura tem tamanho definido independentemente da imagem, usa contain e centralização e mantém controles e legendas em linhas alinhadas. A prévia privada de até 800 px e o cache de sessão foram preservados. Em staging havia oito fotos de evolução sem prévia intermediária, todas com miniatura antiga. Essas oito dependem de backfill posterior para ganhar resolução; nenhum original foi baixado ou regravado para esse fim.

Build, npm run check e 102 testes pertinentes passaram. A verificação de staging por política RLS confirmou acesso apenas aos metadados próprios. Uma fixture transacional com rollback confirmou que o participante enxerga seu metadado sintético e um administrador de outra conta não o vê. A tentativa de validação visual no Chromium local não concluiu no sandbox. Safari, PWA e proporções com fotos reais no iPhone ainda precisam de conferência. Publicação exclusiva de staging/permanente.

## MEM-20261121-010

Em 21/11/2026, a comparação compartilhada de Início, Evolução e Fotos passou a usar duas molduras 9:16 iguais, fundo neutro e imagens centralizadas com proporção preservada. Seletores nativos de data ganharam área de toque de 44 px, chevron e aparência sem contorno. As legendas mostram Antes ou Depois e Foto X de Y. Os sliders têm trilha preenchida em dourado, restante neutro, foco visível e estilos para WebKit e Gecko.

A seleção por dia, o carregamento, o cache de sessão e a privacidade das fotos foram preservados. O build renovou a revisão do shell do PWA de staging para servir os recursos atualizados. Build, npm run check e 102 testes pertinentes passaram. Os testes automatizados verificam as regras da moldura, dos controles e do PWA. A conferência visual com fotos verticais, horizontais e quadradas no Safari de um iPhone físico segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-011

Em 21/11/2026, o NeoPep Teste recebeu o modal Minha Evolução nos componentes compartilhados de Início, Evolução e Fotos. Ele usa as duas escolhas atuais e o acesso autenticado já existente aos originais do bucket privado. O Canvas gera um JPEG 9:16 de 1080 × 1920, ou 720 × 1280 quando o navegador informa até 4 GB de memória. Apenas uma foto é decodificada por vez. A marca NeoPep fica integrada aos pixels e sobre a base das molduras, com a área das fotos livre para preservar os rostos.

O JPEG exibido é o mesmo utilizado para salvar ou compartilhar. A exportação exige fotos da própria conta em dois dias distintos. Exemplos, modo local e seleções do mesmo dia têm exportação indisponível. A composição é temporária. Não é gravada no Supabase nem enviada automaticamente. O fechamento e a troca de conta liberam os recursos. A opção sem marca-d’água permanece indisponível até que o backend autorize o plano Premium.

Build, npm run check, empacotamento portátil e 104 testes pertinentes passaram, incluindo o compartilhamento simulado, a alternativa de download, a geometria de imagens em três proporções e o descarte após troca de conta. A conferência visual do JPEG e o compartilhamento e salvamento nativos em Safari/PWA de iPhone físico seguem pendentes. Publicação restrita a staging/permanente.

## MEM-20261121-012

Em 21/11/2026, os botões de composição e adição de fotos passaram a ocupar linhas separadas em um grupo vertical. O Canvas carrega os pesos tipográficos da família padrão do aplicativo antes do desenho. A marca NeoPep translúcida foi aplicada na base das fotos, que preservam proporção e enquadramento integral. A faixa inferior agora contém um gráfico de linha com os registros reais da conta entre as datas selecionadas, em ordem cronológica e na unidade escolhida. Com menos de dois dias de pesagem, aparece uma mensagem discreta. O mesmo JPEG 9:16 continua sendo usado para prévia, salvamento e compartilhamento.

Build, npm run check, empacotamento portátil e 106 testes pertinentes passaram. Os testes de Canvas e compartilhamento usaram dados sintéticos. A tentativa de inspeção móvel no Chromium local expirou. Permanecem pendentes a conferência visual, incluindo a posição da marca em fotos reais, e o compartilhamento e download em Safari/PWA no iPhone físico. A regra Premium e os fluxos de privacidade foram preservados. Publicação exclusiva de staging/permanente.

## MEM-20261121-013

Em 21/11/2026, Início, Evolução e Fotos passaram a mostrar a variação de peso acima de Comparar e compartilhar. comparisonWeight usa as últimas pesagens identificáveis nas datas escolhidas e recorre a C.metrics para calcular a variação total quando faltam pesagens exatas. O indicador identifica o intervalo e a unidade. Exemplos e registros insuficientes não exibem valor. A mudança de foto no mesmo dia reaproveita o cálculo.

comparisonCard e paintComparison mantêm o indicador em sincronia. showComparisonExport captura fotos e variação em um snapshot imutável. chart e drawComparisonWeight compartilham pontos, escala e linhas de referência via chartGeometry. O JPEG traz o destaque numérico e o gráfico do mesmo período, com preenchimento em degradê e marca-d'água obrigatória. A referência de peso inicial do perfil, quando diferente da primeira pesagem, é explicitada no gráfico total. O controle Premium foi removido do modal.

Build, npm run check, empacotamento portátil e 108 testes pertinentes passaram. Os testes simularam os fluxos de Canvas, compartilhamento e download. A validação de ponta a ponta no Safari e PWA de um iPhone físico permanece pendente. Publicação restrita ao NeoPep Teste. [Commits da branch](https://github.com/neopep/App-NeoPep/commits/staging/permanente/) · [Deployments de homologação](https://vercel.com/neo-pep/app-neopep-staging/deployments)

## MEM-20261121-014

Em 21/11/2026, a composição Antes e Depois ganhou cabeçalho compacto, datas junto às fotos e duas colunas sem calha horizontal. As imagens inteiras são encaixadas com proporção original. O resultado numérico dourado foi sobreposto à divisão central, e a marca translúcida ficou na base da região compartilhada pelas fotos. O gráfico começa no limite inferior da foto mais alta e mantém valores, datas, pontos e degradê. O desenho usa coordenadas proporcionais nas duas resoluções. A seleção, o cálculo e os fluxos de prévia e exportação foram preservados.

Build, checagem de código, pacote portátil e 109 testes pertinentes passaram. Os testes verificam o Canvas simulado em 1080 × 1920 e 720 × 1280, fotos verticais, horizontais e quadradas e o limite de largura de um valor longo em libras. A conferência visual em aparelho físico segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-015

Em 21/11/2026, o resultado de peso no JPEG passou a usar metade do tamanho anterior e contorno proporcional. O número foi centralizado imediatamente acima da marca-d'água. O símbolo e o nome NeoPep foram centralizados como um conjunto, com a transparência existente, sobre a transição entre a base das fotos e o início do gráfico. A travessia ocupa somente a parte superior anterior às linhas do gráfico. Quando as fotos têm alturas diferentes, a transição acompanha a base da foto mais alta.

Build, checagem de código, empacotamento portátil e 109 testes pertinentes passaram. O Canvas simulado verificou o posicionamento em 1080 × 1920 e 720 × 1280. A inspeção visual em aparelho físico segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-016

Em 21/11/2026, o conjunto da marca-d'água do JPEG foi centralizado na transição entre as fotos e o gráfico. O símbolo ocupa os dois lados da transição, e o nome usa o centro visual do texto. O peso continua imediatamente acima. As linhas, pontos e valores do gráfico são desenhados sobre a marca translúcida, preservando a leitura e as dimensões do gráfico.

Build, checagem de código, prévia portátil e 109 testes pertinentes passaram. A geometria foi verificada em Canvas simulado em 1080 × 1920 e 720 × 1280. A inspeção visual em aparelho físico segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-017

Em 21/11/2026, o NeoPep Teste ganhou um contador de cadastros no atalho administrativo e uma lista compacta pesquisável na visão geral, com filtros, paginação por cursor e detalhes expansíveis. Avisos de até cinco contas são agrupados e desaparecem após nove segundos. O contador se atualiza a cada 30 segundos e ao retornar ao app. A leitura é confirmada no Supabase por administrador.

A migração 20261121170551 foi aplicada somente no staging qnuluspqfazdppciermw. O Auth registra a criação e a migração adiciona somente a data de início dos avisos e os recibos individuais privados. Contas antigas continuam no histórico. Os dados individuais exigem o vínculo existente de administrador da plataforma. Não há origem geográfica confiável. O último acesso usa os horários existentes de autenticação e atividade, quando presentes. O push não participa deste fluxo.

Build, checagem de código e prévia portátil passaram. A suíte focada teve 89 aprovações e as mesmas quatro falhas de base, duas de Configurações administrativas e duas de privacidade em push. As três verificações novas passaram. O teste Postgres ensaiou a paginação e a leitura agrupada de 2.500 cadastros. O teste remoto com rollback confirmou incremento, leitura, ausência de repetição, histórico e isolamento para dois administradores fictícios. O Advisor registrou alertas esperados de tabelas internas sem políticas de cliente, RPC autenticado com segurança do definidor e índice novo. A validação visual em dispositivos físicos segue pendente.

## MEM-20261121-018

Em 21/11/2026, o aviso passou a flutuar abaixo do cabeçalho com nove segundos visíveis, pausa em aba oculta, barra de progresso, fechamento antecipado e limpeza dos temporizadores. A confirmação de leitura e o contador foram preservados. Cadastros agora aparece logo após os indicadores gerais, seguido de Estatísticas de público, Funcionamento e erros.

A migração 20261121181510 foi aplicada somente ao Supabase de homologação qnuluspqfazdppciermw. O dashboard agrega cadastros e último acesso registrados. As observações de dispositivo e campanha exigem autorização no Perfil e podem ser exportadas e apagadas. Os dados expiram para consulta em 90 dias e a coleta autorizada seguinte limpa registros expirados em lotes. Foram preservadas as primeiras e últimas observações e omitidos segmentos com menos de cinco contas. Localização depende de integração confiável no servidor. Frequência, retenção e conversões aguardam fonte adequada.

Build, checagem de código e pacote portátil passaram. A suíte focada teve 109 aprovações e as quatro falhas preexistentes de configurações e push. A validação no Supabase usou transação com rollback para confirmar autorização, ausência de coleta sem opt-in, agregação, minimização, exportação e exclusão. O Advisor sinalizou a tabela interna sem política de cliente e o RPC autorizado com segurança do definidor. A validação visual em iPhone físico e desktop segue pendente. Publicação restrita a staging/permanente.

## MEM-20261121-019

Em 21/11/2026, o NeoPep Teste recebeu coleta própria de engajamento com autorização separada, eventos em lote, deduplicação e tempo ativo da página visível. O inventário de eventos e de pendências está no guia administrativo. Foram alterados src/app.js, src/cloud.js, os artefatos gerados em dist, os módulos de Comunidade, Loja e Atendimento, o painel administrativo e a revisão do shell do staging.

A migração 20261121183535 foi aplicada no Supabase qnuluspqfazdppciermw. O painel apresenta ranking, comparação de áreas e funis de pesagem, fotos e loja até pedido. Os dados de dispositivo e campanha são usados quando autorizados. As consultas administrativas agregam dados no servidor e omitem segmentos pequenos. A verificação após rollback registrou zero eventos reais persistidos. A coleta real depende da autorização e do uso de cada conta.

Build, checagem e prévia portátil passaram. A suíte focada passou em 111 de 115 testes e reproduziu quatro falhas preexistentes de configurações administrativas e push. Testes verificaram renderização sem duplicação, descarte de tempo em segundo plano, métricas, autorização e processamento de 5.000 eventos sintéticos. A verificação remota com rollback confirmou opt-in, deduplicação, funil, agregação e exclusão. O Advisor sinalizou a tabela privada sem política de cliente e o RPC autenticado com segurança do definidor. Validação visual em dispositivo físico segue pendente. Publicação exclusiva da branch staging/permanente.

## MEM-20261121-020

Em 21/11/2026, o painel de homologação recebeu navegação por seis seções, prévia de cinco cadastros, cadastro completo paginado, exportações CSV e centro de saúde com fontes sob demanda. Foram alterados dist/admin/admin.js, dist/admin/index.html, dist/style.css, src/cloud.js e seu bundle, o build de staging, o backend api/admin-monitor.js e os adaptadores de IA de atendimento. Os atalhos de agentes respondem com mensagens locais.

No Supabase qnuluspqfazdppciermw foi aplicada a migração 20261121184939. O monitor mede tamanho real do banco e índices, conexões, contagem e bytes conhecidos do Storage e erros reportados. As amostras preservam histórico, com limites e alertas manuais. A Edge Function ai-reply v4 permanece com JWT obrigatório. A telemetria de chamadas reais registra tokens normalizados. Estimativas OpenAI dependem de preço versionado. A consulta após rollback encontrou zero limites, preços, chamadas de IA e amostras persistidos. Não se iniciaram chamadas de IA, transações ou fontes de faturamento.

Build, checagem, prévia portátil e bundle da Edge passaram. Dos 120 testes focados, 116 passaram e quatro falhas preexistentes foram reproduzidas. O teste remoto com rollback validou autorização, observação, cache, limite, deduplicação e estimativa. O preflight real do ai-reply respondeu 204 e o POST sem sessão respondeu 401. O Advisor sinalizou tabelas internas sem políticas de cliente e o RPC autenticado com segurança do definidor. A validação visual em iPhone e desktop autenticados continua pendente. Publicação restrita a staging/permanente.

## MEM-20261121-021

Em 21/11/2026, foram revisados MEM-017 a MEM-020. O novo painel reaproveita cadastros, Estatísticas de público, Engajamento e Saúde existentes. A aba Inteligência operacional inclui jornadas, coortes e recorrência, qualidade consentida, rotinas, auditoria, simulação de capacidade, eficiência, recomendações determinísticas e resumo executivo CSV. O ícone de planejamento é informativo.

A migração 20261121190211 foi aplicada no Supabase de teste qnuluspqfazdppciermw. Uma tentativa anterior foi revertida por tentar auditar uma visão. A versão aplicada limita os gatilhos a tabelas físicas. O teste remoto com rollback confirmou coorte madura D30, amostragem e deduplicação, bloqueio de conta comum, revogação e auditoria. O staging tinha uma amostra técnica persistida, sem eventos reais de uso, qualidade ou IA. O catálogo pg_cron não estava disponível. Não foram ativadas rotinas ou integrações externas.

Build, checagem e prévia passaram. A suíte focada passou em 119 de 123 testes, com as quatro falhas preexistentes de configurações e push. Casos específicos validaram coortes imaturas, ausência de recomendações sem evidência, simulação, estados, controles de acesso e a consulta a um catálogo de cron simulado. O Advisor sinalizou tabelas internas sem política de cliente e o RPC autenticado com segurança do definidor. A conferência visual em aparelhos físicos continua pendente. Publicação exclusiva em staging/permanente.

## MEM-20261121-022

Em 21/11/2026, a auditoria de homologação corrigiu a montagem das configurações administrativas e duas falhas de privacidade push. O painel recebeu exportação de cadastros por cursor, resumo imprimível em PDF, dimensões de IA, referência oficial do plano Supabase Free, estados de execução programada e Web Vitals consentidos.

A migração `20261121192900` foi aplicada somente em `qnuluspqfazdppciermw`. Foram publicadas as Edge Functions push-dispatch v3 e ai-reply v5 com validação JWT. O SQL remoto com rollback verificou autorização, origem, exportação, observação e RLS automática. Nenhum agendamento foi ativado. Build, checagem, pacote portátil e 124 testes focados passaram. [Matriz e erros originais](AUDITORIA-FINAL-STAGING.md)

## MEM-20261121-023

Primeiro lote de campanhas desenvolvido a partir de `staging/permanente` em `desenvolvimento/campanhas-admin`. Integração com o painel, janela semanal, recibos, autorização administrativa e consentimento de push em tabelas próprias. A configuração do canal push permanece desligada. Duas migrações aditivas foram aplicadas no Supabase de staging. O teste remoto executou criação, ativação, recusa do participante, uma exibição, um clique e supressão de repetição, em transação revertida. A suíte geral reproduziu os mesmos 62 casos herdados. [Operação e limites](../conhecimento/CAMPANHAS.md)

Migrações remotas: `20261121195231` e `20261121195245`. O teste remoto de ACL confirmou que anônimos não executam a entrega, participantes não leem recibos diretamente e apenas o papel de serviço consome a fila. Os Advisors reportaram quatro tabelas privadas com RLS sem política de cliente, três RPCs autenticados com SECURITY DEFINER e dois índices ainda sem uso. Build, checagem, prévia portátil e 19 testes focados passaram. O navegador remoto devolveu `Browser Use could not read requirements`; os testes de interface autenticada e aparelhos continuam pendentes. A verificação de lançamento continua pendente, incluindo `cloudValidated` e a checagem móvel. A Vercel de homologação ainda exige uma branch aprovada (`staging/permanente` ou `staging`); a branch de desenvolvimento não gera um site de teste válido pela configuração atual.

## MEM-20261121-024

O editor de campanhas recebeu upload privado com URLs assinadas, seleção de Biblioteca e Loja, datas e horas no fuso local, vínculo de plano restrito a administradores e canal push independente. O catálogo, a Biblioteca e as regras de compra existentes continuam sendo os executores dos destinos selecionados. A fila foi testada de forma reversível, sem disparo real.

No Supabase de homologação, após aplicar a migração `20261121200721`, o teste com contas fictícias conferiu horário local, vínculo por plano, destino da Biblioteca, recusa de alteração por participante, pop-up e fila independente com deduplicação. O bucket privado limita uploads a 5 MB. Build, checagem, prévia portátil e testes focados passaram. A suíte completa executou 346 testes, com 284 aprovações e os mesmos 62 reprovados da linha de base. [Guia de campanhas](../conhecimento/CAMPANHAS.md)

## MEM-20261121-025

A aba Campanhas recebeu o manual estático original de 10 páginas, leitor administrativo com PDF.js, navegação, zoom, pinça e restauração de foco e rolagem, e os 26 textos de ajuda da especificação fornecida. A abertura do manual preserva o formulário e não inicia download. A prévia na raiz e em `/neo/` serviu o PDF original com HTTP 200 e `application/pdf`. PDF.js extraiu o texto das 10 páginas e renderizou as páginas 1, 5 e 10 em larguras de 320 e 800 px.

Build, checagem e os 22 testes focados passaram. A suíte completa teve 287 aprovações em 349 testes. Os 62 casos reprovados coincidem com a linha de base registrada no commit a216cc1.

## MEM-20261121-026

A Central de Campanhas recebeu áreas App e WhatsApp, canais independentes no cadastro comum, listagem progressiva ordenada por estado e uma ajuda flutuante compartilhada. O leitor PDF administrativo passou a exibir páginas contínuas em tela cheia, com renderização progressiva e zoom por pinça. O leitor da Biblioteca não foi alterado.

A migração `20261121231451` foi aplicada somente ao Supabase de teste. O ensaio transacional confirmou recusa da conta comum, cadastro administrativo, campanha exclusiva WhatsApp, divulgação atrasada, lembrete deduplicado, confirmação e próxima ocorrência. Todos os dados do ensaio foram revertidos. O Supabase Advisor sinalizou as quatro tabelas privadas sem política de cliente e o RPC autenticado com segurança do definidor. A fila opera por confirmação manual, sem envio automático ou push. [Guia da Central](../conhecimento/CAMPANHAS.md)

Build, checagem, prévia e 23 testes focados passaram. A suíte completa teve 288 aprovações em 350 testes e reproduziu exatamente os 62 casos herdados. A verificação remota pós-rollback confirmou ausência de grupos e publicações sintéticos, ausência de EXECUTE anônimo e de leitura direta por usuários autenticados.

## MEM-20261121-027

O NeoPep Connect recebeu cliente WinForms x64 com cofre DPAPI, instalador e workflow Windows, painel de autorização e diagnóstico, contas fictícias por grupo e coordenação simulada com lease e fencing. O processamento inicia pausado. O histórico de envio manual é independente.

A migração `20261121233733` foi aplicada no Supabase de staging. A transação com duas contas fictícias confirmou pausa, isolamento de grupo, escolha de reserva autorizada e conclusão simulada, mantendo a publicação manual pendente. O ensaio foi revertido. A versão 0.1.1 passou no runner Windows pela compilação, verificação de hash, instalação, atualização e remoção. O download do EXE pelo painel depende de upload e aprovação no bucket privado. [Guia de homologação](../conhecimento/NEOPEP-CONNECT.md)

Build, checagem, prévia e 22 testes focados passaram. A suíte com 351 casos teve 289 aprovações e as mesmas 62 falhas herdadas. O ensaio no runner cobre instalação silenciosa. A conferência gráfica, o primeiro login em um desktop Windows, a execução em dois dispositivos físicos e o download assinado do objeto real seguem pendentes.

## MEM-20261122-001

A migração corretiva `20261122003342` restringiu a atualização de pausa do NeoPep Connect à linha `singleton = true`. Apenas o corpo dessa operação mudou. A revisão confirmou filtros nas demais atualizações e chaves explícitas nos upserts.

O teste automatizado validou a cláusula e as duas transições. No Supabase de homologação, a mesma RPC acionada pelos botões foi testada como administrador autenticado em transação revertida. A fila foi comparada integralmente antes do rollback. Depois dele, o processamento permaneceu pausado, com um computador aprovado, uma sessão conectada, a conta fixture-principal, um vínculo de grupo, cinco registros de auditoria e uma única tarefa em fila, sem simulação.

## MEM-20261122-001

Integração seletiva do PR #10 a partir de `60016a9` para o painel de homologação. A aba **Atualizações** usa a RPC administrativa existente para listar versões e registrar rascunhos com auditoria. O build web, a verificação estática e os testes direcionados passaram. Um ensaio local com PGlite confirmou o registro como `draft`, a negativa para usuário comum e o registro do autor na auditoria. A validação autenticada no painel publicado segue pendente. O revert deste commit retira a interface e preserva os registros do banco.

## Issue #15 — Importação de manifesto e publicador do Connect Teste

PR #16 prepara a importação local do manifesto, a validação RSA/SHA-256 pela Edge com o instalador no bucket privado e o rascunho por sessão administrativa. O workflow privado, o assinador CNG local e a proposta SQL de exclusão mútua estão disponíveis para homologação. O Supabase Teste mostrava o objeto 0.2.5 com 50.102.784 bytes e sem cadastro. O fluxo real aguarda a chave pública, o manifesto sob custódia do proprietário e acesso ao repositório privado. [Guia](../conhecimento/NEOPEP-CONNECT-RELEASE-AUTOMACAO.md)
## MEM-20261121-004

Em 21/11/2026, o proprietário autorizou a publicação somente da identidade NeoPep. A branch publicacao/identidade-visual-neopep foi criada a partir da main d55b85c. O logotipo original e os derivados foram conferidos byte a byte contra staging 3565391. As alterações públicas cobrem marca, telas, estilos, manifesto, ícones e cache estático. O ID, a abertura e o escopo do PWA preservam os valores oficiais, assim como rotas, CSP, Supabase, pagamentos, autenticação, handlers e textos emitidos por notificações. Verificação estática e build passaram. A suíte focada teve 88/90 com as mesmas duas falhas de privacidade em push reproduzidas na main anterior.

Multiagentes, migrações, funções Edge e demais mudanças de homologação seguem na fila de preparacao/promocao-completa, sem promoção neste release. [Auditoria da promoção completa em preparação](../processos/PUBLICACAO-MULTIAGENTE.md)

## Issue #24 — candidata de paridade oficial

Integração do snapshot de homologação fa8429a na candidata baseada na main f123749, com PRs #22 e #23 fora do lote. A build preserva configuração oficial, compatibilidade PWA e os arquivos das integrações exclusivas da produção. O inventário, os scripts de leitura e o plano de recuperação registram os pontos pendentes do backend. [Paridade funcional](../revisao/PARIDADE-FUNCIONAL-20261122.md) · [Go/No-go](../revisao/GO-NOGO-PRODUCAO.md)
