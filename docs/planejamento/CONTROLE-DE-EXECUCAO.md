# Controle incremental de execução NeoPep — Ciclo de 14 frentes
Versão 2.0 | 24/11/2026 | Branch documental PR #40 | **NÃO É uma lista de funcionalidades já publicadas**
Acompanhar em cada entrega com commit na branch de trabalho e atualizar este controle. Não apagar registros históricos.
Leia o README e o protocolo #014 antes de editar.

## 0. Decisão transversal — prioridade dinâmica e três trilhas
O proprietário pode mandar executar qualquer ID/sub-ID sem seguir as prioridades sugeridas. **Não converter automaticamente status de desenvolvimento em aceite ou publicação.** Registrar três estados independentes: (1) desenvolvimento, (2) aceite do proprietário, (3) publicação. O snapshot dessa decisão está em [QUADRO-DE-PRIORIDADES](QUADRO-DE-PRIORIDADES.md); o procedimento em [PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO](PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO.md). Usar [MARCO-ZERO](MARCO-ZERO-2026-11-24.md) e, depois de cada release, [REGISTRO-DE-PUBLICACOES](REGISTRO-DE-PUBLICACOES.md) para baselines. A palavra CONCLUÍDO pelo usuário representa somente o aceite e não se confunde com PUBLICADO.

## 1. Modelo de estado
PLANEJADO = requisitos consolidados, implementação futura;
AUDITANDO = confirmando código/ambiente;
EM_DESENVOLVIMENTO = código modificado em branch;
EM_TESTE = testes locais/ambiente de homologação em curso;
APROVADO_TESTE = comportamento aprovado e evidências arquivadas;
PRONTO_PRODUCAO = reconciliado, segurança/rollback/autorizações conferidos;
PUBLICADO = implantação efetiva em ambiente Produção com SHA/horário;
VALIDADO_PRODUCAO = testes operacionais e não regressão concluídos;
BLOQUEADO = impeditivo explicitado.
Status deve ser **por subetapa e ambiente**, não declarar uma frente inteira CONCLUÍDA por finalizar uma tela.

## 2. Estado por pacote
| Pacote | Nome | Estado de implementação deste ciclo | Situação anterior confirmada | Próximo trabalho |
|---|---|---|---|---|
| #014 | Preservação e governança | AUDITANDO | Leitura Git + metadata Vercel/Supabase | Fechar matriz de paridade e testes antes de codificar |
| #007 | Melhorias Loja | PLANEJADO | Texto atual verificado em dist/shop.js | 007.01 |
| #006 | Prévia PDF Biblioteca | EM_TESTE (local) | branch desenvolvimento/ajuste-006-miniatura-pdf @ 0087a15; testes reportados, sem deploy de Teste | 006.03 |
| #005 | Modal de comparações | PLANEJADO | PR36 registra comparações; operação atual remota não verificada | 005.01 |
| #001 | Localização onboarding | PLANEJADO | Preferência e prompt nativo já no código | 001.01 |
| #002 | Consentimento personalização | PLANEJADO | Quatro preferências existentes | 002.01 |
| #008 | Fixar publicações | EM_TESTE (local) | PR #42 draft; commit d76ae73; SQL não aplicado em Teste | 008.03 |
| #009 | Seringa na Home | PLANEJADO | syringeSymbol existente | 009.01 |
| #003 | Tema claro/escuro | PLANEJADO | light/dark/system existente no código | 003.01 |
| #010 | Estoque, custos e lucro | EM_TESTE (Supabase staging) | 010.03-B: schema aplicado somente em Teste, sem backup por opção expressa do proprietário; sem homologação funcional ou aceite | 010.03-B QA |
| #011 | Gestão em massa | PLANEJADO | Gerenciar Loja e estoque por produto existentes | 011.01 |
| #013 | Central de Campanhas | PLANEJADO | Campanhas/Connect/grupos presentes, sem confirmação de envio automático | 013.01 |
| #012 | Assinaturas | PLANEJADO | Segmentação por plano existente, billing recorrente não verificado | 012.01 |
| #004 | Alimentação | PLANEJADO | Card Em breve documentado | 004.01 |

