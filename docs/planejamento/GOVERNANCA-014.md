# #014 — Governança, preservação e continuidade entre agentes
Versão 2.0 | 24/11/2026 | Regra transversal obrigatória. Não é o 14º recurso de usuário final: é o mecanismo de execução dos 13 pacotes funcionais.

## 1. Objetivo
Permitir que o proprietário use qualquer conversa, Codex ou agente GitHub para retomar de onde a última subetapa parou, sem refazer, esquecer ou desfazer aprovações. É obrigatório documentar no GitHub à medida que cada tarefa for realmente executada. Esta documentação não funciona como monitor autônomo: o agente que executar uma nova etapa deverá efetuar a atualização no mesmo trabalho, com commit e PR correspondente.

## 2. Fonte única da verdade
A fonte documental deste ciclo é a PR #40, branch docs/plano-mestre-ajustes-2026-11-24. Os documentos de referência são:
- PLANO-MESTRE-NEOPEP-2026-11-24.md: requisitos e decisões imutáveis aprovadas pelo proprietário.
- ESPECIFICACAO-MELHORIAS-001-009.md: UX e testes.
- ESPECIFICACAO-LOJA-010-011.md: estoque, custos e edição em massa.
- ESPECIFICACAO-ASSINATURAS-012.md: planos e billing.
- ESPECIFICACAO-CAMPANHAS-013.md: novo editor e integração.
- LEVANTAMENTO-TECNICO-2026-11-24.md: o que existe, evidence/source e lacunas.
- CONTROLE-DE-EXECUCAO.md: último estado e próximas ações, incluindo microetapas.
- INICIO-PARA-AGENTES.md: protocolo de retomada.
- AUDITORIA-REVISAO-2026-11-24.md: revisão de qualidade e correções.
- README.md: índice navegável.
Instruções preexistentes AGENTS.md e docs/conhecimento/CONTEXTO-MESTRE.md prevalecem para segurança e execução técnica; o Plano Mestre adiciona o escopo aprovado, sem revogar regras anteriores.

## 3. Regra de classificação da evidência
A informação precisa carregar fonte, data, commit, branch e ambiente, usando classes:
- APROVADO PELO USUÁRIO: decisão funcional desta conversa, não atesta que exista em código.
- VERIFICADO EM CÓDIGO: arquivo/linha de um SHA específico, não atesta deploy.
- VERIFICADO NO BANCO: metadados de schema ou resultado SQL somente leitura do projeto identificado; não atesta fluxos funcionais.
- VERIFICADO EM DEPLOY: URL/commit/estado de Vercel; não atesta comportamento de sessão/usuário.
- VALIDADO POR TESTES: evidência de comando, cenário, resultado e base.
- VALIDADO MANUALMENTE: ambiente, conta de teste, data, passo e evidência.
- RELATO DO RESPONSÁVEL: experiência de operação que merece preservação, mas não é inspeção técnica.
- HISTÓRICO: documento de data passada; não substituir por «atual» sem reconferir.
- PROPOSTO: arquitetura/nomes/status sugeridos, sujeitos a confirmação.
- DESCONHECIDO: não presumir; criar tarefa de descoberta.

## 4. Baseline observado em 24/11/2026 (somente leitura)
### GitHub
Repo neopep/App-NeoPep; main consultada em fc0ae22faf75b108aad137b1399fc8b367af1292; PR #25 merged em main; PR #36 merged em staging/permanente; PR #35 open/draft; PR #37 open/draft; PR #40 open/draft documental. PR #37 descreve divergência histórica de 204 commits à frente/93 atrás entre staging e main à época — reconfirmar antes de qualquer merge. 
### Vercel
Dois projetos: app-neopep (Produção) e app-neopep-staging (Teste). A listagem de deployments com target production em **cada projeto** retornou:
- Projeto Produção, READY, main, SHA fc0ae22faf75b108aad137b1399fc8b367af1292, criado em 2026-11-24 09:37 UTC;
- Projeto Teste, READY, staging/permanente, SHA 0970ae6b7c7d846915f98f4582780382c71a80e9, criado em 2026-11-24 01:15 UTC.
A listagem NÃO prova que o domínio personalizado esteja apontando ao deploy, nem que Auth/Edge/Webhook, fila ou Windows estejam homologados. Confirmar aliases e operação funcional antes de avançar.
### Supabase
Projetos neopep-staging qnuluspqfazdppciermw e neopep cpslafpzjtbpmoxxysaa responderam ACTIVE_HEALTHY na consulta de projetos. Ledger listado por conector em 24/11: 22 registros de migração em Teste, 15 em Produção; nomes/IDs **não equivalentes** entre ambientes, nunca comparar apenas contagem. Produção tem migração recente shop_store_admin_visibility_production_20261124 (20261124112356); Teste tem shop_order_idempotent_retry (20261124011242) sem prova de equivalência em Produção.
Consulta information_schema confirmou tabelas neo_private.shop_products (price_cents, stock) e tabelas de campanhas, grupos e Connect em ambos. Não foi feita leitura de valores pessoais, pagamentos, mensagens nem segredos.
### Connect e WhatsApp
Código e docs versionados, mas o aplicativo Windows instalado, sessão do WhatsApp, permissões reais, ACK e grupos disponíveis não foram inspecionados. A funcionalidade futura é diferente do envio manual/lembrete registrado na versão 0.2.6.
### Aviso de Vercel
Commits da branch de documentação dispararam *preview builds* em app-neopep e app-neopep-staging, vários cancelados e ao menos um READY. Não há evidência de que tenham sido atribuídos a domínios de Produção, mas podem consumir recursos do Vercel. **Mitigação a aprovar e implementar posteriormente:** agrupar atualizações em um commit por revisão/lote, verificar Ignored Build Step ou configuração de filtro apenas-documentação por projeto, checar efeitos em Teste, confirmar proteção da main e não alterar config de deploy nesta revisão.

