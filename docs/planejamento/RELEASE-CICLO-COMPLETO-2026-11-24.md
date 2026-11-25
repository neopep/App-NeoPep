# Consolidação de homologação — ciclo 24/11/2026

## Escopo solicitado
Incorporar **todos os ajustes com código implementado neste ciclo**: 001, 002, 003, 005, 006, 007, 008, 009, 010.04/05/06, 011, 013. Partir do commit `77fe00c5a14d9a2bf0b58e50c41045ae6def658a` que inclui a cadeia de Loja 010/011, preservando o comportamento aprovado do Mercado Pago/checkout.
As PRs originais devem permanecer separadas e rastreáveis, sem merge para `main`, `staging/permanente` ou ambientes de Produção neste preparo.

## Gates
- Branch `homologacao/ciclo-completo-2026-11-24` tem `git.deploymentEnabled=false`, e nenhum deploy deve ocorrer antes de validação de conflitos/testes.
- SQL da Biblioteca #008 e consentimento #002 ainda **não aplicado** em Supabase Teste. Exigir preflight, aprovação expressa e verificação ACL antes da publicação da UI que depende dessas RPCs.
- Os SQLs #010/#011/#013 estão **somente no Teste**; Produção não está preparada. Não publicar frontend em Produção sem migrar e validar de forma separada.
- #013: envio agendado, worker/push e despacho automático continuam desativados; não fazer envios reais nem novas permissões.
- #004/#012/#014: sem novas funcionalidades elegíveis para esse lote, manter backlog.
- Reconciliar `dist/app.js`, `src/app.js`, `dist/cloud.js`, `src/cloud.js`, `dist/community.js`, `dist/style.css`, `dist/sw.js`, `scripts/build-staging.cjs`, `tests/staging-pwa.test.cjs` com integração sem perdas.
- Executar testes do projeto, PWA, autenticação, consentimentos, biblioteca/admin, loja/estoque/custos, campanhas e Connect; validar desktop e mobile após deploy de Teste.
- Enviar a produção somente após aceite de Teste, migrações remotas de Produção autorizadas, rollback e plano seguro.

## Estado
**Em consolidação técnica; nenhum deploy ou merge de produção.**

## Auditoria da PR #61

Base financeira publicada registrada: `43e31df`. Base da revisão: `4158d4e` na branch `homologacao/ciclo-completo-2026-11-24`. Foi reutilizada a PR #61. A ancestralidade Git confirma as origens abaixo. As correções de conflitos preservam os controles das duas cadeias nos arquivos compartilhados.

| Etapa | PRs e commits de origem | Evidência da candidata | Gate de liberação |
|---|---|---|---|
| #001 Localização | #45 `cf3483f` | Onboarding precede #002 e exige ação explícita | Conferir opção de ambiente e permissão nativa em sessão de Teste |
| #002 Personalização | #46 `bd0c64d` | Consentimento específico e revogável, com fallback quando o serviço falha | Confirmar RPC e ACL. Sem RPC confirmada, etapa fica indisponível |
| #003 Aparência | #44 `00ef2d4` | Preferência, sistema e bootstrap do tema em Chromium | Validar Safari/PWA instalada |
| #005 Comparações | #47 `3483731` | Testes do seletor, prévia e fluxo de cópia privada | Conferir grupo autorizado em Teste |
| #006 Miniatura PDF | #41 `0087a15` | Miniatura proporcional e abertura em Chromium desktop, iPhone 13 e Pixel 7 emulados | Verificar material privado real na Biblioteca de Teste |
| #007 Loja e atendimento | #48 `facee60` | Vitrine e atalho preservados com contexto de conta, testes de Loja | Verificar canal oficial em Teste |
| #008 Fixação | #42 `d76ae73` | Ordem, permissões e controles validados pela suíte. A UI depende de `pins_ready` | Confirmar catálogo e RPC, manter controles ocultos até disponibilidade |
| #009 Seringa na Home | #43 `b66569b` | Seringa reutilizada e dados locais segregados por conta, suíte da calculadora | Conferir conta com e sem cálculo salvo em Teste |
| #010 Financeiro | #53 `43e31df`, #54 `5a53489` | Editor, dashboard, conciliação e rollback exercitados localmente | Conferir ledger e permissões financeiras do Teste |
| #011 Gestão em massa | #55 `77fe00c` | Navegador e PostgreSQL com concorrência de lote e checkout | Conferir RPC, auditoria e estorno de lote em Teste |
| #013 Campanhas | #56 `f0ed98a`, #57 `088ee45`, #58 `3109acd`, #59 `fa25bd1` | Editor desktop/mobile, filas e Bridge com infraestrutura isolada | Limitar release web ao editor/revisão. Manter agendamento e despacho externos desativados |
| #004, #012 e #014 | Fora da integração funcional | Governança #014 aplicada à auditoria | #004 e #012 ficam no backlog |