## 3. Backlog por microetapa (cada ID tem aceite e prova no documento detalhado)
| Sub-ID | Trabalho exato | Estado | Dependência/aceite |
|---|---|---|---|
| 014.01 | Registrar SHA/URL/Vercel Teste e Produção | AUDITANDO | Metadata coletada; confirmar domínio/alias e PWA |
| 014.02 | Comparar Git/PR35/PR37 e componentes aprovados | AUDITANDO | Matriz e estratégia de reconciliação |
| 014.03 | Inventariar banco/RLS/Edge/ledger Teste e Produção | AUDITANDO | Metadados iniciais; falta contrato funcional |
| 014.04 | Criar matriz de regressão por módulo | PLANEJADO | Testes baseline e fluxos protegidos |
| 014.05 | Implantar rotina de documentação por subetapa | PLANEJADO | Arquivos desta PR, provar uso na 1ª implementação |
| 014.06 | Auditar gates de release PR37 | PLANEJADO | Plano seguro e não regressivo |
| 014.07 | Mitigar build desnecessário de docs | PLANEJADO | Avaliar ignored build sem mudar deploy no escopo atual |
| 014.08 | Auditoria geral de preservação do ciclo | PLANEJADO | Após outros pacotes |
| 007.01 | Conferir textos, layout e suporte existente | PLANEJADO | Baseline visível |
| 007.02 | Mudar copy e CTA sem alterar checkout | PLANEJADO | Link suporte e mensagem de pagamento corretos |
| 007.03 | Validar responsividade e regressão da Loja | PLANEJADO | Teste e aprovação |
| 006.01 | Reproduzir erro no destaque PDF | VERIFICADO_LOCALMENTE | Chromium iPhone 13 emulado; rótulo PDF 91px/capa 52px; real pendente |
| 006.02 | Corrigir capa/cache/fallback no componente existente | IMPLEMENTADO_LOCALMENTE | commit 0087a15; PDF primeira página, fallback e cancelamento; homologação real pendente |
| 006.03 | Validar Biblioteca/reader/carrossel | EM_TESTE | build/check/22 testes reportados; pendente Teste autenticado, Safari e PWA físico |
| 005.01 | Auditar origem das fotos e fluxo do Grupo | PLANEJADO | Storage/autorizações |
| 005.02 | Construir modal maior com galeria | PLANEJADO | 0/1/N fotos, CTA |
| 005.03 | Confirmar publicação de cópia e retorno ao chat | PLANEJADO | sem vazar original |
| 001.01 | Auditar permissões iniciais e tela já existente | PLANEJADO | Não duplicar preferências |
| 001.02 | Incluir passo de explicação/localização opcional | PLANEJADO | fluxo nativo e fallback |
| 001.03 | Testar aceitação, revogação e plataformas | PLANEJADO | sem bloqueio |
| 002.01 | Mapear finalidade das preferências existentes | PLANEJADO | analytics, uso, push, location |
| 002.02 | Inserir tela com textos aprovados | PLANEJADO | sequenciada, consentimento separado |
| 002.03 | Validar opt-out e privacidade | PLANEJADO | sem dados sensíveis no marketing |
| 008.01 | Analisar order/filter/ACL da Biblioteca | REPORTADO_CONCLUIDO | Codex inspecionou Biblioteca existente; ver registro de execução na branch |
| 008.02 | Fixar/desafixar e ordenar com autorização | IMPLEMENTADO_LOCALMENTE | PR #42; migração 20261124140000_library_pins.sql ainda não aplicada em Teste |
| 008.03 | Validar filtros, permissão e destaque | EM_TESTE | 25 testes reportados, banco isolado e emulações; faltam contas reais e dispositivos físicos |
| 009.01 | Localizar seringa resultado e último cálculo | PLANEJADO | source true |
| 009.02 | Reusar componente no card da Home | PLANEJADO | vazio e cálculo real |
| 009.03 | Validar três capacidades e contas | PLANEJADO | sem regressão |
| 003.01 | Inventariar tokens light/dark/system | PLANEJADO | screenshots baseline dark |
| 003.02 | Implementar tema claro paleta e switch | PLANEJADO | sem flash e opção system |
| 003.03 | Revisar todas telas e acessibilidade | PLANEJADO | dark preservado |
| 010.01 | Auditar estoque, pedido, Edge e transições | DIAGNÓSTICO REGISTRADO | PR #49 |
| 010.02 | Decidir custo/câmbio/CMV e política estoque | POLÍTICA-BASE REGISTRADA | Arquitetura 010.02; critérios contábeis finais pendentes |
| 010.03-A | Preparar schema aditivo de custos e movimentações | EM_TESTE (local) | PostgreSQL 17 isolado, check e 32 testes da Loja |
| 010.03-B | Homologar migração no Supabase de Teste | EM_TESTE (SQL aplicada; QA funcional pendente) | Migração shop_cost_foundation aplicada em Teste 20261124164148; usuário dispensou backup/restauração; leitura de estrutura/RLS/grants positiva; testes reais pendentes |
| 010.04 | UI de aquisição no produto atual | PLANEJADO | sem segundo stock |
| 010.05 | Dashboard de lucro/margem no Gerenciar | PLANEJADO | cálculos e custos unknown |
| 010.06 | Testar concorrência e reconciliação | PLANEJADO | webhook preservado |
| 011.01 | Contrato e UX preview em massa | PLANEJADO | tabela e filtros |
| 011.02 | RPC admin atomizada/idempotente | PLANEJADO | ACL e transações |
| 011.03 | Operações preços + câmbio + arredondamento | PLANEJADO | preview idêntica ao commit |
| 011.04 | Operações estoque e auditoria | PLANEJADO | sem negativar/sobrescrever |
| 011.05 | QA lotes e conflitos | PLANEJADO | falha parcial informada |
| 013.01 | Auditar Connect/Windows/RPCs e PR35 | PLANEJADO | capacidades reais |
| 013.02 | Preservar e ajustar navegação das duas abas | PLANEJADO | não quebrar App, esteira e grupos |
| 013.03 | Editor visual full-screen e autosave | PLANEJADO | mobile, retorno e persistência |
| 013.04 | Formatação precisa e seleção de texto | PLANEJADO | prévia corresponde ao payload |
| 013.05 | Imagens, anexos e compatibilidade de mídia | PLANEJADO | legenda versus separado |
| 013.06 | Seletores Produto/Biblioteca/Comunidade | PLANEJADO | links e autorizações |
| 013.07 | Grupos sincronizados e estado real Connect | PLANEJADO | heartbeat, sessão e elegibilidade |
| 013.08 | Criar/agendar na esteira sem despacho falso | PLANEJADO | status por grupo/canal |
| 013.09 | Homologar Bridge para envio imediato real | PLANEJADO | envio só após autorização |
| 013.10 | Agendamento automático com fila/offline/retries | PLANEJADO | canal e execução autorizados |
| 013.11 | Cross-post App → WhatsApp | PLANEJADO | prévia e personalização |
| 013.12 | Cross-post WhatsApp → App e push | PLANEJADO | opt-in e versões independentes |
| 013.13 | Testes reais Windows/ambientes controlados | PLANEJADO | autorização de testes |
| 013.14 | Rollout seguro e monitoramento | PLANEJADO | gates Produção |
| 012.01 | Inventariar Premium e plano de campanhas | PLANEJADO | sem duplicar acesso |
| 012.02 | Criar catálogo/versões de plano | PLANEJADO | regras dinâmicas |
| 012.03 | Entitlements e quotas no servidor | PLANEJADO | RLS/concorrência |
| 012.04 | Painel Planos/Funcionalidades | PLANEJADO | alteração sem deploy |
| 012.05 | Cortesias e exceções por usuário | PLANEJADO | sem cobrança |
| 012.06 | Minha assinatura | PLANEJADO | benefícios e limites |
| 012.07 | Mercado Pago recorrente isolado em Teste | PLANEJADO | sem webhook Loja |
| 012.08 | Eventos/reconciliação/relatórios | PLANEJADO | fatos verificados |
| 012.09 | Ativação controlada e rollback | PLANEJADO | autorização Produção |
| 012.10 | Arquitetura Apple/Google futura | PLANEJADO | sem billing agora |
| 004.01 | Modelagem, requisitos e fontes nutricionais | PLANEJADO | licenças/consentimento |
| 004.02 | Metas, refeições, água e cálculos | PLANEJADO | RLS e validação |
| 004.03 | Histórico e gráficos | PLANEJADO | valores verdadeiros |
| 004.04 | Plano semanal, receitas e substituições | PLANEJADO | sem IA |
| 004.05 | Fotos e lista de compras | PLANEJADO | bucket privado |
| 004.06 | QA, limites Premium e privacidade | PLANEJADO | não emitir prescrição |

