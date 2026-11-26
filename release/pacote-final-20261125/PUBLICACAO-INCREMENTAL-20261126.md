# Publicação incremental — 26/11/2026

- Domínio: https://app.neopep.com.br
- Commit publicado: `3769d2d50924ca8be9b2c260a729aba7514c3f20`
- Vercel: `dpl_jQiHupTxb92xc7KdPCXhkN9i3Xsm` (READY, target production do projeto correto, alias verificado).
- Deployment anterior para rollback de frontend: `dpl_Bq8nzC3AafTkawmiCyDa9RDUka3F` (rollback não implica reversão de banco).
- CI: https://github.com/neopep/App-NeoPep/actions/runs/45830848590 — 534 aprovados, 0 falhas, 1 ignorado.
- Smoke HTTP: /, /manifest.webmanifest, /sw.js, /neo/sw.js e /config.js responderam 200; config aponta apenas para o projeto Supabase cpslafpzjtbpmoxxysaa.

Publicação autorizada pelo responsável, Produção antes de Teste. A configuração de acesso/cadastro é idêntica à da versão anterior. A build de Produção foi solicitada com override de Ignored Build Step somente no pedido de deploy, após cancelamentos por deduplicação; Teste foi publicado no target production do seu próprio projeto, respeitando a regra de ambiente. Não foi alterado o checklist de lançamento público, nem simulada aprovação do gate de evidências.

## Escopo não homologado
O diário de frascos passou em fixture SQL offline; RPC online não aplicada, fallback local preservado. Permanecem pendentes as validações de contas, recuperação de senha, Storage privado real, exclusão/exportação de conta, dispositivos e push. Nenhuma mensagem WhatsApp ou notificação real foi enviada. Mercado Pago e IA não foram alterados. Não afirmar homologação funcional integral apenas com smoke HTTP.

Este commit documenta a publicação do SHA acima, sem modificar código funcional e sem novo deploy.