### Correção e preservação

A compilação limpa detectou `dist/app.js` desatualizado em relação a `src/app.js`: faltavam o controle de tema na Home, o contexto autenticado do atalho de suporte e as transições de personalização no onboarding. O bundle foi regenerado. A CI da candidata agora reprova divergência entre os bundles recompilados e o Git. O cache PWA continua incluindo tema, editor de campanhas e visualizador de vídeo.

O diff desde `43e31df` preserva todas as Edge Functions. As migrações direcionadas de Loja são idênticas às da PR #55 e os arquivos Windows e de despacho são idênticos aos da PR #59. Navegador verificou visibilidade por membro na vitrine e no gerenciamento. O PostgreSQL verificou compatibilidade com checkout concorrente e hashes das funções legadas. O relato de 0.2.10 já instalado em ambos os ambientes é informação operacional fornecida pelo proprietário. O último registro da PR #59 descreve um rascunho assinado de Teste, portanto instalação e sessão atuais carecem de evidência nova nesta auditoria.

### Testes executados

- Build e check passaram. O empacotamento de prévia e os 425 testes da suíte passaram.
- Seis ensaios PostgreSQL 17 isolados passaram: editor e dashboard financeiro, conciliação, edição em massa, editor de campanhas e despacho. Houve verificação de permissões, concorrência, rollback e preservação dos contratos legados. As migrações #002 e #008 também são cobertas pela suíte local.
- Nove ensaios Chromium passaram: aparência, campanhas, miniatura PDF, vídeo, visibilidade na vitrine e no gerenciamento, custos, dashboard e gestão em massa. Os fluxos mobile usaram emulação quando prevista pelo teste. O teste de vídeo usou MP4 real e iframe simulado.
- Oito testes de Bridge e diagnóstico de sessão passaram com provedor simulado ou inspeção de contrato. Nenhum envio real, pagamento, nova compilação Windows ou mudança em sessão instalada.

### Dependências e recuperação

| Contrato | Arquivo no Git | Estado remoto |
|---|---|---|
| Fundação, editor e dashboard financeiro | `release/shop-finance/` e baseline #53 | Teste registrado como instalado no ledger pelos identificadores 20261124164148, 20261124170927 e 20261124172822 |
| Conciliação e lote | `release/shop-reconciliation/20261124220000_shop_reconciliation.sql`, `release/shop-bulk/20261124230000_shop_bulk.sql` | Instalação em Teste informada. Conferir prefixo real e fingerprint. Produção pendente de conferência |
| Campanhas | `release/campaign-editor/20261124233000_campaign_editor_versions.sql`, `release/campaign-dispatch/20261124234500_campaign_dispatch.sql` | Estrutura em Teste informada. Confirmar cada contrato e flags separadamente |
| Fixação | `supabase/migrations/20261124140000_library_pins.sql` | Não confirmada em nenhum ambiente |
| Consentimento | `supabase/migrations/20261124150000_personalization_consent.sql` | Não confirmado em nenhum ambiente |

O preflight em `release/cycle-20261124/preflight.sql` consulta apenas catálogo para #002/#008. Foi executado antes e depois dos dois SQLs no PostgreSQL 17.12 isolado. Confirmou as dependências, RLS e os grants esperados, incluindo ausência de execução anônima da RPC de personalização e ausência de execução direta da função privada de fixação para clientes. Antes de uma futura alteração autorizada, conferir o ledger e capturar DDL, grants e backup no ambiente correto. Para recuperação de #008, restaurar a definição anterior de `public.neo_library_v25(text,jsonb)` a partir do catálogo capturado e preservar posições e auditoria. Para #002, voltar a interface e suspender execução da RPC se necessário, preservando eventos de consentimento. Não apagar histórico nem importar dados de Teste. Para Loja e Campanhas, usar preflights e rollbacks versionados, com recuperação ensaiada antes de qualquer mudança oficial.

### Liberação

