# Quadro vivo de prioridades e aceites — NeoPep
**Versão inicial:** 24/11/2026. **A ordem é editável por comando do proprietário.** IDs não são prioridades e não devem ser renumerados.
**FOCO_ATUAL:** nenhum ajuste funcional selecionado após esta revisão documental.
**ÚLTIMA_DECISÃO:** registrar regras de escolha livre, aceite pelo proprietário e publicação individual/conjunta. Nenhum aceite funcional novo foi concedido nesta mensagem.
**PR de referência:** #40, branch documental `docs/plano-mestre-ajustes-2026-11-24`.

## 1. Backlog inicial sugerido (não vinculante)
A qualquer momento, o proprietário pode solicitar qualquer ID e ele passa à prioridade 1, sem excluir os demais.

| Prioridade sugerida | ID | Trabalho | Desenvolvimento do ciclo | Aceite proprietário | Publicação | Próximo sub-ID |
|---|---|---|---|---|---|---|
| Pré-requisito dirigido | #014 | Preservação, baseline e controle incremental | AUDITANDO | Não solicitado | Não aplicável diretamente | 014.01, conforme impacto |
| 1 | #007 | Loja: texto e atendimento | NÃO_INICIADO | Não solicitado | Não preparado | 007.01 |
| 2 | #006 | Prévia de PDF na Home/Biblioteca | NÃO_INICIADO | Não solicitado | Não preparado | 006.01 |
| 3 | #005 | Modal de comparações no Grupo | NÃO_INICIADO | Não solicitado | Não preparado | 005.01 |
| 4 | #001 | Localização opcional no onboarding | NÃO_INICIADO | Não solicitado | Não preparado | 001.01 |
| 5 | #002 | Personalização/consentimento | NÃO_INICIADO | Não solicitado | Não preparado | 002.01 |
| 6 | #008 | Fixar posts da Biblioteca | NÃO_INICIADO | Não solicitado | Não preparado | 008.01 |
| 7 | #009 | Seringa no card da Home | NÃO_INICIADO | Não solicitado | Não preparado | 009.01 |
| 8 | #003 | Tema claro/escuro | NÃO_INICIADO | Não solicitado | Não preparado | 003.01 |
| 9 | #010 | Estoque, custos e lucro | NÃO_INICIADO | Não solicitado | Não preparado | 010.01 |
| 10 | #011 | Edição em massa | NÃO_INICIADO | Não solicitado | Não preparado | 011.01 |
| 11 | #013 | Campanhas e Connect | NÃO_INICIADO | Não solicitado | Não preparado | 013.01 |
| 12 | #012 | Planos/assinaturas | NÃO_INICIADO | Não solicitado | Não preparado | 012.01 |
| 13 | #004 | Minha alimentação | NÃO_INICIADO | Não solicitado | Não preparado | 004.01 |

**Importante:** «não iniciado» significa que **as novas mudanças deste ciclo** não foram iniciadas. Não significa que nenhuma parte semelhante já existe no aplicativo. Consultar o levantamento técnico.

## 2. Regras para a fila de conclusão e publicação
- Quando técnico conclui: EM_TESTE ou TECNICAMENTE_PRONTO, com evidência, sem marcar aprovação do proprietário.
- Quando o proprietário disser «está pronto» para ID/sub-ID específico: atualizar Aceite proprietário = APROVADO_PELO_PROPRIETARIO; Publicação = AGUARDANDO_DECISAO; tirar do foco se ele escolher outro ajuste.
- Quando quiser publicar agora: escolher release individual `REL-...` e mudar para SELECIONADO_PARA_RELEASE. Publicar apenas após gates, depois marcar PUBLICADO_PRODUCAO e VALIDADO_PRODUCAO com SHA/evidência.
- Quando quiser juntar: registrar IDs aprovados na fila de release conjunto, sem publicar automaticamente.
- Quando mudar ordem: somente reordenar coluna Prioridade sugerida ou definir FOCO_ATUAL, mantendo IDs, estados, PRs e aceite.
- Dependência bloqueante não muda a prioridade solicitada, só o estado de execução; sugerir o menor pré-requisito possível.

## 3. Histórico de decisões (append-only)
| Data | Ator | Pedido ou decisão | IDs afetados | Efeito | Documento/PR |
|---|---|---|---|---|---|
| 2026-11-24 | Proprietário | Ajustes podem ser executados em ordem livre; marcar concluído somente após sua aprovação; permitir publicação individual ou conjunta; proteger o que existia | #001–#014 | Criado protocolo de prioridades/aceite/release; sem alteração funcional | PR #40 |

## 4. Fila de aprovados aguardando publicação
**Nenhum item deste ciclo aprovado ainda.** Inserir aqui um registro por ID/sub-ID: ID, versão/commit, aceite, data, opções individual/conjunto, dependências e release vinculado.
