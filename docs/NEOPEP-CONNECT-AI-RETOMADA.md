# NeoPep Connect AI — Ponto de retomada

Atualizado em 27/11/2026. Este arquivo resume o estado atual; o histórico detalhado está em [NEOPEP-CONNECT-AI-PROGRESSO.md](NEOPEP-CONNECT-AI-PROGRESSO.md).

## Regra de continuidade
Antes de alterar, consultar a ponta da branch desenvolvimento/connect-ai-especialistas-criativos-20261127, este arquivo, o histórico, CI e os recursos reais. Não repetir migrações, recriar infraestrutura, rotacionar segredos ou reabrir etapas aprovadas sem evidência de necessidade. Registrar toda mudança e evidência; distinguir código candidato, implantação e homologação real. Atualizar este resumo após cada lote.

## Concluído / confirmado
- Desktop 1.0.5 homologado anteriormente; preservar. Nuvem, ChatGPT Web/iPhone e Codex Nuvem adiados.
- Supabase Teste qnuluspqfazdppciermw: dez tabelas privadas Connect AI presentes, RLS habilitada, sem SELECT direto anon/authenticated; marcador de ambiente confirmado. Login dedicado neo_connect_ai_test_login criado e configurado pelo proprietário. Não repetir migrações.
- Hyperdrive Teste 3d481b9cf7c848888a6982ba3c1b1eb4, cache desativado; Worker neopep-connect-ai-teste implantado; domínio connect-teste.neopep.com.br vinculado. Produção separada.
- Sete configurações OAuth presentes no Worker: SESSION_KEY, CSRF_KEY, SIGNING_JWK, PUBLIC_JWK, KEY_ID, CLIENTS, SUPABASE_PUBLISHABLE_KEY (prefixo NEO_CONNECT_AI_). Não copiar, revelar ou regenerar segredos.
- Manual central 2026-11-27.3, catálogo preview.4, nove métodos criativos, recibo assinado de consulta, ferramentas candidatas de rascunho e edição de legenda. Testes de contrato aprovados.
- Revisão OAuth abf87f9 e teste 0654b64: mapa estático vazio permitido exclusivamente no Teste para descoberta CIMD existente. CI do commit 01c91816d961cc4a101832825510eb159f89846a aprovado: https://github.com/neopep/App-NeoPep/actions/runs/46017812581 ; artefato 15207365368. ZIP externo SHA256 667e8db6798aa4266784790a1e76d9021a89f01597bd0acabc5bae0cbd7eb665; SHA256SUMS interno validado.

## Ponto exato de retomada
1. CONCLUÍDO: bundle 01c9181 implantado pelo proprietário; domínio e sete secrets conferidos.
2. ATUAL: ENABLED=1 confirmado; READ_APP=0 e DRAFTS=0. Validar discovery OAuth, JWKS e MCP sem token (401), banco e autorização real Codex. Reverter ENABLED se falhar.
3. Homologar leitura real e isolamento. Conferir frontend de consentimento Teste e, somente após evidências, liberar escopo drafts opt-in e ensaiar criação/edição com fixture.
4. Retomar upload privado, runner de lotes, Windows 0.2.16/5 MiB, destinatários, aprovação verificável, agenda/publicação e auditoria; conferir código e banco antes de implementar.
5. Não habilitar envio real, publicação, agenda ou escrita em Produção; não contratar recursos sem autorização.

## Bloqueio atual
Discovery HTTP 200, JWKS HTTP 200 e MCP sem token HTTP 401 confirmados. Próximo ponto: consentimento e leitura autenticada pelo Codex Desktop. Não declarar OAuth integralmente homologado.

## Atualização operacional — 27/11/2026
- Proprietário implantou bundle 01c9181 via Wrangler; versão informada no terminal e219eb8a-c7c1-4927-9f8d-ed7d9c0f07e6. Cloudflare confirmou domínio e sete secrets preservados, Hyperdrive Teste correto.
- PATCH de settings exclusivo Teste bem-sucedido; consulta posterior confirma ENABLED=1, READ_APP=0, DRAFTS=0, sete secrets preservados. Nenhuma alteração em Produção. WhatsApp leitura somente após autenticação.
- Tentativa de consultar endpoints discovery/JWKS pela ferramenta web retornou indisponibilidade da ferramenta, sem status HTTP verificável do servidor. Próximo passo: validar HTTP pelo operador (curl), discovery e JWKS, confirmar 401 sem token e então autenticar plugin Desktop no Teste. Se resposta real 503 persistir, desativar ENABLED e investigar Hyperdrive/configuração. Não reimplantar/recriar recursos já confirmados sem necessidade. Não habilitar escrita.