1. O proxy retornou 403 para o Vercel, domínio de Teste e projetos Supabase. Retomar com acesso de leitura para confirmar Vercel, alias, variáveis, SHA e artefato READY de recuperação. O bloqueio Git de deployment automático está presente. A configuração efetiva dos projetos falta confirmar antes do push da correção, conforme a política do Plano Mestre.
2. Validar ledger, contratos, papéis, RLS e os valores `whatsapp_enabled=false`, `app_enabled=false` e `paused=true` no destino. Obter autorização específica se faltar SQL. Manter interfaces dependentes indisponíveis até confirmação.
3. Atualizar a PR #61 e aguardar CI no SHA final. Fazer um único deploy em `app-neopep-staging` após confirmar configuração, dependências e recuperação. Validar READY, SHA, marca TESTE, autenticação, PWA e módulos.
4. Produção exige aceite da candidata de Teste, preflight próprio, evidência de backup e recuperação, autorização específica para migrações e confirmação do proprietário para promoção. Preservar domínio, Auth/callbacks, Mercado Pago, Storage e a sessão Windows, mantendo as flags de despacho desligadas.

Nenhuma migração, ativação de worker, envio, merge ou implantação foi executada nesta auditoria.

## Retomada da liberação integral

- Bases Git verificadas novamente: PR #61 `4158d4e`, revisão local anterior `06b7b1a`, `staging/permanente` `0970ae6`, `main` `fc0ae22`. As pontas das PRs #41–#59 coincidem com o inventário da candidata.
- A regressão do editor agora analisa o HTML real de administração. Confere resolução local do asset, existência, ordem de execução antes de `admin.js`, versões de cache e presença no service worker. O ensaio de navegador cobre o editor com dependências simuladas. A API de Actions retornou 403, portanto o resultado do run remoto anteriormente reprovado não pôde ser consultado.
- O ensaio de merge em memória com `main` mostrou conflitos em configuração, fontes/bundles, service worker, painel e Windows. A correção oficial de notificações privadas (`fc0ae22` e antecedentes) toca `dist/push.js`, `dist/sw.js` e `push-dispatch`. A promoção exige reconciliação seletiva do delta das 11 etapas sobre o baseline oficial, com preservação das notificações, Auth, CSP e Edge Functions oficiais. O webhook tem diferença entre as duas pontas e deve ficar ancorado ao oficial. O build da candidata da PR #61 está isolado no projeto Vercel de Teste.
- Teste e Produção continuam com estado remoto não revalidado. As consultas aos dois Supabase, ao domínio de Teste e à Vercel retornaram 403 do proxy, inclusive na tentativa de leitura fora do sandbox. Antes da publicação, obter acesso de leitura aos dois projetos Vercel e aos catálogos dos dois Supabase, conferir configuração efetiva de auto-deploy, ledger, permissões e flags. Registrar backup restaurável antes de mudanças oficiais.

### Correção do gate #001

O cliente preserva o consentimento e a revogação pelas RPCs autenticadas. O backend de origem aproximada valida o JWT no projeto de Teste e usa a RPC `neo_geo_observe`, restrita à credencial de servidor e condicionada ao consentimento ativo. O endpoint passa a aceitar o modo `geo` também na branch da PR #61. Snapshot e cron continuam restritos à branch anterior. O projeto `app-neopep-staging` tem a flag ativada e a credencial sensível do próprio Supabase configurada apenas no seu alvo de publicação. O build usa a presença da credencial para o gate e serializa apenas o booleano.

### Ordem para a futura promoção oficial

1. Reconciliar os deltas aprovados com a ponta oficial, conservando webhook, checkout, notificações, Auth/callbacks, CSP e configuração PWA. Reexecutar a CI dessa composição.
2. Capturar o ledger e o DDL oficial, com fingerprints de funções e ACL, e inventariar dados e objetos privados sem copiá-los para Teste. Gerar backup protegido de banco, Auth e Storage e restaurar em destino isolado, verificando contagens, hashes de objetos, RLS e integridade de pedidos.
3. Confrontar cada SQL com o catálogo restaurado. Ensaiar #002/#008 separadamente. Na Loja, Fundação → Editor → Dashboard → Conciliação → Gerenciamento em massa. Em Campanhas, validar a infraestrutura oficial existente antes de Editor → Despacho. Manter flags de despacho desligadas e Connect pausado.
4. Ensaiar pós-verificação e rollback na cópia restaurada. Só aplicar o delta aprovado após homologação e autorização específica. Ter a versão web anterior pronta para recuperação e preservar o histórico dos registros aditivos.

### Refinamento pós-homologação

