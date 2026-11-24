# NeoPep — Levantamento técnico e matriz de preservação
**Data:** 24/11/2026 | **Versão:** 2.0 | **Escopo:** leitura de GitHub e documentação, consulta somente leitura de metadados Supabase/Vercel; NÃO homologação do Windows/WhatsApp
**Fonte de verdade funcional:** [Plano Mestre](PLANO-MESTRE-NEOPEP-2026-11-24.md)  
**Registro operacional:** [CONTROLE-DE-EXECUCAO](CONTROLE-DE-EXECUCAO.md)  
**Instruções para qualquer agente:** [INICIO-PARA-AGENTES](INICIO-PARA-AGENTES.md)

## 1. Evidências verificadas em 24/11/2026
- Repositório identificado: `neopep/App-NeoPep`, branch principal `main`. Árvore consultada por GitHub API, com 777 entradas, incluindo `src/`, `dist/`, `supabase/`, `connect/windows/`, `tests/`, `docs/` e `release/`. Presença de arquivo ≠ recurso publicado ou operacional.
- PR #25: **merged**, alvo `main`. PR #36: **merged** na linha de homologação. PR #35: **open/draft**, navegação da Central de Campanhas. PR #37: **open/draft**, reconciliação Teste→Produção. PR #40: **open/draft**, planejamento documental.
- PR #37 registra Teste `staging/permanente` em `0970ae6`, Vercel Teste READY e 410/410 testes na candidata da época, mas também divergência reportada de **204 commits à frente e 93 atrás** de `main`, ~300 arquivos, necessidade de reconciliação e proteção de configurações oficiais. Os números são evidência **histórica da descrição da PR**, não comparação refeita agora.
- `docs/revisao/GO-NOGO-PRODUCAO.md` contém NO-GO e gates históricos de migração/infraestrutura; não extrapolar o status de 22/11 para a produção de hoje sem verificar. PRs merged não provam deploy nem migrações aplicadas.
- `AGENTS.md` exige ler contexto, preservar mudanças, migrações aditivas, check/build/testes, autorização para merge na main e produção, e atualização documental a cada entrega.
- Documentação do Connect 0.2.6 registra **envio manual de texto e uma imagem para um destino**, prévia, rascunho local DPAPI e **lembrete local** de revisão; múltiplos destinos automáticos, envio agendado automático, inventário central de rascunhos e outros anexos ainda são evoluções. Bridge/testes usam WhatsApp fictício. Estado real do Windows instalado e da sessão WhatsApp NÃO verificado.
- `docs/conhecimento/CAMPANHAS-NAVEGACAO-V2.md`: App possui Campanhas/Resultados/Públicos e planos; WhatsApp possui Campanhas/Publicações/Grupos/NeoPep Connect. Fluxo atual Conteúdo→Canais→Configurar→Revisar; publicação WhatsApp separada, com confirmação manual. Nosso #013 pretende **simplificar e substituir a composição**, sem apagar esteira, grupos ou Connect.
- `docs/conhecimento/CAMPANHAS.md`: campanhas existentes possuem editor, segmentação, prioridade, frequência, recorrência, popup, push, bucket privado `neo-campaign-images`, vinculação administrativa a `neo_private.campaign_plans` **sem faturamento**. Não confundir segmentação de campanhas por plano com assinaturas pagas do #012.
- `docs/revisao/AUDITORIA-LOTE-CALCULADORA.md` e `PR36-PRESERVACAO-E-LIBERACAO.md` relatam evolução de consentimento, seringa/calculadora, vídeos, comparação e Biblioteca. Relatos de versões diferentes não comprovam a versão de Produção atual.
- `docs/revisao/LOJA-VISIBILIDADE-E-DUPLICACAO.md` descreve visibilidade por membro e duplicação com regras de catálogo/checkout, estoque copiado para rascunho; não criar nova fonte de estoque. Há migrações `20261123220000_shop_member_visibility.sql` e `20261123234500_shop_store_admin_visibility.sql`; conferir quais foram aplicadas em cada ambiente.
- `docs/conhecimento/MONETIZACAO.md` descreve catálogo/carrinho/checkout e pagamentos Mercado Pago, mas não comprova recorrência de assinaturas. Preservar `mercadopago-create` e `mercadopago-webhook` existentes.
- `mobile/README.md` e `mobile/capacitor.config.example.json` demonstram preparação para apps nativos, não publicação nas lojas.
- Os arquivos `src/app.js`, `src/cloud.js` e `dist/*` compõem a aplicação; verificar pipeline `scripts/build.cjs` e `scripts/build-staging.cjs` antes de editar fontes ou bundles. Não alterar apenas `dist/` sem entender a geração.