## 4. Evidência remota parcial de 24/11/2026
GitHub main SHA fc0ae22; staging referenciada na PR #37 em 0970ae6. Vercel dois projetos consultados: production READY main fc0ae22 09:37 UTC; staging target production do próprio projeto Teste READY 0970ae6 01:15 UTC. Supabase projetos Teste e Produção ACTIVE_HEALTHY; ledger em Teste 22 entradas, Produção 15, com IDs diferentes. Metadados confirmam shop_products.stock e price_cents, campaign_wa_* e connect_wa_* nos dois bancos. Não foi testado o app Windows instalado nem status real WhatsApp. O estado da PR #37 continua open/draft. Não usar esta coleta como GO para release.

## 5. Registro de execuções — append-only
| Data UTC | ID | Ação | Base/branch | PR/commit | Testes | Ambiente | Status/prova | Falta |
|---|---|---|---|---|---|---|---|---|
| 2026-11-24 | #001–#014 | Consolidação documental V1 | docs/plano-mestre-ajustes-2026-11-24 | PR #40 | Não executados | GitHub | Especificação salva | Revisar |
| 2026-11-24 | #001–#014 | Auditoria crítica e especificações V2 | main fc0ae22, staging 0970ae6 (histórico/metadata) | PR #40 | Não executados | GitHub, metadata Supabase/Vercel | Sem alterações funcionais | Teste ponta a ponta, paridade, Win/MP |