- Loja · título da vitrine alinhado ao título aprovado na Home.
- Aparência · controle de três ícones no cabeçalho, preferências existentes e identificação TESTE harmonizada no tema claro.
- Conversas · miniatura local mantém compositor e foco durante seleção; JPEG validado antes do envio. HEIC/HEIF usa os decodificadores do navegador e apresenta erro acionável se o formato não estiver disponível. A RPC aditiva `neo_support_inbox_v1` retorna somente texto curto, tipo e nome dos anexos autorizados, sem expor paths ou URLs. O cliente mantém fallback para a listagem anterior.
- Campanhas · composição, edição e prévia compartilham o diálogo de conversa. Configurações e catálogo aparecem em painéis inferiores. A simulação segue a estrutura de blocos e sinaliza anexos fora do despacho automático. As flags de despacho e a autorização do servidor permanecem obrigatórias.
- Banco de Teste · conferir `neo_support(text,jsonb)`, `neo_support_access(uuid)`, RLS de anexos e ausência da nova RPC antes de aplicar `20261124235500_support_inbox_previews.sql`. O SQL adiciona uma função. O artefato anterior é compatível com essa função presente. A reversão de schema, se autorizada e necessária, consiste em remover exclusivamente `public.neo_support_inbox_v1()` e recarregar o PostgREST.
- Verificação física em Safari/iPhone PWA, sessão autenticada e envio real permanecem separados dos ensaios automatizados.

### Refinamento definitivo da composição e tema claro

- O editor abre pela nomeação do rascunho. O cabeçalho resume os grupos selecionados e concentra o salvamento. A seta do compositor confirma um bloco e o avião da barra solicita confirmação de publicação. Painéis contextuais participam do layout, e o modo leitura compartilha os balões.
- Fotos locais aceitam até 25 MiB dentro da capacidade do navegador. Há qualidade Otimizada, HD e Original para formatos legíveis. HEIC/HEIF depende de decodificação nativa e informa a alternativa em JPEG quando indisponível. O contrato de despacho continua exclusivamente textual. O preço e a visibilidade de produtos são reconsultados no catálogo. A miniatura assinada aparece somente no editor e fica fora do rascunho e do despacho. O link HTTPS respeita as exigências de acesso da Loja.
- Os gradientes e contornos da calculadora usam tokens responsivos ao tema. A matemática permanece a mesma. A identificação TESTE usa o fluxo de layout, com indicação no cabeçalho do compositor.
- Homologação de despacho: App e WhatsApp estão desabilitados no Supabase Teste. O público App é definido por plano ou por todos, sem coorte exclusiva de homologação. O Connect está pausado. A confirmação real permanece condicionada ao contrato e às permissões existentes. O modo Simular exercita a preparação de forma local e não cria campanha nem agendamento.
- A RPC de prévias de conversas do lote anterior consta no ledger de Teste como `20261124233537_support_inbox_previews_20261124`. Este refinamento não exige SQL adicional.

### Homologação isolada de publicação e agenda

A migração direcionada `release/campaign-homologation/20261125020000_campaign_homologation.sql` adiciona uma caixa App exclusiva de Teste. O servidor exige autenticação com emissor do Supabase Teste, administrador para gravar, uma versão App própria, confirmação e a revisão da lista privada. Cada versão aceita um lote. A repetição do mesmo pedido devolve seu ID. Os destinatários são fixados no registro e revalidados antes de oferecer ou confirmar a exibição. A config nasce desligada e a lista nasce vazia.

A entrega ocorre quando a conta autorizada consulta o app aberto, a partir do horário definido em São Paulo. A consulta não exige worker ou cron. O histórico diferencia programada, disponível, oferecida, exibição confirmada, cancelada, revogada e expirada. A exibição confirmada é um recibo do cliente e não mede leitura humana. A campanha vence após 24h. Esta caixa não entra na fila legada, não gera push e não aceita links, anexos ou referências.

Pré-verificar o catálogo com `preflight.sql` exclusivamente no projeto `qnuluspqfazdppciermw`. A aplicação de SQL exige autorização específica. Mesmo depois de migrar, vincular apenas contas dedicadas e conferir o emissor das sessões em homologação antes de autorizar a ativação. O rollback desativa o recurso e revoga execução das duas RPCs, preservando registros. Deixar as flags legadas desligadas.

