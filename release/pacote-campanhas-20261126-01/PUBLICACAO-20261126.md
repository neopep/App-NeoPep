# Publicação incremental — pacote campanhas 01 — 26/11/2026

Estado vigente: publicado, autorizado pelo responsável. Produção antes de Teste. Este registro atualiza o estado de preparação descrito no README do pacote.

- Domínio: https://teste.app.neopep.com.br
- SHA servido: `00c73db8334bbe4c6c8eda88c44704994d485426`
- Deployment Vercel: `dpl_Fp2znKXqKvFS3a25BtziU5ii9orv` READY, alias oficial confirmado.
- Deployment anterior para rollback de frontend: `dpl_Eg6yH1EQVc7RpbQAveYdTf8SSFY5`. Rollback de frontend não reverte banco.
- CI técnica do SHA servido: https://github.com/neopep/App-NeoPep/actions/runs/45853384761 concluída com sucesso.
- Cache verificado: `pwa-v63-campanhas`.
- Smoke HTTP: /, /sw.js, /admin/campaign-central.js e /config.js retornaram 200; novo switch no código servido e projeto Supabase correto.

## Migrações aplicadas (não reaplicar)
- 20261126155237 campaign_group_pause_test_20261126
- 20261126155244 campaign_manual_pause_test_20261126

A CI do replay integral em PGlite foi aprovada. As guardas de popup do Teste preservam o modelo sem push.
A auditoria possui RLS e exclusão em cascata do vínculo com usuário. Acesso anônimo à Central e execução direta dos helpers privados permanecem bloqueados. As consultas pós-migração registraram zero ações de pausa e zero mensagens pendentes/rich em espera ou execução. Nenhum envio real foi realizado. Nenhum gate de envio, permissão individual de material, Mercado Pago ou IA foi alterado.

## Pendências explícitas
- originals_enabled=false permanece nos dois ambientes: preparação de anexos não equivale à autorização de envio efetivo. Não contornar a restrição de segurança anteriormente registrada.
- Homologação funcional em iPhone, reativação, preview PDF e fluxo real de compartilhamento ainda precisa ser realizada; verificação HTTP e CI não substituem esse teste.
- Gate de evidências de homologação pública integral permanece intacto e não foi marcado artificialmente como aprovado. Atualização incremental autorizada para a audiência vigente.
- A candidata substitui o SHA servido anterior; o marco de 26/11 permanece como histórico. Para a próxima mudança, partir do HEAD documental desta branch e verificar o SHA servido.
