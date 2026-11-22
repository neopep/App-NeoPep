# Decisão de publicação oficial

**NO-GO.** A branch contém o resumo do catálogo autenticado e sete lotes executáveis para homologação isolada. A reconciliação do ledger, as diferenças de contrato e a recuperação de banco e Storage oficiais continuam pendentes.

- [x] Comparar Git, confirmar os heads e excluir PRs #22 e #23.
- [x] Verificar configuração oficial, marca, rotas legadas, isolamento das APIs de Teste e do canal Windows.
- [x] Incorporar o resumo autenticado ao desenho e executar os sete lotes em banco sintético.
- [x] Comparar as **56 assinaturas ausentes** com as fontes dos sete lotes: **42 declaradas e 14 fora de ativação**. Examinar as **124 funções divergentes**: 116 com corpo compacto igual (equivalência semântica ainda não comprovada), 8 com alterações de corpo que exigem decisão de contrato; 72 com ACL textual divergente. [Matriz](MATRIZ-FUNCOES-56-124-20261122.md) · [Dependências e privilégios](DEPENDENCIAS-FUNCOES-20261122.md).
- [x] Inventariar o **ledger** em ambos os projetos: 16 versões no Teste e nenhuma registrada na Produção; 4 versões do Teste sem arquivo de mesmo ID no Git. [Análise do histórico](LEDGER-FINGERPRINTS-20261122.md). A reconciliação operacional continua pendente.
- [x] Acrescentar verificação **offline** de integridade dos arquivos Storage restaurados, com autoteste (tamanhos, hashes, cobertura e defesa contra path traversal). [Procedimento](../../release/production/RESTORE-REHEARSAL.md). Isto NÃO comprova que o backup oficial foi restaurado.
- [x] Conferir as versões implantadas de Edge e os contratos de Mercado Pago Orders sem acessar segredos ou fazer transações. [Análise de Edge e sandbox pendente](EDGE-ORDERS-CONTRATOS-20261122.md).
- [ ] Confirmar o catálogo integral e o ledger oficiais, o ponto de recuperação e a restauração de banco e Storage em destino autorizado.
- [ ] Revisar definições das 124 rotinas divergentes, constraints, RLS e privilégios e ensaiar os deltas.
- [ ] Conferir domínio, Vercel READY, Auth/CAPTCHA, CORS, SMTP, recuperação e rota legada com PWA instalada.
- [ ] Homologar isolamento de duas contas, biblioteca, comunidade, loja, pagamentos, webhooks e exclusão de conta. Preservar cron e validar notificações com consentimento.
- [ ] Verificar os Advisors e a disponibilidade da proteção contra senhas vazadas.
- [ ] Aprovar lotes de DDL e Edge e, separadamente, o merge para main. Campanhas push, agentes adicionais, observabilidade externa e Windows exigem liberação própria.
- [ ] Publicação futura. Confirmar SHA, READY, DNS/HTTPS, fluxos funcionais e monitoramento.

[Procedimento de execução e recuperação](../../release/production/README.md) · [Inventário de Supabase](INVENTARIO-SUPABASE-20261122.md)

A cobertura dos lotes, seus gates, o pré-voo e a recuperação estão no [procedimento de execução](../../release/production/README.md). Os testes financeiros sintéticos verificam reembolso parcial e repetição de checkout. A API Orders em sandbox, os fingerprints da Loja oficial e a validação operacional de Auth e Edge seguem como critérios de liberação.

O ensaio PostgreSQL 17 isolado cobriu backup e restauração lógicos sintéticos e os sete lotes com rollback e commit. Build, check e 93 testes focados passaram. A suíte completa teve 330 aprovações e 51 falhas também presentes na referência anterior. O comando `release:check` permanece bloqueado pelas evidências operacionais listadas acima. [Procedimento e evidência de restauração](../../release/production/RESTORE-REHEARSAL.md)
