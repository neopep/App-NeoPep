# #013 — Continuação do despacho e da homologação

Base `f0ed98a`, [PR #56](https://github.com/neopep/App-NeoPep/pull/56), Plano Mestre em `1af5240`. Branch `desenvolvimento/ajuste-013-continuacao`. A matriz original está em [EXEC-2026-11-24-013.md](EXEC-2026-11-24-013.md).

## Contratos e invariantes

- `neo_campaign_dispatch_device_v1` usa conta administrativa, ID, segredo e aprovação do dispositivo existente. O protocolo `wa-text-v1` é reportado pelo cliente candidato. O início exige heartbeat, sessão e presença recentes, associação de titular, cache de grupos recente e seleção vigente. O Windows atualiza o status da sua sessão com o contrato de grupos existente. A versão/capacidade reportada não certifica a instalação real.
- O worker Windows usa o timer existente e só é chamado no perfil Teste com opt-in local `NEO_CONNECT_CAMPAIGN_WORKER` e gate de servidor. A flag inicial é falsa para os dois canais. O pause do Connect também bloqueia o WhatsApp. A confirmação manual e `connect_tasks` simulada continuam no fluxo anterior.
- Cada versão é congelada no registro. As ocorrências por grupo ficam na tabela já existente `campaign_wa_publications` com estado de despacho separado. A estrutura legada enxerga esses registros como cancelados, sem grupo manual ou lembrete, e não os envia. Não há outra fila de envios. Um mesmo pedido/resposta de agendamento usa uma chave de idempotência; cada versão tem um único lote por ação. Mudanças de horário e cancelamentos de ocorrências futuras são registrados. Uma revisão nova não substitui o conteúdo de um lote congelado.
- Horário America/Sao_Paulo, até seis ocorrências semanais e 30 grupos distintos. Claim com bloqueio por dispositivo e por linha, fence nova em cada lease. O início é único e registra tentativa. Ritmo de 10 s por dispositivo e 30 s por grupo. Uma recusa comprovadamente anterior ao envio tem até três tentativas com espera de 2/4 min para as próximas; lease expirado antes de start retorna à espera. Após start, timeout ou interrupção ficam `uncertain`, sem nova tentativa automática. Cancelamento enquanto iniciado não apaga um aceite real nem garante que o envio foi impedido.
- A aceitação ao voltar do Bridge exige ID de mensagem. Não equivale a entrega ou leitura. Resultados e tentativas ficam isolados por grupo. Diagnóstico e auditoria no painel exibem os estados e não inferem sucesso pelo horário.
- O App usa o registro de campanha existente, libera apenas a versão escolhida e preserva o mecanismo de seleção por todos ou códigos de plano. `starts_at` controla liberação futura. Push é opcional e passa pelo contrato legado de opt-in, consentimentos, período e destinatário; sem novo emissor. Publicação, reagendamento e cancelamento futuro App são independentes do WhatsApp. As opções Free/Premium referem-se aos códigos de plano atribuídos, não a uma inferência de assinatura.
- O transporte do lote é deliberadamente **somente texto**, até 2.000 caracteres e sem links explícitos. O Bridge existente prova, com mock, texto e um JPEG de até 1 MiB no fluxo manual. Não existe manifesto autorizado e durável para bytes do navegador, URLs, imagens automáticas, PDF, catálogo Premium ou republicação. Esses blocos são aceitos somente no rascunho e recusados no cadastro de despacho, mesmo se tinham autorização no momento da seleção. Nenhum conteúdo ou referência privada entra no worker. Grupos são revalidados no start.

## Matriz de continuação 013.01–013.14

| ID | Evidência desta versão | Gate residual |
|---|---|---|
| 013.01 | Auditoria da fila simulada, do contrato do dispositivo e do fixture de grupos versionado. | Confirmar catálogo instalado. |
| 013.02 | App, Publicações e revisão preservados; versões agendadas permanecem acessíveis para acompanhar. | Navegação com contas reais. |
| 013.03 | Editor e rascunhos do #56 preservados. | Safari físico. |
| 013.04 | Formatação e prévia do #56 preservadas. | Fidelidade no cliente real. |
| 013.05 | Texto automatizável; anexos locais e JPEG manual preservados. | Manifesto durável e validação de mídia para despacho. |
| 013.06 | Referências bloqueadas na entrada do worker, inclusive perda de autorização. | Consentimento e revalidação de materiais/links para futura liberação. |
| 013.07 | Diagnóstico por dispositivo, protocolo, presença e sessão. | Windows instalado e sessão reais. |
| 013.08 | Esteira existente com versão/horário/destino, estado separado e auditável. | Conferir catálogo instalado e ausência de consumidores paralelos. |
| 013.09 | Adaptador Windows opt-in usa a mesma sessão e IPC de texto; fence e retorno correlacionados. | Compilar o WinForms no Windows, verificar sessão real e resultado incerto. |
| 013.10 | Agenda durável, retomada, recorrência limitada, ritmo, leases, cancelamento futuro e trilha de tentativas. | Teste operacional offline/retomada em instalação real. |
| 013.11 | App → WhatsApp conserva rascunho vinculado; permite agendar texto com gate autorizado. | Homologar o fluxo em serviço de Teste. |
| 013.12 | WhatsApp → App agenda/publica texto e configura App/push independentemente. | Conferir planos atribuídos, consentimento e worker de push com conta real autorizada. |
| 013.13 | PostgreSQL 17, testes de Bridge mockado, Chromium desktop/mobile e regressões passaram localmente. | Nenhum WhatsApp/push ou Windows real nesta execução. |
| 013.14 | Preflight, rollback, flags desligadas e branch sem deploy preparados. | Autorizações, monitoramento e publicação somente após homologação. |

## Ensaios e rollout

Build e check do frontend, 24 testes Campanhas/Connect/PWA, cinco testes do Bridge com provedor simulado, Chromium desktop/iPhone 13/Pixel 7 emulado e `tests/campaign-dispatch-postgres.sh` em PostgreSQL 17 sem rede. O ensaio de banco usa fixtures de conexão e credencial sintética e não usa o Bridge real. Verifica desligado por padrão, ACL, concorrência, recorrência, horários, isolamento App/WhatsApp, alteração futura, cancelamento, offline, desconexão, revogação, expiração antes/depois do início, recusa/retry e perda de destino. A regressão de navegador simula a liberação App sem push. O compilador Windows/.NET Framework não está disponível no executor Linux.

Ordem da homologação futura após autorização: comparar contratos com o projeto Teste, confirmar preflight e acesso/backup, aplicar primeiro a migração dirigida do editor `20261124233000` se ainda ausente e depois `20261124234500_campaign_dispatch.sql`, com ambas as flags falsas. Testar contas/dispositivos fictícios, instalação e modo offline, freios de ritmo, conteúdo e negação de privacidade. Somente após prova operacional e autorização específica habilitar um destino autorizado e efetuar uma tentativa controlada. Registrar falhas e recuperar via rollback que pausa os canais novos, torna in-flight incerto e preserva o histórico e os fluxos legados. Nenhum deploy, SQL remoto, worker, push ou WhatsApp real foi executado nesta sessão.

Migração de despacho SHA-256 `28c54d5e36c2391072f618362c1f3935fd8805aa802a0048899a17ff6eb2e658`. O recibo técnico retornado pelo cliente é armazenado na auditoria privada; um resultado aceito sem recibo válido é tratado como incerto. O delta não modifica o Bridge Node nem os contratos financeiros da Loja.