## Evidência HTTP real — 27/11/2026 14:46:27 UTC
- Operador executou curl.exe -i https://connect-teste.neopep.com.br/.well-known/oauth-authorization-server e apresentou captura com HTTP/1.1 200 OK, JSON de discovery, issuer e endpoints exclusivos Teste, JWKS URI, PKCE S256, authorization_code/refresh_token, CIMD true e scopes_supported exclusivamente campaigns:read. Pelo fluxo do environment-worker, a verificação inicial do banco e configuração OAuth passou; não comprova consentimento, emissão de token ou leitura de campanhas.
- Próximo gate: testar JWKS público e rejeição 401 do MCP sem token; depois autenticar Desktop apontado para Teste, consentimento e leitura real. DRAFTS=0 e READ_APP=0 mantidos. Não repetir deploy, domínio, Hyperdrive ou secrets.

## Validação HTTP inicial concluída — 27/11/2026
- Capturas do operador: discovery HTTP 200 às 14:46:27 UTC; JWKS HTTP 200 às 14:47:14 UTC com chave pública EC P-256 ES256, kid exclusivo Teste, sem componente privado; POST /mcp sem token HTTP 401 às 14:47:41 UTC, WWW-Authenticate Bearer apontando resource_metadata exclusivo Teste. Três gates HTTP iniciais aprovados.
- Próximo gate único: autenticar Codex Desktop existente no endpoint https://connect-teste.neopep.com.br/mcp, confirmar consentimento no app Teste e executar leitura real. Não reinstalar plugin nem repetir deploy ou testes HTTP já aprovados. READ_APP e DRAFTS continuam zero; não enviar/publicar/agendar. Ainda não comprovados emissão de token, sessão autenticada ou leitura real.

## Homologação Desktop bloqueada
- Operador apresentou resposta Codex sem ferramentas MCP Teste expostas na sessão. Consulta Supabase Teste confirmou zero sessões MCP não expiradas. Não comprova causa específica. Próximo passo: conferir configuração local do servidor, URL e estado de autenticação no Desktop; não repetir infraestrutura. Escrita permanece bloqueada.

