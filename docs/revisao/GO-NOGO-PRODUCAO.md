# Decisão de publicação oficial

**NO-GO.** A branch contém o resumo do catálogo autenticado e sete lotes executáveis para homologação isolada. A reconciliação do ledger, as diferenças de contrato e a recuperação de banco e Storage oficiais continuam pendentes.

- [x] Comparar Git, confirmar os heads e excluir PRs #22 e #23.
- [x] Verificar configuração oficial, marca, rotas legadas, isolamento das APIs de Teste e do canal Windows.
- [x] Incorporar o resumo autenticado ao desenho e executar os sete lotes em banco sintético.
- [x] Comparar as **56 assinaturas ausentes** com as fontes dos sete lotes: **42 declaradas e 14 fora de ativação**. Examinar as **124 funções divergentes**: 116 com corpo compacto igual (equivalência semântica ainda não comprovada), 8 com alterações de corpo que exigem decisão de contrato; 72 com ACL textual divergente. [Matriz](MATRIZ-FUNCOES-56-124-20261122.md) · [Dependências e privilégios](DEPENDENCIAS-FUNCOES-20261122.md).
- [x] Inventariar o **ledger** em ambos os projetos: 16 versões no Teste e nenhuma registrada na Produção; 4 versões do Teste sem arquivo de mesmo ID no Git. [Análise do histórico](LEDGER-FINGERPRINTS-20261122.md). A reconciliação operacional continua pendente.
- [x] Acrescentar verificação **offline** de integridade dos arquivos Storage restaurados, com autoteste (tamanhos, hashes, cobertura e defesa contra path traversal). [Procedimento](../../release/production/RESTORE-REHEARSAL.md). Isto NÃO comprova que o backup oficial foi restaurado.
- [x] Conferir as versões implantadas de Edge e os contratos de Mercado Pago Orders sem acessar segredos ou fazer transações. [Análise de Edge e sandbox pendente](EDGE-ORDERS-CONTRATOS-20261122.md).
- [x] Confirmar via consulta autenticada o plano **Free** e o inventário da origem (banco ~23,6 MB; 34 objetos em 7 buckets, ~58,3 MB por metadados). Preparar [roteiro Windows de backup](../../release/production/BACKUP-FREE-WINDOWS.md); **exportação foi feita depois deste inventário; restauração real não realizada**, conforme [registro de backup](BACKUP-PRODUCAO-STATUS-20261122.md).
- [x] Adaptar **somente na candidata** o lote financeiro e rollback para normalizar `CRLF/LF`, confirmar fingerprints canônicos originais idênticos em Produção/Teste e aprovar cenário de regressão PGlite. [Evidência](PREFLIGHT-BACKUP-FINANCE-20261122.md).
- [x] **Exportação manual de banco e 34 arquivos Storage evidenciada** (leitura integral do dump, SHA-256 local e contagens de 7 buckets; chaves S3 revogadas): [registro operacional](BACKUP-PRODUCAO-STATUS-20261122.md). A decisão do proprietário foi **prosseguir sem reinicialização / Docker / ensaio de restauração nesta rodada**, com risco documentado.
- [ ] Confirmar o catálogo integral e o ledger oficiais, o ponto de recuperação e a **restauração de banco e Storage em destino autorizado**. Esta última verificação foi dispensada operacionalmente nesta rodada, **não executada nem aprovada**; não modificar o gate de evidências por esse motivo.
- [ ] Revisar definições das 124 rotinas divergentes, constraints, RLS e privilégios e ensaiar os deltas.
- [ ] Conferir domínio, Vercel READY, Auth/CAPTCHA, CORS, SMTP, recuperação e rota legada com PWA instalada.
- [ ] Homologar isolamento de duas contas, biblioteca, comunidade, loja, pagamentos, webhooks e exclusão de conta. Preservar cron e validar notificações com consentimento.
- [ ] Verificar os Advisors e a disponibilidade da proteção contra senhas vazadas.
- [ ] Aprovar lotes de DDL e Edge e, separadamente, o merge para main. Campanhas push, agentes adicionais, observabilidade externa e Windows exigem liberação própria.
- [ ] Publicação futura. Confirmar SHA, READY, DNS/HTTPS, fluxos funcionais e monitoramento.

