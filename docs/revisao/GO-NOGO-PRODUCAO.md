# Decisão de publicação oficial

**NO-GO.** O proxy impediu acesso autenticado ao Supabase e à Vercel. O histórico de migrações e os deltas de produção permanecem abertos.

- [x] Comparar Git, confirmar os heads e excluir PRs #22 e #23.
- [x] Verificar configuração oficial, marca, rotas legadas, isolamento das APIs de Teste e do canal Windows.
- [ ] Confirmar o ponto de recuperação, restauração isolada, catálogo real e ledger.
- [ ] Revisar definições das 124 rotinas divergentes, constraints, RLS e privilégios e ensaiar os deltas.
- [ ] Conferir domínio, Vercel READY, Auth/CAPTCHA, CORS, SMTP, recuperação e rota legada com PWA instalada.
- [ ] Homologar isolamento de duas contas, biblioteca, comunidade, loja, pagamentos, webhooks e exclusão de conta. Preservar cron e validar notificações com consentimento.
- [ ] Verificar os Advisors e a disponibilidade da proteção contra senhas vazadas.
- [ ] Aprovar lotes de DDL e Edge e, separadamente, o merge para main. Campanhas push, agentes adicionais, observabilidade externa e Windows exigem liberação própria.
- [ ] Publicação futura. Confirmar SHA, READY, DNS/HTTPS, fluxos funcionais e monitoramento.

[Procedimento de execução e recuperação](../../release/production/README.md) · [Inventário de Supabase](INVENTARIO-SUPABASE-20261122.md)

Na continuidade do PR #25 foram verificados o gate da CI, contratos financeiros sintéticos e os dois lotes de ensaio. Reembolso parcial e repetição de checkout continuam bloqueios financeiros. Catálogos reais, restauração verificada, conector e ativação operacional ainda estão pendentes. [Relatório de backend](BACKEND-PR25.md)
