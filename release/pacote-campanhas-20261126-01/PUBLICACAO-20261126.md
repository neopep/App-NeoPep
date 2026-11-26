# Publicação incremental — pacote campanhas 01 — 26/11/2026

Estado vigente: publicado, autorizado pelo responsável. Produção antes de Teste. Este registro atualiza o estado de preparação descrito no README do pacote.

- Domínio: https://app.neopep.com.br
- SHA servido: `ce348d380ba0193e570c3a2e4d41e5dd0a4a648c`
- Deployment Vercel: `dpl_HoDVJgDKkSXBGUQi8ZqTg6xLVtGF` READY, alias oficial confirmado.
- Deployment anterior para rollback de frontend: `dpl_jQiHupTxb92xc7KdPCXhkN9i3Xsm`. Rollback de frontend não reverte banco.
- CI técnica do SHA servido: https://github.com/neopep/App-NeoPep/actions/runs/45853511440 concluída com sucesso.
- Cache verificado: `neopeptideos-shell-20261126-integracao-63-campanhas1`.
- Smoke HTTP: /, /sw.js, /admin/campaign-central.js e /config.js retornaram 200; novo switch no código servido e projeto Supabase correto.

## Migrações aplicadas (não reaplicar)
- 20261126155325 campaign_group_pause_production_20261126
- 20261126155331 campaign_manual_pause_production_20261126

O primeiro ensaio de aplicação retornou 42809 porque campaign_app_official_batches é uma view. A transação foi revertida; a correção registrada em ce348d3 aplica o trigger à tabela campaign_dispatch_batch, apenas para manifest.action=publish_app. A instalação e as guardas de popup/push foram confirmadas no catálogo. Connect CI: 45853511438.
A auditoria possui RLS e exclusão em cascata do vínculo com usuário. Acesso anônimo à Central e execução direta dos helpers privados permanecem bloqueados. As consultas pós-migração registraram zero ações de pausa e zero mensagens pendentes/rich em espera ou execução. Nenhum envio real foi realizado. Nenhum gate de envio, permissão individual de material, Mercado Pago ou IA foi alterado.

## Pendências explícitas
- originals_enabled=false permanece nos dois ambientes: preparação de anexos não equivale à autorização de envio efetivo. Não contornar a restrição de segurança anteriormente registrada.
- Homologação funcional em iPhone, reativação, preview PDF e fluxo real de compartilhamento ainda precisa ser realizada; verificação HTTP e CI não substituem esse teste.
- Gate de evidências de homologação pública integral permanece intacto e não foi marcado artificialmente como aprovado. Atualização incremental autorizada para a audiência vigente.
- A candidata substitui o SHA servido anterior; o marco de 26/11 permanece como histórico. Para a próxima mudança, partir do HEAD documental desta branch e verificar o SHA servido.
