# Quadro vivo de prioridades e aceites — NeoPep
**Versão inicial:** 24/11/2026. **A ordem é editável por comando do proprietário.** IDs não são prioridades e não devem ser renumerados.
**FOCO_ATUAL:** #013 — Connect 0.2.10 conectado e grupos sincronizados em Teste (1) e Produção (2), heartbeats e sessão confirmados em 24/11 às 17:44 BRT. Infra de despacho em Teste ainda bloqueada; PRs #56/#57/#58/#59 sem deploy web; próxima homologação: publicar versão consolidada em Vercel Teste só com autorização específica, testar UI e depois envio controlado com autorização.
**ÚLTIMA_DECISÃO:** solicitado «Verifique». Auditoria read-only confirma sessão/grupos sincronizados em ambos os Supabase na versão 0.2.10. Teste com 1 grupo sync 20:44:17Z; Produção 2 grupos sync 20:43:53Z. Flags whatsapp_enabled/app_enabled OFF, connect_config.paused true, 0 lotes e 0 auditorias; presença worker 0. Vercel Teste latest READY sha 43e31df, anterior à #013; nenhum deploy efetuado.
**PR de referência:** #40, branch documental `docs/plano-mestre-ajustes-2026-11-24`.

## 1. Backlog inicial sugerido (não vinculante)
A qualquer momento, o proprietário pode solicitar qualquer ID e ele passa à prioridade 1, sem excluir os demais.

| Prioridade sugerida | ID | Trabalho | Desenvolvimento do ciclo | Aceite proprietário | Publicação | Próximo sub-ID |
|---|---|---|---|---|---|---|
| Pré-requisito dirigido | #014 | Preservação, baseline e controle incremental | AUDITANDO | Não solicitado | Não aplicável diretamente | 014.01, conforme impacto |
| Em espera | #007 | Loja: texto e atendimento | NÃO_INICIADO | Não solicitado | Não preparado | 007.01 |
| Em espera | #006 | Prévia de PDF na Home/Biblioteca | EM_TESTE (local concluído; Teste real pendente) | AGUARDANDO_ACEITE (não solicitado formalmente) | NAO_PREPARADO (sem deploy) | 006.03 |
| Em espera | #005 | Modal de comparações no Grupo | EM_TESTE (local; homologação real pendente) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 005.05 |
| Em espera | #001 | Localização opcional no onboarding | EM_TESTE (local; homologação real pendente) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 001.03 |
| Em espera | #002 | Personalização/consentimento | NÃO_INICIADO | Não solicitado | Não preparado | 002.01 |
| Em espera | #008 | Fixar posts da Biblioteca | EM_TESTE (local; SQL não aplicado em Teste) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 008.03 |
| Em espera | #009 | Seringa no card da Home | EM_TESTE (local; homologação real pendente) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 009.03 |
| Em espera | #003 | Tema claro/escuro | EM_TESTE (local; homologação real pendente) | AGUARDANDO_ACEITE (não concedido) | NAO_PREPARADO (sem deploy) | 003.05 |
| 1 (foco atual) | #010 | Estoque, custos e lucro | 010.04+010.05 ACEITAS; 010.06 CANDIDATA LOCAL / PR #54 DRAFT | 010.04 e 010.05 aprovadas; 010.06 pendente | Somente Teste da integração anterior; 010.06 não publicada | Reembolso legado mantido por decisão do proprietário; autorizar migração 010.06 somente Teste e QA |
| 1 (foco atual) | #011 | Edição em massa | VALIDADO LOCALMENTE | Pendente | Não publicada | 011.05 QA em Teste após autorização |
| 1 (foco atual) | #013 | Central de Campanhas | Editor, agenda e despacho de texto validados localmente | Pendente | Não publicada | Compilar e homologar no Windows com sessão controlada, revisar transporte de anexos e manter gates desligados |
| 12 | #012 | Planos/assinaturas | NÃO_INICIADO | Não solicitado | Não preparado | 012.01 |
| Em espera | #004 | Minha alimentação | NÃO_INICIADO | Não solicitado | Não preparado | 004.01 |

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