## Consentimento do painel Teste — 27/11/2026
- Codex tinha apenas plugin Produção. Operador cadastrou MCP personalizado neopep-teste (HTTP streaming, https://connect-teste.neopep.com.br/mcp), habilitou e clicou Autenticar; redirecionamento para teste.app.neopep.com.br/admin/ confirmado. Painel exibiu somente base de conhecimento, sem consentimento.
- Vercel Teste projeto prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq, deploy dpl_BmEi6SBW7imZXCo3XCMnEf95sFB8, commit 9f236f0, branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126, referência 2026-11-27.8. Causa: painel referência-only, SDK sem approveConnectAI e CSP sem host MCP Teste.
- Correção atômica 2826632a0567f38550d5f86b35185d4555ac08db aplicada à branch EXISTENTE de publicação Teste, sobre a versão publicada, não à Produção. Reaproveita validação OAuth, vincula host/projeto Teste, restringe consentimento a campaigns:read, preserva mountKnowledge, adiciona CSP somente host Teste e cache-bust, teste de regressão e gatilho CI. Build oficial Vercel regenera dist/cloud.js. Nenhuma migração, segredo ou Worker alterado. CI e deploy ainda sem resultado confirmado.
- PONTO ATUAL: conferir CI da branch de publicação Teste e implantação do commit 2826632; publicar apenas nesse projeto se não houver deploy automático e CI aprovado. Não publicar branch de desenvolvimento MCP inteira no app. Depois reiniciar autenticação pelo Codex (solicitação expira em 2 min), autorizar leitura e verificar sessão/consulta real. Escrita desativada. Não repetir cadastro do MCP ou infraestrutura.

## CI do consentimento Teste — 27/11/2026
- Run 46021668115 do commit 2826632: build, check e auditoria aprovados; suíte completa 522 pass, 4 fail, 1 skipped; teste novo OAuth não falhou. Falhas: cache PWA esperado antigo, duas verificações de versões JS desatualizadas, teste CSS de badges examinava todos os estilos posteriores em vez do bloco alvo. Conferidos arquivos e logs.
- Commit 0171694219dc34e18e4eece8c547c14d514987ac na branch desenvolvimento/loja-ofertas-etiquetas-teste-20261126 corrige exclusivamente quatro arquivos de testes: mantém asserções de versão exata e restringe teste CSS ao bloco de contadores delimitado pelo próximo comentário. Nenhuma alteração de runtime nesta rodada. Nova execução CI ainda não apareceu na consulta.
- PONTO ATUAL: aguardar evidência CI de 0171694; consultar Vercel Teste projeto prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq e publicar somente commit aprovado se necessário. Domínio ainda estava em 9f236f0 na última confirmação; não declarar correção publicada. Depois reautenticar Codex. Sem escrita e sem alterações Produção.

## Consentimento aprovado em CI; limite Vercel — 27/11/2026
- Staging CI run 46021989574, commit 0171694219dc34e18e4eece8c547c14d514987ac, conclusão success. As quatro verificações reconciliadas; código de consentimento aprovado em CI.
- Consulta por SHA no projeto Teste prj_ksWxwsJyKhdR2nW2OiZkwx8hlkdq não encontrou deploy. Tentativa explícita de criar deployment no projeto app-neopep-staging (target production interno desse projeto de Teste) pelo Git source exato retornou HTTP 402 api-deployments-free-per-day (mais de 100), retryAfter 86400. Nenhuma publicação criada; sem CLI autenticado disponível. Não alterar plano, não criar outro projeto para contornar limite.
- PONTO ATUAL: retomar diretamente na publicação do commit 0171694 no projeto Teste quando a cota permitir, sem novo commit de código nem repetir CI/infra. Conferir alias teste.app.neopep.com.br e SHA efetivo; reiniciar OAuth Codex e validar leitura real. Produção intacta; READ_APP/DRAFTS zero.

## Executor de lotes de rascunhos — 27/11/2026
- Vercel segue bloqueada conforme registro anterior; candidato de consentimento 0171694 aprovado e pronto para publicação Teste, não alterado nesta rodada.
- Auditoria de leitura no Supabase Teste confirma funções privadas connect_ai_job_assemble, claim, claim_payload, control, create, create_payload, result com EXECUTE do broker e job_check sem EXECUTE direto. Inspecionadas definições de claim/claim_payload/control/create_payload/result: payload persistente, até seis itens por lease de dois minutos, exclusão mútua de lote ativo, pausa/resume/cancel, status sem payload, recibo com lease e expiração, estado uncertain sem replay. Registro de 008 original não representa todo o esquema atual. Nenhuma migração executada.
- Commit f1c311e0ad1bd606b81146b83ceaae4008915e69 adiciona draft-job-runner.mjs e sete testes de contrato: 60 itens/10 chunks, flags e escopos, pausa/cancelamento, timeout/ambiguidade, recibo rejeitado, revogação/deadline, payload divergente. Executor candidato processa um chunk explícito, revalida por item, só chama add_publications, grava resultado via callback com IDs e lease, não repete resultado incerto e não retorna payload. Flag local default false. Não ligado ao broker, catálogo ou Worker ativo. CI 46023986426 em execução na consulta inicial; ainda não homologado.
- PRÓXIMO: confirmar CI de f1c311e; integrar callbacks privados ao session-broker com flags Teste e revalidação de sessão não cacheada, testar contrato real de claim/status/result em fixture transacional sem efeitos duráveis, e reconciliar leases/recibos incertos antes de expor ferramenta. Manter escopos DRAFTS/READ_APP desligados e nenhum envio, publicação ou agenda. Retomar consentimento pelo deploy 0171694 assim que Vercel permitir.

## Integração privada do executor — 27/11/2026
- CI 46023986426 (f1c311e) e CI 46024220133 (20d984c80b51f64af17fdc98e0177e5abbe297ab) concluídos com sucesso. Novo commit liga executor ao session-broker por método privado runDraftJob, sem rota HTTP/MCP, com SQL parametrizado claim_payload/control(status)/result, marcador de ambiente, sessão administrativa revalidada sem cache, validade do principal e escopos. Exige ENABLED=1, DRAFTS=1 e nova flag NEO_CONNECT_AI_DRAFT_JOBS=1. Nenhuma flag configurada ou Worker implantado. Quatro testes novos verificam assinaturas/recibo, bloqueios, marcador, revogação após claim.
- Banco Teste: assinaturas e EXECUTE do broker reconfirmados. Ensaio com sete itens sintéticos em subtransação foi rejeitado no primeiro claim (42501 forbidden), pois connect_ai_job_check exige drafts_enabled=true no marcador de Teste. Consulta posterior confirma drafts_enabled=false, zero conexões e jobs do fixture. Não houve efeito durável nos registros; não foi alterada a flag nem efetuado upload/escrita de campanha. Evidência real de bloqueio, NÃO de execução positiva. A homologação positiva permanece condicionada à leitura autenticada e à autorização de escrita Teste; não contornar a trava.
- PONTO ATUAL: consentimento Teste 0171694 aprovado, ainda bloqueado pela cota Vercel. Em paralelo avançar implementação de reconciliação de recibos incertos e upload privado sem ativação. Executor privado 20d984c aprovado CI, ainda não exposto; falta homologação positiva de fila, preparação do catálogo/consentimento granular e retenção. DRAFTS/READ_APP desligados, Produção intocada; nenhum envio/agendamento/publicação.