## 2. Mapa por módulo: base identificada, delta, evidência necessária

| ID | Base existente identificada | Delta aprovado / pontos a implementar | Verificação obrigatória antes de editar |
|---|---|---|---|
| #001 | `src/app.js`, `src/cloud.js`, `20261123190000_privacy_preferences.sql`, `tests/privacy-preferences.test.cjs`; relatório PR36 diz permissão do dispositivo ao ativar preferência | Solicitar no onboarding com explicação e sem rastreamento, preservar preferências/revogação | Confirmar fluxo real de primeira entrada, navegador e status de migração em cada ambiente; evitar segundo prompt |
| #002 | Mesmas preferências, fluxos de onboarding e consentimentos | Tela «Personalize sua experiência» imediatamente após localização, opt-in e revogação | Mapear consentimentos já existentes, eventos de pixel e ATT; não criar consentimento paralelo |
| #003 | Tokens/estilos em `dist/style.css`, identidade visual e tema do Connect Windows (independente) | Novo tema claro, switch Home, dark intocado | Verificar variáveis atuais, contraste e persistência; não substituir tema Windows por tema web |
| #004 | Card «Minha alimentação / Em breve» documentado na PR36; banco de alimentação ainda não comprovado | Módulo alimentar completo, sem IA nesta fase | Verificar schema, peso/perfil, Storage, RLS e fontes nutricionais/licenças |
| #005 | Antes/Depois e bucket privado documentados na PR36; testes `before-after-group.test.cjs`, `photos.test.cjs` | Modal «Minhas comparações» com fotos reais, galeria e CTA | Verificar dados salvos e acesso ao bucket no ambiente; confirmar compartilhamento apenas por escolha |
| #006 | `dist/library-*.js`, `docs/BIBLIOTECA-DESTAQUES.md`; PR36 observa fallback de ícone se destaque sem anexo | Miniatura real da 1ª página de PDF, skeleton e fallback contido | Identificar o cartão exato e payload de destaque; não reescrever leitor PDF |
| #007 | `dist/shop.js`, suporte/atendimento existente | Texto «Encontre o que você procura.», CTA atendimento, selo Mercado Pago com texto preciso | Validar rota de suporte, versões de layout, sem mudar checkout |
| #008 | Biblioteca, editor/admin e migrações de descoberta `202611150025_library_discovery.sql`, `202611130026_library_editor.sql` | Fixar, desafixar e ordenar vários posts com filtros e permissões | Inspecionar ordenação atual, RLS e índice, sem afetar destaque da Home |
| #009 | Calculadora/seringa documentadas na PR36; `dist/app.js` e componentes da calculadora | Reutilizar seringa do resultado na Home com último cálculo ou vazia | Localizar componente verdadeiro, origem do último cálculo e 3 cards de capacidade |
| #010 | `202611120012_shop.sql`, `202611150029_shop_order_operations.sql`, `supabase/functions/mercadopago-webhook/index.ts`; gestão da Loja existente | Auditar baixa de estoque, custo USD/BRL opcional, câmbio, snapshot de CMV, margem, cards existentes | Auditar estados de pedido, triggers e idempotência no código E banco remoto; **não mexer webhook sem autorização** |
| #011 | Campo de estoque e preço já existente no editor, `dist/shop.js` | Edição em massa de preços e quantidades, preview, transações, histórico | Confirmar RPCs e concorrência com vendas; não duplicar estoque |
| #012 | `neo_private.campaign_plans` usado só para público de campanhas; não é faturamento. `docs/conhecimento/MONETIZACAO.md`, funções Mercado Pago da Loja | Menu Assinaturas e Pagamentos, planos dinâmicos, catálogo de recursos, cotas, acessos manuais, assinaturas recorrentes PWA e adaptadores futuros Apple/Google | Auditar qualquer estrutura Premium já existente; separar entitlements de pagamentos e segmentação; não tocar checkout Loja |
| #013 | `dist/admin/admin-whatsapp.js`, `admin-connect.js`, `whatsapp-navigation.js`, `connect/windows/CampaignComposer.cs`, `WhatsApp.cs`, `supabase/migrations/20261121231451_campaign_whatsapp.sql`, `20261121233733_neopep_connect.sql`, `tests/campaigns.test.cjs`, `tests/connect-wa-sync.test.cjs` | Editor visual full-screen WhatsApp; grupos sincronizados, status verdadeiro, formatação, imagens anexadas/separadas, produtos/biblioteca/comunidade, App↔WhatsApp, agendamento, esteira e logs | Inspecionar contratos efetivos de conexão, seleção de grupos, mídia e confirmação; envio automático/múltiplos grupos NÃO comprovado |
| #014 | `AGENTS.md`, `docs/processos/*`, PR #37 e documentação de release | **Governança de preservação e acompanhamento**: baseline por ambiente, rastreabilidade, tracker, QA, handoff entre agentes, documentação atualizada por etapa | Pré-requisito de todos os outros; não é funcionalidade comercial extra |