| 2026-11-24 | Proprietário | «003» | #003 / 003.01 | #003 definido como foco atual; #006, #008 e #009 mantidos em homologação pendente, sem aceite/deploy | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | Implementação #003 no commit 00ef2d4; PR #44 draft criada | #003 / 003.01–003.05 | Testes e comparação visual reportados; QA real, aceite e publicação pendentes | [PR #44](https://github.com/neopep/App-NeoPep/pull/44) |

| 2026-11-24 | Proprietário | «001» | #001 / 001.01 | Novo foco, sem execução ou autorização de deploy; PRs #41–#44 seguem pendentes | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #001 implementado em cf3483f; PR #45 draft criada | #001 / 001.01–001.03 | 76 testes reportados; Teste real/Safari/PWA pendentes; sem aceite/publicação | [PR #45](https://github.com/neopep/App-NeoPep/pull/45) |

| 2026-11-24 | Proprietário | «002» | #002 / 002.01 | Novo foco, sem execução/aceite/deploy; #001 e demais PRs permanecem isoladas | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #002 implementado em bd0c64d; PR #46 draft criada | #002 / 002.01–002.03 | 75 testes reportados; migração e QA reais pendentes; sem aceite/publicação | [PR #46](https://github.com/neopep/App-NeoPep/pull/46) |

| 2026-11-24 | Proprietário | «005» | #005 / 005.01 | Novo foco, sem execução/aceite/deploy; PRs #41–#46 seguem isoladas | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #005 implementado em 3483731; PR #47 draft criada | #005 / 005.01–005.05 | 67 testes reportados; permissões/URLs reais e QA físico pendentes; sem aceite/publicação | [PR #47](https://github.com/neopep/App-NeoPep/pull/47) |

| 2026-11-24 | Proprietário | «004» | #004 / 004.01 | Novo foco: Minha alimentação, iniciar diagnóstico/arquitetura antes de migrações; sem aceite/deploy; PRs #41–#47 preservadas | PR #40 |

| 2026-11-24 | Proprietário | Correção: «Desculpe é o 007» | #007 / 007.01 | Substitui a seleção #004 antes de execução confirmada; #004 permanece no backlog. Sem aceite/deploy | PR #40 |

| 2026-11-24 | Codex / conferência GitHub | #007 implementado em facee60; PR #48 draft criada | #007 / 007.01–007.03 | 26 testes reportados; atendimento autenticado e conciliação documental pendentes; sem aceite/publicação | [PR #48](https://github.com/neopep/App-NeoPep/pull/48) |

| 2026-11-24 | Proprietário | «010» | #010 / 010.1 | Iniciar diagnóstico documental; não alterar pagamentos, migrações ou Produção; PRs #41–#48 preservadas | [Especificação Loja](ESPECIFICACAO-LOJA-010-011.md) |

| 2026-11-24 | Proprietário / verificação Supabase | «Pode avançar sem backup» — execução 010.03-B somente no Teste | #010 / 010.03-B | Migração `shop_cost_foundation` aplicada em Teste (ledger `20261124164148`), objetos e ACL conferidos; QA/aceite/Produção pendentes; risco de não haver backup registrado | [PR #50](https://github.com/neopep/App-NeoPep/pull/50) |

| 2026-11-24 | Proprietário / consulta Supabase | «Vamos avançar» — sequência do #010 | #010 / 010.03-B e 010.04 | ACL, objetos e ledger novamente conferidos em Teste; planejada 010.04 sem novas migrações/deploy. QA real e aceite pendentes | [Plano 010.04](PLANO-IMPLEMENTACAO-010-04.md) |

| 2026-11-24 | Codex / verificação GitHub | 010.04 implementada em 1e3292e e PR #51 draft aberta | #010 / 010.04 | UI/contrato criados; 33 testes reportados; API administrativa ainda não aplicada no Teste. Sem aceite/publicação | [PR #51](https://github.com/neopep/App-NeoPep/pull/51) |

