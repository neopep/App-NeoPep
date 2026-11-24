# Protocolo vinculante — prioridades dinâmicas, aprovação do proprietário e publicação independente
**Versão 1.0 — 24/11/2026** · Aplicável aos ajustes #001–#013 e à governança #014.

## 1. Princípio de comando
O proprietário determina **qual ID/subetapa será feito agora**, independentemente da sequência sugerida no Plano Mestre. A ordem sugerida é apenas um backlog inicial. Uma mudança de prioridade **não cancela, apaga, conclui ou publica** outra tarefa. Não impor a ordem original quando ele chamar nominalmente uma tarefa. Não executar automaticamente a próxima etapa sem a solicitação do proprietário.

## 2. Separação obrigatória de estado
Cada tarefa e subetapa registra **três trilhas independentes**:
1. **Desenvolvimento**: NÃO_INICIADO → EM_ANALISE → EM_DESENVOLVIMENTO → EM_TESTE → TECNICAMENTE_PRONTO; ou BLOQUEADO. TECNICAMENTE_PRONTO exige código implementado e evidência de QA, não aprovação final.
2. **Aceite do proprietário**: NAO_SOLICITADO → AGUARDANDO_ACEITE → APROVADO_PELO_PROPRIETARIO; ou AJUSTES_SOLICITADOS. **Só o proprietário aprova funcionalmente**, por mensagem ou ação expressa. «O Codex concluiu» não conta como aprovação.
3. **Publicação**: NAO_PREPARADO → AGUARDANDO_DECISAO → SELECIONADO_PARA_RELEASE → EM_PREPARACAO → PUBLICADO_TESTE → PRONTO_PRODUCAO → PUBLICADO_PRODUCAO → VALIDADO_PRODUCAO; ou IMPEDIDO/REVERTIDO. Teste pode ocorrer antes do aceite, mas não equivale a publicação em Produção. PRONTO_PRODUCAO não autoriza deploy.
O registro deve exibir os três estados lado a lado. Marcar **Concluído pelo usuário** apenas na segunda trilha; manter **Aguardando publicação** até a trilha de release terminar. Uma entrega pode ter aceite total e publicação parcial quando algumas subetapas são independentes; detalhar exatamente o escopo.
A marca «100% concluído» da tarefa completa exige aceite explícito e fechamento de todas as subetapas obrigatórias; «100% publicado» exige validação operacional em Produção das subetapas destinadas a Produção.

## 3. Comandos que o usuário poderá dar
- «Quero fazer o #009 agora»: definir #009 como FOCO_ATUAL; suspender prioridade anterior sem perder estado; identificar subetapa seguinte do #009 e suas dependências.
- «Coloque #013 antes do #003»: reordenar QUADRO-DE-PRIORIDADES.md, com evento no histórico, sem alterar IDs.
- «O #007 está pronto / aprovado»: registrar aceite, data, mensagem de confirmação e escopo exato; deixar na fila de publicação até nova decisão. Não inferir que isso autorize merge em main.
- «Publique o #007»: incluir somente o delta já aprovado e suas dependências mínimas em release isolado. Executar a promoção apenas após verificações e autorizações de ambiente previstas; não promover outras alterações por acidente.
- «Guarde #007 e #009 para publicar junto»: marcar ambos como AGUARDANDO_PUBLICACAO / release agrupado a ser montado; não executar release até solicitação de publicação.
- «Publique tudo que eu já aprovei»: criar composição de release com todos os itens aprovados ainda pendentes, apresentar/executar somente conforme autorização e gates obrigatórios.
- «Volte ao #013.04»: retomar exatamente sua última evidência/branch/PR, sem refazer tarefas comprovadamente concluídas nem substituir versões aprovadas.
- «Corrija o #007 já publicado»: abrir subetapa corretiva nova (ex. 007.04-fix1), não apagar o evento de publicação anterior.
Expressões vagas («pronto» referindo-se a uma prévia ou screenshot) devem ser interpretadas no contexto do ID sendo trabalhado; quando não há escopo identificável, registrar como feedback e não como aprovação de todos os módulos.

