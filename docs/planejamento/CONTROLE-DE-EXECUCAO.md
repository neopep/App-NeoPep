# NeoPep — Controle de execução incremental
**Atualização:** 24/11/2026 | **Responsável pela atualização:** agente que executar cada lote | **Branch documental:** `docs/plano-mestre-ajustes-2026-11-24`
**Regra:** nunca marcar «Concluído» sem PR/commit, testes e evidência de ambiente. «Código integrado» ≠ «Publicado» ≠ «Validado no dispositivo».

## 1. Estados permitidos
- `PLANEJADO`: requisitos consolidados, sem implementação.
- `AUDITANDO`: inspecionando baseline/contratos.
- `EM_DESENVOLVIMENTO`: mudanças em branch própria.
- `EM_TESTE`: build/QA em homologação.
- `APROVADO_TESTE`: evidências aceitas em Teste.
- `PRONTO_PRODUCAO`: pré-voo/rollback aprovados; ainda não publicado.
- `PUBLICADO`: deploy/migration realmente aplicados em Produção, com SHA e horário.
- `VALIDADO_PRODUCAO`: testes pós-deploy e monitoramento concluídos.
- `BLOQUEADO`: impeditivo documentado.

## 2. Painel de progresso
| ID | Entrega | Estado | Branch/PR | Evidência atual | Próximo passo |
|---|---|---|---|---|---|
| #014 | Baseline, governança, handoff | AUDITANDO | PR #40 (documental), PR #37 (release) | Árvore Git e PRs consultados 24/11 | Auditar deployments e bancos |
| #007 | Loja: copy/atendimento | PLANEJADO | — | `dist/shop.js` existe | Conferir UI e rota suporte |
| #006 | PDF destaque Home | PLANEJADO | — | Biblioteca presente; relato fallback PR36 | Reproduzir bug |
| #005 | Comparações no chat | PLANEJADO | — | PR36 descreve Antes/Depois | Confirmar armazenamento Teste/Prod |
| #001 | Localização onboarding | PLANEJADO | — | PR36 relata preferência/prompt parcial | Verificar fluxo atual |
| #002 | Consentimento personalização | PLANEJADO | — | Migration de privacidade existe | Verificar telas e eventos |
| #008 | Posts fixados Biblioteca | PLANEJADO | — | Biblioteca existe | Mapear listagem/ordem |
| #009 | Seringa Home | PLANEJADO | — | Calculadora existente | Identificar componente e estado |
| #003 | Tema claro/escuro | PLANEJADO | — | CSS/tema existentes | Mapear tokens |
| #010 | Estoque/custos/lucro | PLANEJADO | — | Loja e Edge existentes | Auditar estoque e pagamentos |
| #011 | Gestão em massa | PLANEJADO | — | Preço/estoque por produto | Desenhar RPC segura |
| #013 | Campanhas/Connect integrado | PLANEJADO | PR #35 (parcial, aberto) | Docs V2/Connect 0.2.6 | Inventariar contrato real |
| #012 | Assinaturas e pagamentos | PLANEJADO | — | Segmentação de planos ≠ billing | Auditar Premium e desenhar schema |
| #004 | Minha alimentação | PLANEJADO | — | Card «Em breve» na PR36 | Definir dados e MVP |

## 3. Registro de execução (acrescentar, não apagar histórico)
| Data/hora | ID/subetapa | Ação | Base SHA | Commit/PR | Testes/evidência | Ambiente | Resultado | Pendência |
|---|---|---|---|---|---|---|---|---|
| 2026-11-24 | #001–#014 | Requisitos e auditoria documental Git | `main` consultada; PRs #25/#35/#36/#37/#40 | PR #40 | Leitura de árvore e docs; **sem execução de testes** | GitHub | Documentado | Supabase/Vercel/Windows e Teste/Prod não verificados |

## 4. Template de atualização por subetapa
```md
### EXEC-AAAA-MM-DD-ID-SUBE
- ID / subtarefa:
- Pedido aprovado / escopo exato:
- Estado anterior → novo:
- Branch base + SHA / branch de trabalho:
- Arquivos e contratos inspecionados:
- Arquivos alterados / migrações novas:
- Componentes existentes preservados:
- Testes antes/depois (comandos e resultados):
- Ambiente Teste: URL, SHA, evidência, status:
- Ambiente Produção: URL, SHA, evidência, status:
- Riscos, segurança, RLS, backups, rollback:
- PR/commit/CI:
- Decisões tomadas / pendências:
- Próximo passo executável:
```

## 5. Regra de retomada
Outro agente/Codex deve ler, nesta ordem: `AGENTS.md` → `docs/conhecimento/CONTEXTO-MESTRE.md` → `docs/planejamento/INICIO-PARA-AGENTES.md` → `PLANO-MESTRE-NEOPEP-2026-11-24.md` → `LEVANTAMENTO-TECNICO-2026-11-24.md` → este controle → docs do módulo. Nunca confiar só no resumo de chat. Confirmar SHA/ambiente antes de executar.