## 3. Riscos e contratos que não podem regredir
1. **Branches e releases:** não promover diretamente `staging/permanente` para `main` sem reconciliar PR #37 e conferir código/configuração oficiais. Conferir SHA real antes de cada lote.
2. **Mercado Pago:** pagamentos da Loja, webhook, Orders API, credenciais, estado de pedidos e histórico financeiro são protegidos. Assinaturas usam novos contratos/handlers isolados; só tocar no atual após justificativa e aprovação.
3. **Estoque:** não presumir que pagamento aprovado já baixa estoque exatamente uma vez; investigar `neo_shop`, gatilhos, Edge e reembolso.
4. **Connect:** preservar DPAPI, pareamento, sessão, atualizador assinado, aprovações e perfis Windows. A capacidade do painel web não deve ultrapassar o protocolo instalado; introduzir versionamento/capability negotiation.
5. **Campanhas:** preservar filas, públicos, consentimento, cron, confirmações humanas existentes e estados; nenhuma simulação vira «Publicado» automaticamente.
6. **Biblioteca/Comunidade:** preservar URLs privadas, regras de acesso e autorização para republicação; links não desbloqueiam Premium.
7. **Onboarding/consentimento:** evitar coletar coordenadas ou dados sensíveis sem necessidade/consentimento; distinguir localização aproximada por IP e geolocalização do dispositivo.
8. **Supabase:** conferir ledger e objetos instalados em Teste/Produção; nunca reaplicar migrations antigas cegamente, nem copiar dados/segredos entre ambientes.
9. **PWA:** manter IDs, escopo, service worker, domínios, login, callbacks, caches e funcionamento instalado.
10. **Custos:** nenhuma integração nova paga, assinatura, IA ou envio em massa deve ser ativado sem controle de gastos e autorização.

## 4. Dependências e ordem ajustada
**Fase 0 (obrigatória):** #014 baseline + PR #37 (reconciliação como pré-condição de publicação, não como autorização automática de merge). Evidenciar a origem correta do código de cada módulo.

**Fase 1 — quick wins:** #007 → #006 → #005 → #001 → #002. Cada item em PR próprio ou lote pequeno, com check de regressão.

**Fase 2 — recursos moderados:** #008 → #009 → #003. Tema global por último para reduzir conflitos visuais.

**Fase 3 — Loja:** #010 auditoria e correções necessárias → #011 preço/estoque em massa.