## 6. Registro obrigatório por subetapa
### EXEC-AAAA-MM-DD-[ID.SUBE]
- Pedido aprovado e limites:
- Fonte da decisão:
- Status anterior/atual; ambiente:
- SHA base e local, PR, branch, responsável:
- Arquivos e contratos analisados:
- Delta implementado e dependências:
- Elementos e comportamentos preservados:
- RLS, migrations, Edge, rollback, custos e impacto:
- Testes baseline e novos, comandos/resultados:
- Teste web/PWA/iPhone/Windows: URL/SHA/data/prova:
- Produção: URL/SHA/data/prova e autorização:
- Problemas e riscos restantes:
- Próximo passo exato e condição de aceite:

## 7. Política de execução e atualização
Somente o agente em trabalho ativo atualiza os documentos após cada subetapa. Não há atualização automática em background por este registro. Em outro chat, iniciar por docs/planejamento/README.md, AGENTS.md e o último evento deste tracker. Nunca sobrescrever informações já existentes para simplificar a história; adicionar correções datadas. A cada PR de implementação, incluir mudança de tracker no mesmo PR, sem misturar PR #37 com funções novas sem reconciliação.

## 8. Eventos de prioridade e conclusão (a partir de 24/11/2026)
| Data | Tipo | Identificadores | Decisão | Evidência / efeito |
|---|---|---|---|---|
| 2026-11-24 | Diretriz geral | #001–#014 | Proprietário pode alterar ordem e publicar cada item isoladamente ou em conjunto | Protocolo de prioridades aprovado como regra de trabalho; nenhuma etapa funcional aceita/publicada por esta mensagem |

O agente responsável por **cada entrega real** registra a atualização documental na mesma atividade; não existe processamento em background de etapas ou mudanças de estado.

