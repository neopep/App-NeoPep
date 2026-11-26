# Candidata oficial NeoPep — 25/11/2026 — sem deploy

## Base e evidências
- Branch `preparacao/campanhas-producao-20261125`, criada da main sincronizada (db313cf5be06a89f98dcef54d9e3ac09f929e43c). Autodeploy desativado desde o primeiro commit 99e3f730904404eb2daff717a29e444802790a72. Não alterar PR #83, main ou release ativo.
- A candidata Teste `fix/gps-cidade-estado-teste-20261125` permanece independente. GitHub Actions [45742562983](https://github.com/neopep/App-NeoPep/actions/runs/45742562983), SHA 0456332e75fe1d580087d76daefc964fbb3b67d9: build, check e 471/471 testes aprovados. Corrigidas duas asserções obsoletas (lista de tipos inclui file condicionado ao gate e CSS com query de cache). A suíte não comprova envio real.
- Connect dual-profile 0.2.14: [CI 45742690897](https://github.com/neopep/App-NeoPep/actions/runs/45742690897), SHA 543a5acc3c94470a0a5609f3c69c9549e22f6b21. Contratos, dependências/auditoria, testes de bridge, compilação Windows e manifesto aprovados. Instalador não assinado, distribuição proibida. Não importado no canal de atualização. Preservada a compatibilidade com 0.2.13 no SQL candidato para texto/JPEG; originais exigem 0.2.14, capacidade originals_v1 e autorização explícita. Repetição de ID de arquivo na mesma sessão bloqueada, inclusive após resultado incerto; não é deduplicação persistente do bridge. Gate original desativado.
- Portados editor, central App/WhatsApp, popup rico, APIs de originais e estilos selecionados, preservando configuração oficial, destinos múltiplos autorizados, polling de estados e fallback legado. PWA candidato oficial com cache 57. Não foi feito merge integral da branch Teste. Cópia entre canais aparece somente após confirmação do contrato copy_capabilities.
- CI web oficial separado criado: [execuções](https://github.com/neopep/App-NeoPep/actions/workflows/campanhas-producao-ci.yml). Resultado final ainda não confirmado no momento do registro. Regenerar bundle dist/cloud.js pelo build.

## Ordem de scripts candidatos exclusivos de Produção
1. campaign_official_app_popup_candidate.sql
2. campaign_official_app_central_candidate.sql
3. campaign_official_weekday_times_candidate.sql
4. campaign_official_cross_channel_candidate.sql
5. campaign_official_originals_candidate.sql

Os cinco foram ensaiados juntos em Teste, carregando temporariamente definições atuais de Produção e reproduzindo estrutura da tabela campaign_wa_official_config e limite de 180 mensagens. Uma primeira simulação falhou por ausência dessa tabela; a segunda passou. Cópia App→WhatsApp→App de rascunho com data e origem, detecção de capacidade, presença de recorrência por dia e gates de originais desativados verificados. Rollback confirmado por consulta posterior (sem tabela, bucket, central ou fixture novas). Não executado em Produção; não é homologação de despacho, arquivo real, push ou entrega. Não copiar scripts de Teste diretamente para Produção.

## Bloqueadores ainda abertos
- Reconciliar os demais ajustes acumulados fora de campanhas (GPS, diário de frascos, tema claro, peso inicial e outros aprovados), com comparação de versões e testes; sincronização de frascos entre dispositivos não resolvida.
- Completar e homologar fluxo de recorrência App e reativação das regras copiadas. Cópias preservam agenda como rascunho e não despacham automaticamente.
- Fila compartilhada/claims manuais de Produção e delegação explícita por outro administrador no fluxo automático ainda não portadas/homologadas. Preservar ownership dos grupos e opt-in.
- Preparar atualização assinada do Connect e compatibilidade da versão Teste; validar PDF/MP4 privado ponta a ponta, push e UI real. O build aprovado não autoriza distribuir binário não assinado.
- Revisar a suíte oficial e invariantes; revisar rollback e fingerprints antes de qualquer migração. Nenhum deploy, migração persistente, push ou mensagem real nesta rodada.
- Prioridades 2 e 3 anteriores seguem adiadas. Ordem de publicação autorizada quando concluída e liberada: Produção → Teste. Não considerar o pacote pronto apenas para deploy.


## Continuação — fila central e reservas manuais
- CI web oficial 45743260009: build, check e assert-candidate passaram; 481/483 testes passaram. Ajustadas duas asserções (status de publicação excluída e query de cache CSS), sem remover proteção. Novas execuções supersedidas pelos commits desta rodada; resultado da revisão mais recente ainda não confirmado.
- Acrescentar após os cinco scripts anteriores: `campaign_official_shared_queue_candidate.sql` e `campaign_official_manual_claim_candidate.sql`. Fila administrativa somente leitura, inclusive manual sem data; sem corpo, mídia privada, JID ou credenciais. Reservas exclusivas por publicação/ocorrência e token; liberação exige confirmação de não envio; não permitir reserva de destino sincronizado de outro titular nem transferir autorização de Connect. UI em admin-whatsapp.js com detecção de contrato, status e bloqueio de preparo se consulta de reserva já conhecida falhar.
- Ensaio dos dois scripts em Teste com definições atuais de Produção carregadas temporariamente: fila contém ocorrência fictícia, estado agendado, ausência de campos privados; reserva, rejeição de segundo token, rejeição de liberação sem confirmação, liberação explícita, nova reserva, preparo, confirmação e rejeição de confirmação duplicada aprovados. Um admin e dois tokens; não equivale a dois admins reais. Verificação posterior confirmou rollback (sem tabela, função ou fixture nova).
- Limitação: nenhuma migração foi aplicada permanentemente. Não houve envio real. A delegação automática entre administradores e a recorrência App permanecem pendentes; testar fila e reservas com dois administradores/dispositivos antes de liberar.


## Continuação — séries App
- `campaign_app_draft_repeat_candidate.sql` deve ser ensaiado/aplicado após central App e configurações App de cada ambiente. É candidato comum, sem modificar gates. RPC valida regra, datas em São Paulo, revisão e titularidade; idempotência por solicitação, até 24 ocorrências/89 dias, até oito horários diários ou um horário por dia semanal. Cria uma série transacional de rascunhos, sem despacho. UI detecta capacidade do servidor e lista séries na agenda. Revisar e agendar os rascunhos pela ação já existente. Não há ainda alteração/cancelamento coletivo da série nem execução autônoma indefinida.
- Para evitar sobreposição, cada rascunho recebe encerramento no primeiro entre próxima ocorrência, 24h após seu início e encerramento anterior configurado. Frequência e limite de exibições valem por ocorrência. Push continua desativado em Teste e sujeito ao gate oficial em Produção.
- Ensaio em Teste com rollback: criação de quatro rascunhos, idempotência, regra semanal personalizada, rejeição de regra incompleta, nenhum lote criado; segundo ensaio com app_settings confirmou três janelas e persistência do encerramento. A consulta de pós-verificação do primeiro ensaio confirmou rollback. Não homologado no banco oficial nem em dispositivo real.
- CI das duas branches disparada; confirmação final pendente. Delegação de envio automático entre administradores continua pendente (não transferir titularidade ou contornar autorização). Sem deploy, sem envio real, sem migração persistente. Prioridades 2 e 3 anteriores continuam adiadas.