## 4. Fluxo de cada pedido de implementação
A. Ler AGENTS.md, README desta pasta, QUADRO-DE-PRIORIDADES.md, CONTROLE-DE-EXECUCAO.md e especificação do ID. Confirmar qual versão do código o proprietário quer evoluir.
B. Registrar seleção de FOCO_ATUAL e seu motivo no quadro; registrar estado de entrada e baseline direcionado (SHA/arquivos/contratos tocados).
C. Inspecionar **somente componentes afetados**, diferenças Git necessárias, dependências de banco/Edge e testes de não regressão relevantes. Não abrir uma auditoria integral do passado a cada pedido. Se houver risco sistêmico, ampliar **apenas o necessário e justificar**.
D. Implementar delta mínimo reaproveitando componentes existentes. Alterar contrato antigo somente se tecnicamente necessário, após identificar comportamento protegido, compatibilidade e regressão dirigida.
E. Registrar testes, versão/ambiente de Teste, PR e commit. Se tudo passou, desenvolvimento TECNICAMENTE_PRONTO; solicitar/aguardar a decisão do proprietário.
F. Após «está pronto», marcar aceite APROVADO_PELO_PROPRIETARIO, mas publicação AGUARDANDO_DECISAO. Atualizar documentação no mesmo trabalho.
G. Ao ser solicitada a próxima etapa, consultar o quadro e selecionar a próxima nomeada pelo proprietário; se ele não especificar qual, usar o primeiro item elegível da ordem dinâmica, respeitando dependências.

## 5. Regra da autonomia de publicação
**Opção A — individual:** um módulo/parte aprovada é promovido sozinho se isolável. Selecionar apenas commits/SQLs/artefatos dessa entrega e dependências imprescindíveis; nunca mesclar toda a branch de Teste por conveniência. Produção atual pode divergir; usar merge/rebase/cherry-pick supervisionado sobre a base correta, comparar efeitos e validar. Se não isolável, explicar bloqueio e o menor conjunto de dependências, sem publicar partes escondidas.
**Opção B — conjunta:** criar release train com um conjunto escolhido de IDs aprovados, testados em conjunto, com manifesto e ordem de migrações/deploy. Uma falha bloqueia apenas o release afetado, não apaga aprovações anteriores.
**Opção C — aguardar:** item aprovado permanece na fila de publicação, sem data presumida. Pode-se iniciar outro ajuste imediatamente.
**Opção D — correção pós-publicação:** criar hotfix isolado com referência ao release publicado, novo commit e testes; reverter preservando dados e contratos, não apagar histórico.
A aprovação funcional **não substitui** autorização para alterar Produção, migração de dados de alto risco, custos externos, cobranças reais ou disparos WhatsApp. Se o usuário disser expressamente «publique o #007 em Produção», essa é a solicitação de publicação para esse escopo, mas ainda é preciso cumprir os pré-requisitos técnicos e de segurança. Não pedir autorizações redundantes quando já estão explícitas; se gate falhar, bloquear e informar.

## 6. Marco de referência e compatibilidade
- **Marco Zero** em MARCO-ZERO-2026-11-24.md, com SHA e IDs de deploy separados para Teste e Produção.
- Antes de cada mudança, registrar **PONTO_DE_ENTRADA**: commit/base real, branch, subetapa, lista de arquivos, contratos externos, migrações, comportamento preexistente diretamente tocado e testes de baseline dirigidos.
- Após concluir a mudança, registrar **PONTO_DE_SAIDA**: commit do delta, diferenças, testes, QA, novas migrations, contratos preservados e pendências.
- Ao publicar, registrar **NOVO_MARCO_DE_RELEASE** para o ambiente, sem substituir o Marco Zero histórico. O próximo pedido usa o release realmente ativo como base para aquele ambiente.
- A verificação de um novo ajuste foca o **delta novo** e os componentes antigos que o delta possa afetar; não exige rever todo o legado que já foi aceito. Testes mínimos de login, sessão, banco, RLS e plataforma ainda são obrigatórios quando impactados. Não assumir que módulo antigo permanece intacto sem conferir as interfaces afetadas.
- Se houver um bug antigo fora do escopo, documentá-lo separadamente como dívida técnica; não «corrigir junto» e criar regressão inadvertida, salvo risco crítico e autorização.

## 7. Controle de decisões e histórico append-only
Cada troca de prioridade ou aceite cria evento datado com: ator, comando do proprietário, IDs/sub-IDs afetados, estado anterior, estado novo, razão, link do chat/PR quando disponível, dependências e próxima ação. Não reescrever decisões anteriores para fazer parecer que sempre houve aquela ordem.
O snapshot atual é mantido em QUADRO-DE-PRIORIDADES.md, mas o histórico de alterações fica no final do mesmo arquivo. CONTROLE-DE-EXECUCAO.md registra os fatos de engenharia e provas. REGISTRO-DE-PUBLICACOES.md guarda releases e rollbacks.

## 8. Política de documentação e handoff
O agente que **efetivamente realizar** a etapa deve atualizar em seu PR: prioridade se mudada, subetapa de desenvolvimento, status de aceite, estado de publicação, base/saída, testes, evidências e próxima ação. Cada atualização deve ser commitada e auditável. Um outro Codex lê o último estado no GitHub, não o resumo da conversa como única fonte.
A documentação não se atualiza por conta própria entre sessões. Não afirmar monitoramento ou sincronização automática enquanto não existir serviço implementado. Reduzir builds Vercel desnecessários agrupando edições documentais, sem desativar CI sem análise.
