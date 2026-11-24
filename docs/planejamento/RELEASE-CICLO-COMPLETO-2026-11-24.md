# Consolidação de homologação — ciclo 24/11/2026

## Escopo solicitado
Incorporar **todos os ajustes com código implementado neste ciclo**: 001, 002, 003, 005, 006, 007, 008, 009, 010.04/05/06, 011, 013. Partir do commit `77fe00c5a14d9a2bf0b58e50c41045ae6def658a` que inclui a cadeia de Loja 010/011, preservando o comportamento aprovado do Mercado Pago/checkout.
As PRs originais devem permanecer separadas e rastreáveis, sem merge para `main`, `staging/permanente` ou ambientes de Produção neste preparo.

## Gates
- Branch `homologacao/ciclo-completo-2026-11-24` tem `git.deploymentEnabled=false`, e nenhum deploy deve ocorrer antes de validação de conflitos/testes.
- SQL da Biblioteca #008 e consentimento #002 ainda **não aplicado** em Supabase Teste. Exigir preflight, aprovação expressa e verificação ACL antes da publicação da UI que depende dessas RPCs.
- Os SQLs #010/#011/#013 estão **somente no Teste**; Produção não está preparada. Não publicar frontend em Produção sem migrar e validar de forma separada.
- #013: envio agendado, worker/push e despacho automático continuam desativados; não fazer envios reais nem novas permissões.
- #004/#012/#014: sem novas funcionalidades elegíveis para esse lote, manter backlog.
- Reconciliar `dist/app.js`, `src/app.js`, `dist/cloud.js`, `src/cloud.js`, `dist/community.js`, `dist/style.css`, `dist/sw.js`, `scripts/build-staging.cjs`, `tests/staging-pwa.test.cjs` com integração sem perdas.
- Executar testes do projeto, PWA, autenticação, consentimentos, biblioteca/admin, loja/estoque/custos, campanhas e Connect; validar desktop e mobile após deploy de Teste.
- Enviar a produção somente após aceite de Teste, migrações remotas de Produção autorizadas, rollback e plano seguro.

## Estado
**Em consolidação técnica; nenhum deploy ou merge de produção.**