## 5. Definição de não regressão
Antes da tarefa, registrar baseline:
- Comportamento existente aprovado, inclusive mudanças recentes fora da main.
- Arquivos-fonte, gerados e migrações conectados; callbacks/eventos públicos, API/RPC, storage, autenticação e permissões.
- SHA e ambiente Teste/Produção; diferença entre fontes instaladas e presentes no Git.
- Testes já existentes com falhas baseline separadas das novas falhas.
- Tráfego/infra dependente, custos, limites de provedores e comportamento offline.
Não remover produtos, grupos, pedidos, arquivos, sessões, assinaturas, campanhas, dados privados ou registros legados por conveniência. Não migrar dados Teste para Produção; não copiar configs/segredos. Mudança de contrato exige compatibilidade ou adaptador com testes e rollback.

## 6. Regras operacionais para cada execução
Fase A — Descobrir: confirmar HEAD, PRs abertos, documentação mais recente, o estado de Teste/Produção e requisitos de aceitação. Registrar o que já existe, o que é delta novo e dependências.
Fase B — Planejar delta: modificar apenas o módulo pretendido; escolher flags/versão de contrato, migração aditiva, estratégia de fallback, testes e como proteger partes existentes.
Fase C — Implementar: branch pequena por subetapa com autoria correta; não forçar merge no checkout alheio; não sobrescrever conflitos sem revisão do proprietário.
Fase D — Validar: check/build/testes novos e baseline, PGlite/SQL/RLS se necessário, QA mobile, proteção de contas, evidência de comportamento de Teste.
Fase E — Documentar: atualizar CONTROLE-DE-EXECUCAO.md, a especificação e o relatório do módulo, links PR/commit, status distinto em Teste e Produção, falhas e próximo passo.
Fase F — Aprovar e liberar: aplicar gate de release, rollback/testes e autorização específica para main/Produção/serviços externos e custos. Monitorar pós-release e registrar validação.
Não usar a aprovação de um ajuste para autorizar pagamentos, WhatsApp real, migração irreversível ou mudança de credenciais de outro módulo.

## 7. Regra de atualização do tracker
Cada subetapa precisa:
- Identificador fixo (ex.: 013.07); título e escopo.
- Estado planejado, em auditoria, desenvolvimento, teste, aprovado em Teste, pronto para Produção, publicado, validado em Produção, bloqueado.
- Base SHA, branch e PR, CI/testes, banco/migração/Edge se houver.
- «O que foi preservado» e «o que foi alterado».
- Resultado do dispositivo/ambiente; screenshots ou logs redigidos.
- Erros conhecidos, bloqueios e próxima ação concreta.
- Autor, momento e decisão do proprietário quando necessária.
Não apagar registro de etapas anteriores; adicionar eventos incrementais. Não marcar «Publicada» uma funcionalidade só porque a PR foi merged ou o deploy READY.

## 8. Tarefas de governança antes de desenvolvimento
014.01 baseline remoto por ambiente e comparação das branches; 014.02 inventário de banco e componentes relevantes; 014.03 mapeamento de contrato e risco por módulo; 014.04 matriz de regressão; 014.05 regra de documentação/handoff; 014.06 revisão do release gate PR #37; 014.07 política de preview builds para docs; 014.08 auditoria final de preservação.
A reconciliação PR #37 é uma pré-condição importante de publicação geral, mas não significa que a PR #40 de documentação dependa de merge automático da PR #37. Não declarar #014 concluído até existir evidência funcional e decisão de release.

## 9. Definition of Done do ciclo
Todos os IDs #001–#013 e suas subetapas marcados validados com evidências, #014 encerrado com release e preservação, ausência de bloqueios críticos desconhecidos, cadastros/dados históricos mantidos, Teste/Produção rastreáveis, feedback do proprietário e documentação navegável na main aprovada. O menu «Planejamento / Evolução» dentro do painel é proposta futura separada: não afirmar que exista por os arquivos estarem no GitHub.

## 10. Autonomia de prioridades e publicação (decisão de 24/11/2026)
A lista de fases acima é uma sugestão, **não uma trava de ordem**. O proprietário pode selecionar qualquer item a qualquer momento. Aplicar [protocolo de prioridades, aceite e publicação](PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO.md): estados separados para desenvolvimento, aceite do proprietário e publicação; publicação isolada ou conjunta somente por escolha expressa; aprovação não implica deploy automático. O [Quadro de Prioridades](QUADRO-DE-PRIORIDADES.md) acompanha o foco ativo e a fila; [Registro de Publicações](REGISTRO-DE-PUBLICACOES.md) mantém cada release; [Marco Zero](MARCO-ZERO-2026-11-24.md) delimita a referência inicial.

**Revisão por diferença:** não refazer auditoria ampla das funcionalidades anteriores já aprovadas; conferir os arquivos, contratos e testes **que a alteração nova efetivamente toca**. Em lançamento, continuar respeitando gates de segurança, isolamento de banco, login/pagamentos quando impactados e compatibilidade de Produção. Marcar o que foi validado e o que não foi; não inferir que todo o legado esteja homologado porque a alteração nova passou.

## 11. Limites desta revisão
A presente operação só documenta e verifica metadados em leitura. Não compila o app Windows, não abre sessão WhatsApp, não faz transações Mercado Pago, não implementa recursos nem executa migrations/deploys. A PR documental continua rascunho até aprovação, e a main não será alterada automaticamente.
