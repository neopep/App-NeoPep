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
1. Implantar bundle aprovado 01c9181 no Worker Teste, preservando sete secrets e domínio; usar Wrangler 4.54.0 com wrangler.staging.jsonc, flags zero. A revisão ainda não está implantada.
2. Conferir bindings, versão, domínio. Ativar apenas ENABLED=1; READ_APP e DRAFTS permanecem zero. Validar discovery OAuth, JWKS e MCP sem token (401), banco e autorização real Codex. Reverter ENABLED se falhar.
3. Homologar leitura real e isolamento. Conferir frontend de consentimento Teste e, somente após evidências, liberar escopo drafts opt-in e ensaiar criação/edição com fixture.
4. Retomar upload privado, runner de lotes, Windows 0.2.16/5 MiB, destinatários, aprovação verificável, agenda/publicação e auditoria; conferir código e banco antes de implementar.
5. Não habilitar envio real, publicação, agenda ou escrita em Produção; não contratar recursos sem autorização.

## Bloqueio atual
O conector não transfere diretamente o bundle binário compilado à Cloudflare. Proprietário pode executar Wrangler no Windows como no deploy anterior. Não é necessário recriar credenciais. Não declarar OAuth homologado antes de teste real.
