# Controle incremental de execução NeoPep — Ciclo de 14 frentes
Versão 2.0 | 24/11/2026 | Branch documental PR #40 | **NÃO É uma lista de funcionalidades já publicadas**
Acompanhar em cada entrega com commit na branch de trabalho e atualizar este controle. Não apagar registros históricos.
Leia o README e o protocolo #014 antes de editar.

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
| #006 | Prévia PDF Biblioteca | PLANEJADO | canvas/fallback PDF verificado | 006.01 |
| #005 | Modal de comparações | PLANEJADO | PR36 registra comparações; operação atual remota não verificada | 005.01 |
| #001 | Localização onboarding | PLANEJADO | Preferência e prompt nativo já no código | 001.01 |
| #002 | Consentimento personalização | PLANEJADO | Quatro preferências existentes | 002.01 |
| #008 | Fixar publicações | PLANEJADO | Biblioteca já instalada; ordem atual não auditada | 008.01 |
| #009 | Seringa na Home | PLANEJADO | syringeSymbol existente | 009.01 |
| #003 | Tema claro/escuro | PLANEJADO | light/dark/system existente no código | 003.01 |
| #010 | Estoque, custos e lucro | PLANEJADO | shop_products.stock e price_cents confirmados nos dois bancos | 010.01 |
| #011 | Gestão em massa | PLANEJADO | Gerenciar Loja e estoque por produto existentes | 011.01 |
| #013 | Central de Campanhas | PLANEJADO | Campanhas/Connect/grupos presentes, sem confirmação de envio automático | 013.01 | Auditar Connect/Windows/RPCs e PR35 | PLANEJADO | capacidades reais |
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
| 012.01 |
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
| 006.01 | Reproduzir erro no destaque PDF | PLANEJADO | iPhone, primeiro PDF, dados de destaque |
| 006.02 | Corrigir capa/cache/fallback no componente existente | PLANEJADO | Nenhuma alteração destrutiva no leitor |
| 006.03 | Validar Biblioteca/reader/carrossel | PLANEJADO | URLs privadas e device |
| 005.01 | Auditar origem das fotos e fluxo do Grupo | PLANEJADO | Storage/autorizações |
| 005.02 | Construir modal maior com galeria | PLANEJADO | 0/1/N fotos, CTA |
| 005.03 | Confirmar publicação de cópia e retorno ao chat | PLANEJADO | sem vazar original |
| 001.01 | Auditar permissões iniciais e tela já existente | PLANEJADO | Não duplicar preferências |
| 001.02 | Incluir passo de explicação/localização opcional | PLANEJADO | fluxo nativo e fallback |
| 001.03 | Testar aceitação, revogação e plataformas | PLANEJADO | sem bloqueio |
| 002.01 | Mapear finalidade das preferências existentes | PLANEJADO | analytics, uso, push, location |
| 002.02 | Inserir tela com textos aprovados | PLANEJADO | sequenciada, consentimento separado |
| 002.03 | Validar opt-out e privacidade | PLANEJADO | sem dados sensíveis no marketing |
| 008.01 | Analisar order/filter/ACL da Biblioteca | PLANEJADO | identificar delta SQL |
| 008.02 | Fixar/desafixar e ordenar com autorização | PLANEJADO | múltiplos fixados |
| 008.03 | Validar filtros, permissão e destaque | PLANEJADO | sem vazamento |
| 009.01 | Localizar seringa resultado e último cálculo | PLANEJADO | source true |
| 009.02 | Reusar componente no card da Home | PLANEJADO | vazio e cálculo real |
| 009.03 | Validar três capacidades e contas | PLANEJADO | sem regressão |
| 003.01 | Inventariar tokens light/dark/system | PLANEJADO | screenshots baseline dark |
| 003.02 | Implementar tema claro paleta e switch | PLANEJADO | sem flash e opção system |
| 003.03 | Revisar todas telas e acessibilidade | PLANEJADO | dark preservado |
| 010.01 | Auditar estoque, pedido, Edge e transições | PLANEJADO | sem alterar MP |
| 010.02 | Decidir custo/câmbio/CMV e política estoque | PLANEJADO | regras explícitas |
| 010.03 | Schema aditivo custos e movimentações | PLANEJADO | RLS, snapshot, rollback |
| 010.04 | UI de aquisição no produto atual | PLANEJADO | sem segundo stock |
| 010.05 | Dashboard de lucro/margem no Gerenciar | PLANEJADO | cálculos e custos unknown |
| 010.06 | Testar concorrência e reconciliação | PLANEJADO | webhook preservado |
| 011.01 | Contrato e UX preview em massa | PLANEJADO | tabela e filtros |
| 011.02 | RPC admin atomizada/idempotente | PLANEJADO | ACL e transações |
| 011.03 | Operações preços + câmbio + arredondamento | PLANEJADO | preview idêntica ao commit |
| 011.04 | Operações estoque e auditoria | PLANEJADO | sem negativar/sobrescrever |
| 011.05 | QA lotes e conflitos | PLANEJADO | falha parcial informada |
| 013.01 | Auditar Connect/Windows/RPCs e PR35 | PLANEJADO | capacidades reais |
| 013.02 | Manter abas e criar editor full-screen | PLANEJADO | preserva App e esteira |
| 013.03 | Autosave/preview/formatação | PLANEJADO | texto fiel ao envio |
| 013.04 | Imagens, anexos e formatos do Bridge | PLANEJADO | legenda vs separado |
| 013.05 | Produto/Biblioteca/Comunidade | PLANEJADO | links e autorizações |
| 013.06 | Grupos e estado real da conexão | PLANEJADO | heartbeat, sync e elegíveis |
| 013.07 | Criar/agendar na esteira, sem despacho falso | PLANEJADO | por grupo e canal |
| 013.08 | Confirmar envio imediato real, se autorizado | PLANEJADO | seguro/sem duplicidade |
| 013.09 | Agenda automática e offline, se autorizada | PLANEJADO | job e retry |
| 013.10 | Cross-post App→WhatsApp | PLANEJADO | prévia editável |
| 013.11 | Cross-post WhatsApp→App/push | PLANEJADO | opt-in, versões independentes |
| 013.12 | Testes Windows/teste/Produção controlados | PLANEJADO | autorização específica |
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