**Fase 4 — Campanhas:** #013-A inventário Connect/grupos/filas → B editor full-screen → C formatação/mídia → D seletores Loja/Biblioteca/Comunidade → E publicação e agendamento → F cross-post App↔WhatsApp → G homologação Windows real e push App. Em cada subetapa, não romper a navegação e a esteira.

**Fase 5 — Planos e Alimentação:** #012-A catálogo de recursos e controle manual → B planos e UI de usuário → C cobrança recorrente Mercado Pago em Teste → D ativação controlada PWA → #004 alimentação sem IA → E preparação Apple/Google (sem billing nativo agora). Se alimentação exigir entitlements, catálogo deve anteceder.

**Fase 6 — Fechamento:** auditoria cruzada dos 14 IDs, testes, documentação e aprovação explícita para cada promoção.

## 5. Plano de validação por mudança
- Evidência de origem: SHA base, branch, PR, ambiente, screenshots e contratos afetados.
- Pré-mudança: quais fluxos já funcionam e quais não estão comprovados; inventário de RLS, dados e migrações; testes de base.
- Implementação: delta mínimo, migração nova/aditiva se necessária, feature flag quando viável, rollback.
- Teste: `npm run check`, `npm run build`, testes dirigidos e regressão; Teste remoto quando autorizado, Safari/PWA iPhone, desktop, acessibilidade.
- Produção: somente após reconciliação, homologação, backup/restauração conforme gates aplicáveis e autorização específica; verificar pós-deploy.
- Documentação: atualizar tracker, documento mestre, memória/decisões do módulo, commits, links de PR, pendências e próximos passos na MESMA entrega.

## 6. Lacunas atuais — não declarar concluídas
- Nesta revisão V2 houve consultas autenticadas SOMENTE DE LEITURA a projetos, ledger e catálogo de metadados Supabase e deployments Vercel; não houve inspeção operacional de Windows, sessão WhatsApp ou Mercado Pago, nem envio, novo deploy voluntário, migration ou pagamento.
- A lista de arquivos e os relatórios antigos indicam pontos a inspecionar, não provam comportamento de produção atual.
- É necessário confirmar SHA implantado em Teste e Produção, status real do PR #37, schema e ledger reais, pipeline do Connect e capacidade do bridge instalado.
- Há documentação histórica com estados contraditórios porque foi escrita em datas/branches diferentes; prevalece a evidência mais recente **do mesmo ambiente e commit**, nunca a descrição isolada de uma PR.

## 7. Evidências V2 (24/11/2026; somente leitura)
- Supabase Teste qnuluspqfazdppciermw e Produção cpslafpzjtbpmoxxysaa: status ACTIVE_HEALTHY. Ledger listado com **22** entradas em Teste e **15** em Produção; IDs/nome diferentes e equivalência de contrato não comprovada.
- PostgreSQL information_schema nos dois: neo_private.shop_products.price_cents INTEGER, stock INTEGER; entidades de campanhas, suas publicações WhatsApp e grupos, conexões e seleção de grupos Connect presentes. Não se consultaram dados de usuário.
- Vercel: projeto app-neopep teve deployment target production READY, main fc0ae22, 2026-11-24 09:37 UTC; app-neopep-staging teve target production **dentro do projeto Teste** READY staging/permanente 0970ae6, 01:15 UTC. Apontamento de domínios/custom aliases, Auth, Edge e funcionamento não verificados.
- Commits da PR #40 acionaram previews em dois projetos Vercel; pode consumir quota. Não equivalem a deploy de produção. Considerar agrupar alterações documentais e avaliar filtros de builds (somente após autorização).
- Evidência frontend exata: src/app.js possui appearance light/dark/system, formulário de permissões iniciais, privacyOptions statistics/usage/campaigns/location e requestDeviceLocation; dist/library.js usa PDF canvas com fallback PDF; dist/shop.js.home contém título atual; dist/admin/admin-whatsapp.js consulta catálogo sincronizado com até 30 grupos elegíveis, mas confirma manualmente publicação.
- Para os detalhes operacionais e correções da V1, consultar [auditoria V2](AUDITORIA-REVISAO-2026-11-24.md) e [governança #014](GOVERNANCA-014.md).
