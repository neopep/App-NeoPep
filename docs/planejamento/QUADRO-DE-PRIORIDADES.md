# Quadro vivo de prioridades e aceites — NeoPep
**Versão inicial:** 24/11/2026. **A ordem é editável por comando do proprietário.** IDs não são prioridades e não devem ser renumerados.
**FOCO_ATUAL:** #009 — Seringa da calculadora na Home; código implementado em branch independente e PR #43 draft; homologação autenticada e aceite pendentes.
**ÚLTIMA_DECISÃO:** Codex reportou implementação #009 e 64 testes direcionados; conferida comparação com staging/permanente (1 commit à frente, 0 atrás, 8 arquivos). PR #43 criada em rascunho; nenhum aceite ou deploy realizado.
**PR de referência:** #40, branch documental `docs/plano-mestre-ajustes-2026-11-24`.

## 1. Backlog inicial sugerido (não vinculante)
A qualquer momento, o proprietário pode solicitar qualquer ID e ele passa à prioridade 1, sem excluir os demais.

| Prioridade sugerida | ID | Trabalho | Desenvolvimento do ciclo | Aceite proprietário | Publicação | Próximo sub-ID |
|---|---|---|---|---|---|---|
| Pré-requisito dirigido | #014 | Preservação, baseline e controle incremental | AUDITANDO | Não solicitado | Não aplicável diretamente | 014.01, conforme impacto |
| 2 | #007 | Loja: texto e atendimento | NÃO_INICIADO | Não solicitado | Não preparado | 007.01 |
| Em espera | #006 | Prévia de PDF na Home/Biblioteca | EM_TESTE (local concluído; Teste real pendente) | AGUARDANDO_ACEITE (não solicitado formalmente) | NAO_PREPARADO (sem deploy) | 006.03 |
| 3 | #005 | Modal de comparações no Grupo | NÃO_INICIADO | Não solicitado | Não preparado | 005.01 |
| 4 | #001 | Localização opcional no onboarding | NÃO_INICIADO | Não solicitado | Não preparado | 001.01 |
| 5 | #002 | Personalização/consentimento | NÃO_INICIADO | Não solicitado | Não preparado | 002.01 |
| Em espera | #008 | Fixar posts da Biblioteca | EM_TESTE (local; SQL não aplicado em Teste) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 008.03 |
| 1 (foco atual) | #009 | Seringa no card da Home | EM_TESTE (local; homologação real pendente) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 009.03 |
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
| 2026-11-24 | Proprietário | «Vamos fazer o zero zero meia. Primeiro» | #006 / 006.01 | Definido como FOCO_ATUAL e prioridade operacional 1; aguarda início pelo Codex, sem aceite ou deploy | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | Implementação #006 na branch desenvolvimento/ajuste-006-miniatura-pdf, commit 0087a15; 9 arquivos, um commit à frente de staging/permanente | #006 / 006.01–006.03 | 006.01/006.02 implementados; 006.03 em homologação, testes reais pendentes; aceite e publicação não realizados | [Registro do Codex](https://github.com/neopep/App-NeoPep/blob/desenvolvimento/ajuste-006-miniatura-pdf/docs/planejamento/EXEC-2026-11-24-006.md) |

| 2026-11-24 | Proprietário | «Vamos pra 008» | #008 / 008.01 | #008 passa a FOCO_ATUAL, sem execução/aceite/publicação; #006 permanece em homologação pendente | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #008 implementado no commit d76ae73; PR #42 draft criada para staging/permanente | #008 / 008.01–008.03 | Implementado localmente; migração e testes reais pendentes; sem aceite e publicação | [PR #42](https://github.com/neopep/App-NeoPep/pull/42) |

| 2026-11-24 | Proprietário | «o 009» | #009 / 009.01 | #009 torna-se foco atual; #006 e #008 mantidos em homologação pendente, sem aprovação nem deploy | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #009 implementado, PR #43 draft criada | #009 / 009.01–009.03 | 64 testes reportados; homologação com sessão real e dispositivos pendente; sem aceite/publicação | [PR #43](https://github.com/neopep/App-NeoPep/pull/43) |

## 4. Fila de aprovados aguardando publicação
**Nenhum item deste ciclo aprovado ainda.** Inserir aqui um registro por ID/sub-ID: ID, versão/commit, aceite, data, opções individual/conjunto, dependências e release vinculado.