[Procedimento de execução e recuperação](../../release/production/README.md) · [Inventário de Supabase](INVENTARIO-SUPABASE-20261122.md)

A cobertura dos lotes, seus gates, o pré-voo e a recuperação estão no [procedimento de execução](../../release/production/README.md). Os testes financeiros sintéticos verificam reembolso parcial e repetição de checkout. A API Orders em sandbox, os fingerprints da Loja oficial e a validação operacional de Auth e Edge seguem como critérios de liberação.

O ensaio PostgreSQL 17 isolado cobriu backup e restauração lógicos sintéticos e os sete lotes com rollback e commit. Build, check e 93 testes focados passaram. A suíte completa teve 330 aprovações e 51 falhas também presentes na referência anterior. O comando `release:check` permanece bloqueado pelas evidências operacionais listadas acima. [Procedimento e evidência de restauração](../../release/production/RESTORE-REHEARSAL.md)

## Retomada assistida — verificação independente em 22/11/2026

**Escopo:** checagem diretamente nas conexões GitHub e Supabase, apenas leitura de banco e metadados, sem migração, deploy, pagamentos, alteração de segredos ou merge. O proprietário decidiu seguir as verificações **sem reiniciar o Windows e sem ensaio local de restauração nesta rodada**. O ensaio continua faltante como evidência e **não libera publicação**.

- GitHub PR #25: `DRAFT`, aberto, na branch `release/preparacao-paridade-producao-20261122`, ponto verificado antes desta nota: `09cb7ec7c141fd235ce830344c4d6366bbeed4ee`. `main` e Produção não modificadas nesta checagem.
- Supabase Teste `qnuluspqfazdppciermw` e Produção `cpslafpzjtbpmoxxysaa`: ambos responderam. A listagem de migrações retornou **16** no Teste e **0** na Produção; ausência de registros não indica ausência de estrutura instalada.
- Edge: **6** funções ativas no Teste e **9** na Produção. As diferenças de `verify_jwt` em `ai-reply`, `agent-integrations`, `platform-integrations` e `push-dispatch` persistem. Preservar as nove funções oficiais, especialmente Auth, exclusão de conta, Loja, Mercado Pago e push; não substituir nem mudar o gateway sem testes de autorização interna.
- Leitura do catálogo (`pg_proc`): as oito rotinas de contrato listadas em [MATRIZ-FUNCOES-56-124-20261122.md](MATRIZ-FUNCOES-56-124-20261122.md) continuam presentes e apresentam MD5 do texto de definição diferentes entre ambientes. `neo_agent` e `neo_support` são `SECURITY DEFINER` com `EXECUTE` para `authenticated`; as outras seis não concedem EXECUTE efetivo a `authenticated` nem a `anon` na consulta. A divergência textual não prova, isoladamente, defeito; exigir revisão semântica e teste de isolamento.
- Supabase Security Advisors: Teste **66** e Produção **41** alertas do tipo `authenticated_security_definer_function_executable` (WARN). Tabelas privadas com RLS sem policy: Teste **83**, Produção **45** (INFO; avaliar isolamento do schema antes de sugerir policies). Aviso `auth_leaked_password_protection` (WARN, **1** em cada ambiente). Referências: [rotinas privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Fila técnica para continuar:** (1) conferir autorização interna e testes cross-account das RPCs privilegiadas; (2) revisar semântica/ACL das oito funções de contrato e as 72 diferenças de ACL, conservando o comportamento oficial; (3) resolver as quatro versões de ledger do Teste sem correspondência 1:1; (4) homologar Orders/Webhooks do Mercado Pago em sandbox isolado; (5) conferir Vercel/Auth/cron/Edge e solicitar autorização específica para cada promoção. **Status: NO-GO.**
