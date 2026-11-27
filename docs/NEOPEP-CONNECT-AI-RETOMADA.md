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
A atualização manual do bundle já foi concluída. Falta validar respostas HTTP reais, pois a ferramenta web não conseguiu acessar os endpoints. Não declarar OAuth homologado antes de teste real.

## Atualização operacional — 27/11/2026
- Proprietário implantou bundle 01c9181 via Wrangler; versão informada no terminal e219eb8a-c7c1-4927-9f8d-ed7d9c0f07e6. Cloudflare confirmou domínio e sete secrets preservados, Hyperdrive Teste correto.
- PATCH de settings exclusivo Teste bem-sucedido; consulta posterior confirma ENABLED=1, READ_APP=0, DRAFTS=0, sete secrets preservados. Nenhuma alteração em Produção. WhatsApp leitura somente após autenticação.
- Tentativa de consultar endpoints discovery/JWKS pela ferramenta web retornou indisponibilidade da ferramenta, sem status HTTP verificável do servidor. Próximo passo: validar HTTP pelo operador (curl), discovery e JWKS, confirmar 401 sem token e então autenticar plugin Desktop no Teste. Se resposta real 503 persistir, desativar ENABLED e investigar Hyperdrive/configuração. Não reimplantar/recriar recursos já confirmados sem necessidade. Não habilitar escrita.
