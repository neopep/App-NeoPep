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
