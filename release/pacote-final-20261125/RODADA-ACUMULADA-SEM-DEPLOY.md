# Rodada acumulada de ajustes — NeoPep Teste e Produção

**Data:** 25/11/2026  
**Decisão do responsável:** interromper novas tentativas de deploy na Vercel até concluir os ajustes acumulados. Preparar uma única rodada de publicação por ambiente quando houver cota, após aprovação do pacote; não acionar deploy automaticamente só por haver código novo.

## Situação e escopo aceito

- **Teste:** já contém o pacote final (PR #75) no deployment `caa7ddd`. O código do ramo `homologacao/ciclo-completo-2026-11-24` também recebeu as PRs #76 (frasco visual e capa extraída do vídeo), #79–#80 (criação de contas para testar onboarding e cache) e agora a paleta de contadores numéricos do tema claro. Esses incrementos **não devem ser declarados publicados ou validados visualmente no iPhone** antes do próximo deploy de Teste.
- **Produção:** o deployment no domínio oficial está no commit `e5bbb72`; o pacote posterior da PR #74 está integrado ao `main` (commit `d7f9ffd`), com migrações de banco já aplicadas, mas ainda não entregue no site. A paleta nova deverá ser promovida por mudança isolada ao `main` após homologação de Teste, sem merge indiscriminado de outros segredos, ambientes e funcionalidades experimentais.
- O usuário informou que a nova logo no aplicativo e a correção da cor do player foram aprovadas em Teste; links e prévias de PDF e vídeo já foram vistos, mas a capa automática de vídeo precisa revalidação.
- Não criar contas fictícias, desabilitar verificação de e-mail, disparar campanhas reais ou alterar Mercado Pago, Premium, Loja e IA neste ajuste visual.

## Nova correção aprovada para a próxima publicação

**Contadores com números no tema claro:** usar azul-marinho interno `#142743`, aro/borda `#223F63` e número branco `#FFFFFF`. Afeta a contagem da Comunidade, as abas de mensagens, os atendimentos não lidos, a Loja, as notificações do sino, a contagem na notificação que desce, e a bolinha de novos cadastros. O estado de notícia nova deve usar a mesma paleta. O tema escuro fica intocado. Selos promocionais, estados e alertas não são badges numéricos e ficam fora do ajuste.

## Pendências funcionais a acumular antes do release conjunto

- **Exclusão de campanhas antigas e publicações individuais:** issue #77. Não remover recibos ou auditoria.
- **Recorrência diária com vários horários:** issue #78. Exige controle de idempotência e backend, não só interface.
- **Anexo real PDF/MP4 no WhatsApp:** issue #70. O pacote atual envia capa JPEG e link, não os arquivos originais.
- **Cadastro de novos usuários e onboarding:** PRs #79–#80 permitem cadastro de teste no código; o envio real de confirmação por e-mail, retorno OAuth e sequência inicial precisam validação após deploy. Não abrir cadastro público na Produção.
- **Calculadora:** a PR #76 muda a posição do card, reusa SVG do frasco e carrega a última dosagem; validar em temas claro/escuro, inclusive saldo após aplicação vinculada.

## Checklist para publicar futuramente (dependente de nova autorização)

1. Encerrar o conjunto de ajustes, analisar diffs e rodar CI/testes sem usar Vercel.
2. Gerar **uma candidata de Teste** com branch/SHA corretos, sem envios automáticos. Confirmar que `teste.app.neopep.com.br` aponta para a candidata.
3. Validar no iPhone todos os indicadores numéricos em tema claro e escuro, cadastro de conta nova, frasco e campanhas sem envio real.
4. Levar a versão aprovada à Produção em um único lote próprio, sem transportar configuração ou credenciais de Teste. Verificar hash e alias `app.neopep.com.br`.
5. Preservar constraints e flags financeiras, filas e recibos; somente operar envios após verificação específica de destinos e autorização.

**Status:** escopo visual registrado e aprovado para incluir na rodada; deploys suspensos por decisão do usuário; validação end-to-end pendente.


## Auditoria complementar — contadores numéricos

Após a PR #81, foi feita varredura cruzada do CSS e das telas de Comunidade (incluindo Grupos e Conversas), Atendimento, Loja, notificações e Administração. Identificou-se **um item faltante:** `.nav-community-count`, bolinha com número no menu inferior da Comunidade. A classe foi adicionada à mesma regra de azul-marinho do tema claro, preservando posição, contagem, exibição e tema escuro.

| Local | Seletor identificado | Tratamento |
| --- | --- | --- |
| Comunidade, menu inferior | `.nav-community-count` | Correção complementar incluída |
| Comunidade, atalho/cabeçalho | `.community-badge`, `.has-news` | Já coberto |
| Comunidade → Grupos | `.tab-unread` | Já coberto |
| Comunidade → Conversas | `.tab-unread` | Já coberto |
| Aba selecionada de Grupos/Conversas | `.primary .tab-unread` | Já coberto |
| Atendimento, conversa não lida | `.support-thread-meta b` | Já coberto |
| Loja, menu inferior | `.nav-shop-count` | Já coberto |
| Sino de notificações | `.notification-count` | Já coberto |
| Notificação que desce na tela | `.notification-toast-main > b` | Já coberto |
| Novo cadastro (admin) | `.admin-signup-badge` | Já coberto |

Paleta: fundo `#142743`, aro/borda `#223F63`, número `#FFFFFF`, exclusivamente em `[data-theme=light]`. Não incluir `.status-pill` ou selos promocionais, que não são contadores de mensagens. Testes agora verificam tanto os seletores CSS quanto as classes presentes nas telas reais. **A correção está apenas no código; nenhuma publicação na Vercel ou em Produção foi efetuada.**

## Continuação — ajustes após bloqueio do GPS
- GPS cidade/estado: manter candidata atual, sem publicar enquanto o limite da Vercel estiver ativo.
- Ajuste 01: aviso de novo cadastro no Admin acompanha tema claro, preservando tema escuro.
- Ajuste 02: novo card Meu frasco no Diário de aplicações, antes do histórico. Adicionar frasco abre tela dedicada reaproveitando campos, SVG e resultado da calculadora. Salvar retorna ao diário. Um frasco ativo; saldo por registros efetivamente vinculados, histórico preservado, aviso ao esvaziar, novo cadastro obrigatório antes de novo registro. Edições mantêm vínculo original; exclusões recalculam saldo. Calculadora principal mantém apenas previsão e dosagens salvas.
- Limitação da candidata: frascos e vínculos continuam no armazenamento local, isolado por conta, como no recurso anterior. Não há sincronização entre aparelhos nem garantia de concorrência entre dispositivos; não apresentar como saldo físico confirmado. Planejar persistência transacional em nuvem antes de liberar o recurso como acompanhamento sincronizado.
- Testes focados do arquivo vial-cover-regression: seis casos conferidos em execução isolada. Suíte Node completa e validação no iPhone pendentes.
- Prioridades 2 e 3 da lista anterior: deliberadamente adiadas; fora do pacote atual.
- Deploy automático da branch GPS desativado. Nenhum deploy solicitado nesta rodada. Ordem de publicação mais recente solicitada pelo usuário: Produção e depois Teste, com candidatas específicas e preservação das configurações de cada ambiente; não publicar enquanto houver bloqueio ou sem nova instrução.

## Ajuste 03 — Reformulação da Central de Campanhas (App e WhatsApp)

### Candidata implementada nesta rodada, ainda sem deploy
- 03.01: cabeçalho da campanha destacado, ícones de renomear/arquivar/excluir com rótulos acessíveis; publicação com data à esquerda e menu de três pontos, seleção compacta para agendar e botão Adicionar publicação acima da agenda; filtro de data compacto.
- 03.02: painel compartilhado do editor ampliado a aproximadamente 65% da altura útil (45% para viewport baixo/teclado), rolagem interna, desfazer exclusão acima da composição, formatação duplicada removida do menu; riscado e monoespaçado aparecem ao expandir.
- 03.03: buscas principais de campanhas, catálogo, grupos e anexos com lupa; Biblioteca em grade de cards quadrados com título, tipo e miniaturas progressivas (imagem, primeira página PDF ou quadro de vídeo quando disponível/autorizado). Sem expor URL privada como link público.
- 03.04: Programar/Publicar acionáveis para explicar pendências; se necessário salva revisão automaticamente antes da confirmação; mantém verificação de autorização, revisão, canal e destino. Nenhum envio automático no simples ato de salvar. Arquivos integrais não suportados permanecem bloqueados para despacho. 
- 03.05: prévia local de PDF/TXT no editor com nome, tamanho, conteúdo inicial ou capa e acesso local ao original; não implica armazenamento remoto ou entrega integral.
- 03.06: recorrência com seletores nativos em cards, + horário, padrão inicial derivado da publicação/data local, até oito horários diários e um horário semanal nas regras novas; regras antigas com vários horários semanais são preservadas. Contrato existente de no máximo 24 ocorrências/89 dias preservado.
- 03.07 parcial: editor estruturado App com card central de prévia, título e botão Fechar ilustrativo; seleção de público no editor já existe, mas homologação restringe a audiência e não envia push. Ainda não representa o novo renderer App completo de múltiplos blocos. O fluxo legado permanece disponível, sem regressão deliberada nas permissões de publicação.

### Pendências específicas para concluir o Ajuste 03 (não confundir com Prioridades 2 e 3 anteriores, adiadas)
- 03.08: campanhas App com a mesma hierarquia campanha/publicações, agenda, histórico e editor compartilhado do WhatsApp; card de notificação fiel ao renderer real, com tipos de conteúdo autorizados. Migrar/reaproveitar configurações existentes de popup na abertura, frequência, máximo de exibições, dias, período, plano/público e push. Push pode chegar com app fechado ou aparelho bloqueado, sujeito a permissões e disponibilidade do dispositivo; não quando está desligado.
- 03.09: duplicação integral App ↔ WhatsApp, bidirecional, preservando campanha, publicações, mídia autorizada, datas, recorrências e origem; adaptar apenas destino/configuração específica do canal. Criar como rascunhos com horários copiados, sem disparar envios nem ativar agendamentos até confirmação explícita. Precisa de RPC transacional, autorização e idempotência, com revisão de mídia e vínculo de origem. O atalho existente copia apenas texto de uma publicação e agora informa a limitação; não representa a duplicação integral.
- 03.10: fila compartilhada entre administradores: auditoria encontrou fila manual no admin-whatsapp.js (preparar compartilhamento e confirmar após envio) e estados da fila estruturada por publicação na Central; Connect usa claim/start/finish com fence. Unificar visão das duas filas, com autorização server-side para outro administrador revisar/liberar, histórico de responsável/horário, concorrência/idempotência e sem reenvio automático de resultado incerto.
- 03.11: recorrência com horário diferente por dia da semana. Contrato atual de servidor aceita frequência/dias/horários comuns e valida datas derivadas; ampliar o modelo e validação transacional antes de oferecer a regra nova, preservando séries antigas, cancelamentos e limite de ocorrências. Não simular regra que servidor não consegue persistir.
- 03.12: envio integral de PDF/MP4 e demais documentos permitidos pelo WhatsApp. Revisão de connect/windows/Connect.cs mostrou LoadRichCampaignJpeg restrito a JPEG privado de até 1 MB, com processamento rico apenas em Teste e despacho de texto/link/produto e imagem JPEG. Não há contrato de transferência integral PDF/MP4 nesta rota. Implementar armazenamento privado autorizado, validação MIME/tamanho, compatibilidade do bridge/Connect, recibos e teste isolado; preservar controles de ambiente e destino. Não enviar dados reais nesta etapa.

### Verificação desta rodada
- 17 verificações focadas executadas (sintaxe JS, datas locais/São Paulo, recorrência, menu, painel, catálogo, gate e bloqueio de envio não suportado, prévia App, bloqueio automático do deploy).
- Testes de navegador adaptados ao menu de três pontos e catálogo visual, e regressões do pacote atualizadas. Suíte completa e teste visual iPhone/Windows ainda pendentes; não afirmar homologação integral.
- Cache PWA v53-campanhas-central e versão de assets Admin campanhas-central-3. Nenhum deploy solicitado, nenhuma migração aplicada, nenhum envio real disparado. Branch permanece com deploy automático desativado. Manter pagamentos, IA e demais serviços em funcionamento sem alterações neste ajuste.


## Continuação do Ajuste 03 — integração das campanhas (cache v54)
- Recorrência: horários individuais para dias selecionados em `campaign-central.js` e patch `campaign_weekday_times.sql`. Seis casos de lógica JS aprovados, incluindo regras antigas e entradas inválidas. A consulta SQL somente leitura confirmou as ocorrências de uma regra personalizada; a função alterada ainda não foi instalada/testada integralmente.
- Central App: candidata `campaign_app_central_candidate.sql` e interface compartilhada, com campanha/publicações, edição, agenda, duplicação individual, cancelamento, exclusão lógica e consulta de estado para homologação. Sem ampliação de audiência ou push em Teste. A interface antiga permanece se o contrato não estiver instalado.
- Cópia App ↔ WhatsApp: candidata `campaign_cross_channel_candidate.sql`. Transação com verificação de proprietário, idempotência, origem, publicações salvas, blocos, datas e referências de mídia disponíveis. Regras de recorrência de origem são conservadas para consulta e ocorrências existentes como rascunhos; não ativa uma regra nova automaticamente. Destinos são revistos. Anexo local sem original remoto bloqueia a cópia integral em vez de descartar conteúdo.
- Fila: candidata `campaign_shared_queue_candidate.sql` e visualização administrativa consolidada de estados manuais/Connect, somente leitura. EXPLAIN da consulta confirmou que a expressão é compatível com o esquema atual do Teste; não equivale à homologação do RPC. Ainda não permite outro administrador liberar envio.
- Verificação: 15 checagens focadas (incluindo os seis casos de recorrência), sintaxe dos quatro JS administrativos e guardas estáticas. Acrescentado `tests/campaign-integration-candidate.test.cjs` para regressão futura. Suíte completa, testes de navegador e Windows não confirmados.

### Ordem dos patches candidatos (somente Teste, antes de ativar UI)
1. Confirmar presença do contrato anterior de recorrência (`20261125223000_campaign_recurrence_times.sql`).
2. Ensaiar `campaign_weekday_times.sql`.
3. Ensaiar `campaign_app_central_candidate.sql`.
4. Ensaiar `campaign_cross_channel_candidate.sql`.
5. Ensaiar `campaign_shared_queue_candidate.sql`.
Todos exigem validação em ambiente isolado, checagem de privilégios e RLS, rollback, testes positivos/negativos de autorização e idempotência, e comparação de produção. Não aplicar SQL de Teste diretamente em Produção; há restrições de emissor JWT e contratos exclusivos de homologação. Nenhum patch foi aplicado aos ambientes nesta rodada.

### Bloqueadores restantes — não considerar pacote pronto apenas para deploy
- Renderer real de notificações App com mídia e opções persistentes por publicação (popup, público/planos, frequência, push e recorrência App); integração de produção.
- Envio de originais PDF/MP4 no armazenamento privado, backend, bridge e Windows Connect, com recibos e testes; a rota atual continua JPEG/texto. Cópia de arquivos locais ainda bloqueada.
- Liberação por outro administrador: fluxo explícito de autorização/revisão, registro do responsável e prevenção de duplicidade; a consulta da fila já existe como candidata, mas não delega envio.
- Testar os quatro patches como unidade, suite completa, validar iPhone/Windows, preparar candidatas de Produção e Teste sem sobrescrever integrações existentes. Manter prioridades 2 e 3 anteriores adiadas.
- Nenhum deploy Vercel solicitado, sem envio de mensagens, sem mudanças persistentes no Supabase. Branch permanece com deploy automático desativado.


## Rodada de verificação e extensão — cache v55

### Resultado comprovado
- Ensaiados conjuntamente, dentro de subtransação revertida no Supabase Teste, os sete patches candidatos: weekday_times, app_central, cross_channel, shared_queue, manual_claim, originals e app_settings (na ordem abaixo). O ensaio estrutural final passou após correção de sintaxe em originals. Consulta posterior confirmou ausência de tabelas/funções/bucket novos e das campanhas fictícias: nenhuma mudança persistente.
- Fluxo fictício de App create/save/get, cópia App→WhatsApp→App, identificação de origem, data e idempotência ensaiado com rollback; nenhum lote de envio criado. 
- Reserva manual: reserva exclusiva por ocorrência e token, segundo token rejeitado, prepare/confirm exigem reserva, liberação exige confirmação de não envio; confirmação duplicada rejeitada e resultado registrado. Ensaio com fixture e um administrador existente, dois tokens. Teste com dois administradores reais e dois computadores ainda pendente. A reserva não impede compartilhamentos externos fora do app, nem transfere a titularidade de conexões sincronizadas ou envios automáticos Connect.
- Originais: candidata de bucket privado, RLS por proprietário/admin, validação de MIME, extensão, nome e tamanho, armazenamento e prévia PDF/MP4 no editor, transporte IPC/Windows/bridge e fila com capacidade explícita do worker. Limite inicial 5 MiB; TXT permanece local e referência da Biblioteca mantém o fluxo de capa/link. Gate originals_enabled=false por padrão. Código Windows ainda não compilado/testado no computador. Sem envio real, sem upload real de documento e sem ativação de gate.
- Configurações App: edição de público/planos/segmentos, popup/push, frequência, limite, prioridade, dias, janela e encerramento. Campos persistidos em app_settings na candidata; Teste continua restrito à allowlist e sem push. SQL candidato de elegibilidade de exibição e contador; validação de forma da regra (válida, frequência 0, público sem destinos e janela invertida) ensaiada. Renderer rico e entrega real ainda não homologados.
- Verificação de sintaxe dos quatro JS administrativos e regressões adicionadas ao bridge. A suíte Node integral e a compilação Windows não foram confirmadas. O bundle dist/cloud.js deve ser regenerado pelo build a partir de src/cloud.js.
- Produção consultada somente para leitura: funções existentes diferem de Teste, Connect oficial usa versão 0.2.13, enquanto o contrato de Teste exige 0.2.12. Configuração de despacho estruturado App/WhatsApp em Produção desativada; não alterar esses gates implicitamente. Os SQL abaixo são candidatos de Teste, NÃO executar em Produção sem adaptação e ensaio próprios.

### Ordem candidata de integração (somente Teste)
1. campaign_weekday_times.sql
2. campaign_app_central_candidate.sql
3. campaign_cross_channel_candidate.sql
4. campaign_shared_queue_candidate.sql
5. campaign_manual_claim_candidate.sql
6. campaign_originals_candidate.sql
7. campaign_app_settings_candidate.sql

### Bloqueadores de publicação integral
- Adaptar e ensaiar separadamente contratos SQL de Produção, preservando o fluxo legado de campanhas, pagamentos, IA, notificações e as regras de autorização. Consolidar a candidata de Produção com o código mais recente sem copiar a configuração de Teste.
- Entrega App: renderer rico de múltiplos blocos com acesso autorizado à mídia, ativação das opções e push via mecanismos existentes, público/planos reais em Produção, recorrência App na agenda. Teste de exibição repetida com usuário autorizado ainda pendente.
- Envio integral de PDF/MP4: gerar e testar instalador Connect versionado, alinhar gates/versões de cada ambiente, validar upload/download privado, bytes no recebimento e recibo, testar casos de indisponibilidade. Gate permanece fechado.
- Fila: delegação explícita de aprovação/despacho automático entre administradores e conexões sincronizadas ainda pendente; reserva manual já preparada. Não contornar ownership.
- Executar suíte completa, teste visual iPhone, Windows e teste de integração em ambiente isolado. A sincronização do diário de frascos entre aparelhos ainda permanece pendente (saldo local).
- Deploy automático continua desativado. Nenhum deploy ou mensagem real disparado. Prioridades 2 e 3 anteriores continuam adiadas. Publicação solicitada continua Produção → Teste, somente depois de concluir a preparação e receber autorização de deploy.
