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