WhatsApp permanece simulado em Teste. O contrato atual aceita texto e exige versão, grupo elegível, Connect recente com Bridge capaz, sessão pronta e pausa desativada. O catálogo identifica grupos sincronizados e sua elegibilidade técnica, sem comprovar autorização para disparo real. Mídias e referências não entram na esteira real. Liberar um ensaio externo requer aprovação específica e uma lista separada de grupos dedicados, sessão e dispositivo comprovados.

### WhatsApp real para um único grupo de homologação

A migração dirigida `release/campaign-wa-homologation/20261125023000_campaign_wa_homologation.sql` preserva o worker instalado e adapta somente âncoras conhecidas das duas RPCs de despacho. A allowlist é uma linha privada e admite um único par conexão/grupo associado ao proprietário autorizado. Ela nasce vazia e desligada. O servidor exige emissor do Supabase Teste, revisão própria, confirmação, texto sem links de até 160 caracteres e destino único. A mesma revisão só pode formar um lote. A seleção, a reserva e o início revalidam o grupo. O worker só consulta lotes marcados como homologação. As flags globais de App e WhatsApp não são alteradas.

A fonte assinada do Windows 0.2.10 (`148f68f927b9b128dcd5518b97dc6ab69f8980cb`) já contém o worker `wa-text-v1`. O heartbeat de despacho depende de perfil Teste, opt-in de processo `NEO_CONNECT_CAMPAIGN_WORKER=1`, aprovação, janela WhatsApp aberta e conexão vinculada. A sessão precisa de Bridge ligado e grupos lidos. Um heartbeat administrativo recente não comprova esses requisitos. Configuração do processo Windows e prontidão real precisam ser confirmadas na instalação de Teste.

Gates de operação após autorização específica: aplicar a migração desligada no projeto `qnuluspqfazdppciermw`, comprovar a presença de despacho, preencher o vínculo aprovado, ativar apenas a allowlist e avaliar a retirada autorizada da pausa do Connect de Teste. A pausa é compartilhada com o caminho legado de tarefas e deve ser revisada junto ao inventário de pendências. A primeira mensagem real só é criada após confirmação do administrador no editor. O sistema distingue aceite do cliente por recibo, resultado incerto e falha. Validar o recebimento explicitamente no grupo. A autorização por lote e a flag de agenda específica só habilitam a programação após um recibo de publicação imediata nesse grupo. Mídia, legendas e produtos continuam em prévia local.

A reversão desliga a allowlist, cancela pendências desse recorte, marca tentativas iniciadas como incertas e restaura as definições anteriores das duas RPCs com a flag legada desligada. Mantém o histórico. A reversão não recupera uma mensagem já encaminhada ao provedor.

### Refinamento de Perfil, calculadora e editor de campanhas

O seletor Claro, Sistema e Escuro fica no cabeçalho do Perfil e reutiliza a preferência existente. A calculadora identifica o volume do diluente, explica a necessidade de informar o volume final efetivo e oferece passo de 0,1 mg no slider de dose. As notificações do tema claro usam o contraste da paleta atual.

O compositor mantém o fundo estável, dispõe os painéis acima da área de digitação e renderiza as legendas nos blocos correspondentes. O texto provisório pode ser movido ou usado como legenda. Produtos, materiais e publicações reutilizam as consultas autenticadas existentes. A pesquisa da Comunidade cobre as publicações devolvidas pelo feed autorizado. URLs temporárias de prévia ficam fora dos rascunhos persistidos.

Verificação local com build, check e 437 testes automatizados. Os ensaios Chromium com dados simulados cobriram desktop, iPhone 13 e Pixel 7 emulados. Safari nativo, teclado físico de teste em iPhone e PWA instalada permanecem para homologação. Este refinamento não requer novas migrações nem modifica as autorizações de despacho.

### Etapa 014 — Central Unificada de Campanhas

Campanhas WhatsApp, publicações e mensagens passam a ter navegação e armazenamento próprios no painel de Teste. O editor aprovado continua compondo uma publicação por vez. A agenda agrupa horários de São Paulo e o histórico diferencia cancelamento, falha, incerteza e aceitação pelo cliente. Duplicar e distribuir datas cria rascunhos. Só uma confirmação explícita pode solicitar despacho por Connect. Publicações manuais continuam acessíveis pelo fluxo legado e o canal App permanece independente.

O inventário inicial de Teste encontrou duas campanhas WhatsApp legadas, um registro estruturado, nove revisões, dois lotes ricos e três mensagens. Aplicação, pós-verificação e reversão estão em `release/campaign-central/`. A Etapa 015 segue fora deste release.