| 2026-11-24 | Proprietário / revisão de segurança | «Vamos seguir» — verificar contrato #010.04 | #010 / 010.04 | Achado de autorização financeira excessiva; commit 14a335d restringiu para admin_members e criou teste de moderador. Reteste e SQL em Teste pendentes; sem deploy/aceite | [PR #51](https://github.com/neopep/App-NeoPep/pull/51) |

| 2026-11-24 | Proprietário / aplicação autorizada | «Vamos avançar sem esse backup, eu já tenho um backup anterior no computador» | #010 / 010.04 | Preflight real OK; migração `shop_cost_editor` aplicada só em Teste sob ledger `20261124170927`; RPC/ACL verificadas; backup novo e restauração não comprovados; QA/autorização de produção pendentes | [PR #51](https://github.com/neopep/App-NeoPep/pull/51) |

| 2026-11-24 | Codex / conferência GitHub | 010.05 commit `2785404`; PR criada manualmente após 403 | #010 / 010.05 | PR [#52](https://github.com/neopep/App-NeoPep/pull/52) em rascunho; 13 arquivos; código pronto para revisão, SQL ainda não aplicado em Teste, sem homologação nem aceite; 010.04 segue aprovado separadamente | [PR #52](https://github.com/neopep/App-NeoPep/pull/52) |

| 2026-11-24 | Proprietário / Supabase | «Autorizo» — aplicar migração SQL 010.05 somente em Teste | #010 / 010.05 | Preflight somente leitura passou; SQL exato do Git (blob `1d3e756f`) aplicado em `qnuluspqfazdppciermw`; ledger remoto `20261124172822 / shop_financial_dashboard`, diferente do prefixo local `20261124200000`. RPC e grants verificados. Sem deploy/QA real/aceite 010.05 | [PR #52](https://github.com/neopep/App-NeoPep/pull/52) |

| 2026-11-24 | Assistente / Vercel Teste | Homologação financeira 010.04+010.05 | #010 / 010.04+010.05 | PR #53 draft; Vercel projeto Teste `app-neopep-staging` publicou commit `43e31df`, deploy `dpl_Fb2oKfv8sFgWUx2945BjmFetetif` READY. Custom alias `teste.app.neopep.com.br` respondeu 200 e `config.js` exibiu Supabase Teste e SHA certo. QA real e aceite 010.05 pendentes; sem publicação em Produção | [PR #53](https://github.com/neopep/App-NeoPep/pull/53) |

| 2026-11-24 | Proprietário | «Está validado e aceito» | #010 / 010.04+010.05 | Aceite explícito da integração em Teste; PR #53 @43e31df, Vercel Teste READY dpl_Fb2oKfv8sFgWUx2945BjmFetetif. Nenhuma promoção para Produção autorizada. #010.06 próximo, ainda não iniciado | [PR #53](https://github.com/neopep/App-NeoPep/pull/53) |

| 2026-11-24 | Proprietário | «Vamos avançar e finalizar» | #010 / 010.06 | Prioriza fechamento completo: conciliação, snapshots idempotentes, política de custo, recebimentos e reversões; preservar checkout/webhook Mercado Pago e o aceite separado de Produção | [Plano #010.06](PLANO-IMPLEMENTACAO-010-06.md) |

| 2026-11-24 | Proprietário | «Só temos que controlar que temos poucos deploys na vercel» | Todos, prioritariamente #010.06 | Política de economia de deploy: zero deploys automáticos para branches; testes locais primeiro; um único deploy de homologação por lote fechado, após checklist; Produção somente com autorização específica. Registrar deploy ID/estado e evitar testes por deploy | [Política](POLITICA-ECONOMIA-DEPLOYS.md) |

## 4. Fila de aprovados aguardando publicação
**#010.04 e #010.05 aprovadas pelo proprietário em 24/11/2026**, como versão integrada de Teste da [PR #53](https://github.com/neopep/App-NeoPep/pull/53), commit `43e31df`, deploy READY `dpl_Fb2oKfv8sFgWUx2945BjmFetetif`. Aguardar solicitação explícita de publicação em Produção; nenhuma promoção de PR ou migração de Produção autorizada. #010.06 permanece não iniciada.