### Registro #006 — 24/11/2026 (verificado no GitHub)
- Branch: `desenvolvimento/ajuste-006-miniatura-pdf`; SHA `0087a15d27dc4c48c1cae675fae86c9e59199a8a`.
- Base: `staging/permanente@0970ae6`; comparação GitHub: **1 commit à frente, 0 atrás**, 9 arquivos modificados/criados. Arquivos: `dist/library-files.js`, `dist/library.js`, `dist/style.css`, `dist/sw.js`, `scripts/build-staging.cjs`, `tests/library-pdf-cover-browser.cjs`, `tests/library-ui.test.cjs`, `tests/staging-pwa.test.cjs` e registro `docs/planejamento/EXEC-2026-11-24-006.md`.
- Evidência: [registro da execução](https://github.com/neopep/App-NeoPep/blob/desenvolvimento/ajuste-006-miniatura-pdf/docs/planejamento/EXEC-2026-11-24-006.md). O Codex reportou build/check e 22 testes dirigidos; execução dos testes não foi repetida por este agente.
- Bloqueios: PR de código não criado (403 informado pelo Codex); sem publicação em Teste; falta validar PDF real com usuário autorizado, Safari/PWA em iPhone físico e Android físico. **Não aprovar ou publicar** por inferência.
- Desenvolvimento: EM_TESTE; aceite: NÃO_CONCEDIDO; publicação: NÃO_REALIZADA; próximo: criar PR isolada para staging/permanente, homologar em Teste e solicitar aceite.

### Verificação complementar #006 — PR #41 e Vercel (24/11/2026)
- PR [#41](https://github.com/neopep/App-NeoPep/pull/41) criada com sucesso por este agente, `draft`, `open`, destino `staging/permanente`, head `0087a15`. GitHub reporta `mergeable=true` na última leitura. Não foi efetuado merge.
- Consulta Vercel filtrada pelo SHA `0087a15`: projeto **Teste** `app-neopep-staging`, deploy `dpl_7pDctqa1FjaatRazqDXDNa4TZBiA` com status `CANCELED`; projeto **Produção** `app-neopep`, preview `dpl_8tNimE4BsYfFxCDAKepbSbix1bcc` com status `ERROR`. Ambos têm `target=null` e **não** equivalem a publicação em domínio de Produção. Nenhum preview READY confirmado para este SHA.
- Bloqueio atual: preparar e efetuar implantação no ambiente Teste por fluxo autorizado, depois validar PDF real e Safari/PWA físicos. O ajuste continua EM_TESTE (local), aceite NÃO_CONCEDIDO, publicação NÃO_REALIZADA. Não fazer merge em Teste sem checar se o fluxo de deploy/CI permitirá uma homologação isolada.

### Registro #008 — 24/11/2026 (GitHub)
- Branch `desenvolvimento/ajuste-008-fixar-biblioteca`, commit `d76ae73379537c3cf5d638f18dc91ab019e8cdb8`, [PR #42](https://github.com/neopep/App-NeoPep/pull/42) aberta em rascunho para `staging/permanente`.
- Comparação: 1 commit à frente e 0 atrás de `staging/permanente@0970ae6`; 9 arquivos alterados, inclusive `dist/community.js`, CSS, service worker, build, testes e `supabase/migrations/20261124140000_library_pins.sql`.
- Evidência Codex: 25 testes direcionados, build/check e emulações desktop/iPhone 13/Pixel 7 reportados; este agente não repetiu a execução nem auditou ainda a semântica SQL/RLS.
- **Bloqueio:** Supabase Teste não acessível ao Codex (proxy); SQL apenas validado em banco isolado, não aplicado em Teste/Produção. Exige revisão dirigida da migração e aplicação controlada em Teste antes da homologação real. Faltam contas reais, concorrência administrativa e dispositivos físicos.
- #006 permanece separado na PR #41, sem merge automático. Desenvolvimento #008: EM_TESTE (local); aceite NÃO_CONCEDIDO; publicação NÃO_REALIZADA.

### Registro #009 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-009-seringa-home`, commit `b66569b39ddf7a322dc34cd78c7f6476ec4bd803`; [PR #43](https://github.com/neopep/App-NeoPep/pull/43) aberta em rascunho para `staging/permanente`.
- Comparação GitHub: 1 commit à frente, 0 atrás da base `0970ae6`; 8 arquivos: `src/app.js`, `dist/app.js`, `dist/style.css`, `dist/sw.js`, `scripts/build-staging.cjs`, `tests/staging-pwa.test.cjs`, `tests/ui.test.cjs`, `docs/planejamento/EXEC-2026-11-24-009.md`.
- Codex reportou build/check/empacotamento e 64 testes direcionados aprovados, incluindo exclusão, troca de contas, três capacidades e emulações. Estes testes **não foram repetidos por este agente**.
- Pendências: revisão dirigida de código; homologação com sessão autenticada em Teste, Safari/PWA e dispositivos físicos; aceite explícito. PR criada, mas não mesclada; nenhum deploy realizado por este agente. #006/PR #41 e #008/PR #42 continuam independentes.
- Estado: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.

### Registro #003 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-003-tema-claro`, commit principal `00ef2d4e7be01bb19261a8cdc5987439a7888299`, [PR #44](https://github.com/neopep/App-NeoPep/pull/44) criada em rascunho para `staging/permanente`.
- Comparação: 2 commits à frente, 0 atrás de `staging/permanente@0970ae6`; 17 arquivos no diff (app, CSS, appearance, admin, SW, scripts, testes e evidências).
- Codex reportou build/check/empacotamento, rodadas de 81 e 110 testes (não somar como 191 testes distintos) e 21 comparações visuais do escuro sem diferença, exceto novo seletor. Este agente não repetiu os testes.
- Pendências: revisão dirigida, homologação autenticada no Teste, Safari/PWA/dispositivos físicos, aceite explícito. Nenhum merge ou deploy efetuado. PRs #41, #42 e #43 permanecem separadas.
- Estados: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.

### Registro #001 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-001-localizacao`, commit `cf3483f97c1b877643d22d0bdf98997363ef9b31`; [PR #45](https://github.com/neopep/App-NeoPep/pull/45) criada em rascunho para `staging/permanente`.
- Comparação GitHub: 1 commit à frente, 0 atrás de `staging/permanente@0970ae6`; 11 arquivos (app, cloud, CSS, SW, build, testes e `docs/planejamento/EXEC-2026-11-24-001.md`).
- Codex reportou build/check/empacotamento e 76 testes direcionados aprovados, incluindo emulações e RPC simulada. Testes **não repetidos por este agente**.
- Pendências: revisão dirigida do código, homologação de cadastro/login reais no Teste, Safari/PWA e dispositivos físicos, aceite explícito. Nenhum merge, migração ou deploy efetuado. PRs #41–#44 seguem separadas.
- Estado: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.

### Registro #002 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-002-personalizacao`, commit `bd0c64df2cbad3088e9f9d9ea4932df44efaf2ad`; [PR #46](https://github.com/neopep/App-NeoPep/pull/46) aberta em rascunho para `staging/permanente`.
- Comparação: 1 commit à frente, 0 atrás da base `0970ae6`; 12 arquivos (app, cloud, CSS, SW, build, testes, migração `20261124150000_personalization_consent.sql` e registro).
- Codex reportou build/check/empacotamento e 75 testes direcionados aprovados, migração reaplicada em banco isolado; testes **não repetidos por este agente**.
- Bloqueio: Supabase Teste não acessível ao Codex; migração não aplicada em Teste ou Produção. Revisar SQL/RLS, aplicar em Teste por fluxo seguro, validar sessão autenticada, Safari/PWA/dispositivos físicos e integração com #001 após aprovação de ambos.
- Nenhum merge ou deploy realizado. PRs #41–#45 seguem separadas. Estado: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.

### Registro #005 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-005-comparacoes-grupo`, commit `348373111f856574ed0372ddea2855edd7b2faa1`; [PR #47](https://github.com/neopep/App-NeoPep/pull/47) aberta em rascunho para `staging/permanente`.
- Comparação GitHub: 1 commit à frente, 0 atrás de `staging/permanente@0970ae6`; 10 arquivos alterados (community, cloud, CSS, SW, build, testes e registro de execução).
- Codex reportou build/check/empacotamento e 67 testes direcionados aprovados, com serviços simulados e emulações Chromium/iPhone 13/Pixel 7. Estes testes **não foram repetidos por este agente**.
- Pendências: revisão dirigida de código; homologação de permissões e expiração de URLs assinadas no Teste com contas reais, Safari/PWA e dispositivos físicos; aceite explícito. Nenhum merge/deploy efetuado. PRs #41–#46 seguem separadas.
- Estados: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.

### Registro #007 — 24/11/2026 (conferência GitHub)
- Branch `desenvolvimento/ajuste-007-atendimento-loja`, commit `facee60bc5cdfc32704178af97e1b4674a05460f`; [PR #48](https://github.com/neopep/App-NeoPep/pull/48) aberta em rascunho para `staging/permanente`.
- Comparação GitHub: 1 commit à frente, 0 atrás da base `0970ae6`; 10 arquivos (app, shop, CSS, SW, build, testes e dois arquivos de planejamento).
- Codex reportou build/check/empacotamento e 26 testes direcionados aprovados, com seis cenários Chromium desktop/iPhone 13/Pixel 7 e sem transações reais. Testes **não repetidos por este agente**.
- **Risco de integração documental:** a branch #007 adiciona `docs/planejamento/CONTROLE-DE-EXECUCAO.md` e `QUADRO-DE-PRIORIDADES.md`, enquanto a branch do Plano Mestre mantém versões canônicas mais recentes. Antes do merge, reconciliar as duas versões preservando todo histórico, sem sobrescrever registros.
- Pendências: revisão dirigida de código, homologação de atendimento com sessão real em Teste, aceite explícito. Nenhum merge, migração ou deploy realizado. PRs #41–#47 permanecem separadas.
- Estado: EM_TESTE (local), ACEITE_NAO_CONCEDIDO, PUBLICACAO_NAO_REALIZADA.


### Registro 010.03-A — 24/11/2026

- Desenvolvimento: implementado e validado localmente. Aceite do proprietário: pendente. Publicação: não realizada.
- Base `staging/permanente@0970ae6`, branch `desenvolvimento/ajuste-010-03a-estrutura-loja`, commit de implementação [`07fd513`](https://github.com/neopep/App-NeoPep/commit/07fd5134457e861886be4383065d0cb80638e167). [Registro do ensaio e arquivos](https://github.com/neopep/App-NeoPep/blob/07fd5134457e861886be4383065d0cb80638e167/docs/planejamento/EXEC-2026-11-24-010-03A.md).
- Migração `20261124160000`: câmbio, aquisições, movimentos auditáveis e snapshots privados. Ensaio local aprovou RLS e grants, concorrência, retentativas idempotentes, precisão decimal e reversão. `npm run check` e 32 testes direcionados da Loja passaram. Checkout, webhook, saldo e pedidos antigos preservados.
- 010.03-B: comparar catálogo, ledger e contratos em Teste; registrar e ensaiar recuperação; após autorização, aplicar somente esta migração e validar permissões, checkout, reserva e cancelamento com dados sintéticos. Nenhuma aplicação remota ou ativação automática nesta etapa.

### Registro 010.03-B — 24/11/2026 — Aplicação controlada em Teste
- **Autorização do proprietário:** «Pode avançar sem backup». A ausência de backup ensaiado é **risco conscientemente aceito** para o ambiente de Teste, não uma evidência de recuperabilidade e não vale como autorização para Produção.
- **Ambiente exclusivo:** Supabase `neopep-staging` projeto `qnuluspqfazdppciermw`, PostgreSQL 17.12. Produção `cpslafpzjtbpmoxxysaa` não alterada.
- **Fonte:** `supabase/migrations/20261124160000_shop_cost_foundation.sql`, commit da branch `desenvolvimento/ajuste-010-03a-estrutura-loja` / PR [#50](https://github.com/neopep/App-NeoPep/pull/50). Nenhuma alteração no arquivo de webhook ou checkout.
- **Preflight somente leitura:** `neo_private.shop_products` e `shop_orders` presentes; colunas exigidas e funções `public.neo_admin_access()`, `auth.uid()` existentes; novos objetos ausentes; ledger não continha shop_cost_foundation.
- **Migração aplicada com ferramenta Supabase:** resultado `success=true`, ledger `supabase_migrations.schema_migrations` registra `20261124164148 / shop_cost_foundation`. **Observação:** o identificador do ledger remoto foi gerado pela ferramenta, distinto do prefixo `20261124160000` do arquivo Git. Futura reconciliação do histórico CLI precisa mapear essa equivalência antes de novas migrações.
- **Verificação pós-aplicação:** 4 tabelas privadas criadas (shop_fx_rates, shop_acquisitions, shop_stock_movements, shop_sale_cost_snapshots), 1 view security_invoker shop_acquisition_costs, triggers de append-only e de validação, três funções sem SECURITY DEFINER; quatro tabelas com RLS habilitada, nenhum grant direto a anon/authenticated/service_role. Contagens iniciais todas zero. Auditor de segurança Supabase executado; lints informativas de RLS sem políticas em várias tabelas privadas, consistente com ausência de grants, não foi feita alteração extra.
- **Limitações:** sem backup/restauração; sem testes autenticados por role real, concorrência multi-sessão integrada, checkout/pagamentos simulados contra staging, nem ativação da captura de snapshots (não existe ligação com o fluxo legado). Não marcar 010.03-B como totalmente homologada até esses testes. A migração não significa que custos/lucros já apareçam na interface.
- **Próximo passo:** revisar SQL e ACLs em sessão autenticada, fixtures isoladas sem comprometer saldo/pedidos, confirmar equivalência do ledger Git/remoto, continuar 010.04 apenas após decisão do proprietário. Aceite NÃO_CONCEDIDO; Produção NÃO_PUBLICADA; não alterar Mercado Pago.
