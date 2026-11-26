# Ponto de corte oficial — 26/11/2026

## Versão anterior à automação de campanhas
- Produção publicada e confirmada no domínio app.neopep.com.br: `a315404729c284475e1f0b1f1d917609e4f2ed11`.
- **Teste NÃO PUBLICADO.** O domínio teste.app.neopep.com.br permanece na revisão `f08b7e564902c25c4f62a9dd1c98ce7b5626ddac`. A candidata `fe8ecb2fff8b9fb97eff8b0eb529db84a1f3b430` está preparada, mas bloqueada pelo limite diário de deploys Vercel (402 api-deployments-free-per-day).
- Migrações shop_catalog_offer_v1 e shop_order_tools_v1 instaladas nos dois ambientes.
- Pendência isolada: publicar Teste quando a Vercel liberar; validar câmera e impressão física. Nenhum pedido excluído ou arquivado durante a publicação; Mercado Pago e IA de atendimento preservados.

## Novo ciclo
NeoPep Connect AI: integração externa por plugin MCP para criação de campanhas a partir do chat da IA. Desenvolvimento separado, sem misturar a candidata do IA Studio interno, sem incluir automaticamente funcionalidades adiadas. Antes de consolidar o plugin, reconciliar com a versão efetivamente publicada em cada ambiente. Este registro não autoriza novo deploy.
