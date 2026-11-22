# Backend da candidata — PR #25

**NO-GO.** O preflight autenticado no comentário do PR confirmou 45 tabelas privadas com RLS, sete buckets privados, nove Edge Functions e o cron neo-push-dispatch ativo por minuto em produção. Em Teste, registrou 83 tabelas privadas, nove buckets privados, seis Edge Functions e 16 versões de migração. O ledger consultado em produção não retornou versões. Preserve o default verdadeiro de community_preferences.push_enabled em produção e os valores já gravados. A execução 45055909655 aprovou a candidata técnica e bloqueou o gate de evidências.

A sessão atual não renovou a leitura autenticada. A API Supabase retornou 403 no proxy e não há conexão autenticada configurada. O catálogo passou a registrar nome e hash do SQL no ledger quando disponíveis. Essas evidências ainda precisam ser capturadas para os dois projetos, reconciliadas com as instruções versionadas e com a definição de cada objeto. O hash do array de instruções do ledger compara capturas no mesmo formato. Os SHA-256 do manifesto fixam os bytes dos arquivos de origem. O inventário do comentário não permite concluir a reconciliação das funções divergentes.

## Proteções por superfície

| Superfície | Verificação ou decisão | Pendência antes do Go |
|---|---|---|
| Migrações | Dois lotes renderizáveis, sem replay da instalação e com checagem de pré-condições, colisões, RLS e ACL. O destino permitido é o banco isolado de ensaio. | Confirmar as assinaturas e objetos reais. Preparar e ensaiar os deltas de produção e os demais lotes. |
| Auth/RLS | Testes locais exercitam endpoints, persistência, recusa de sessão sem autorização e acesso das tabelas dos lotes. | Homologar duas contas, SMTP, CAPTCHA, redirects, isolamento real e exclusão de conta em ambiente representativo. |
| Edge, cron e Storage | Fontes oficiais de Auth, exclusão, Loja e Mercado Pago preservadas. O inventário registra as diferenças conhecidas de JWT e os scripts permitem comparar objetos e cron sem copiá-los. | Comparar versões implantadas, verify_jwt, CORS, privilégios e dependências. Manter o cron oficial e validar backups de objetos, RLS e restore isolado. |
| Mercado Pago | Fixtures atualizadas para Orders, assinatura, validação de vendedor e moeda, cálculo em centavos, origem permitida e falha do provedor. | Autenticar checkout sandbox e entrega de webhook. Confirmar seleção da forma de pagamento em Orders e consistência de reembolsos. |
| Reembolso parcial | Correção no webhook e teste local do encaminhamento a paid_review, incluindo evento repetido. | Confirmar payload e comportamento de Orders em sandbox e reconciliar Edge e RPC implantadas. |
| Repetição de checkout | Migração candidata recupera por usuário e chave antes da cotação; testes confirmam estoque, isolamento, bloqueios e rollback. | Comparar fingerprints reais, ensaiar em restauração isolada e validar retentativa de pagamento no sandbox. |
| Backup | Procedimento de banco, objetos, isolamento, critérios RPO/RTO e reversão preparado. | Falta ponto verificado e execução comprovada de restore. |

O PR #25 segue em rascunho e os gates de liberação permanecem pendentes. Os PRs #22 e #23 seguem fora deste lote. Nenhuma alteração foi executada no banco, cron, Auth, Edge, Storage ou Vercel.

[PR #25](https://github.com/neopep/App-NeoPep/pull/25) · [CI inicial](https://github.com/neopep/App-NeoPep/actions/runs/45055909655) · [Ensaio de recuperação](../../release/production/RESTORE-REHEARSAL.md) · [Script dos lotes](../../release/production/batches/render.py)

## Verificação local anterior às correções financeiras

Build, check, invariantes da candidata, auditoria de dependências e teste de catálogo passaram. A seleção de regressões teve 89 aprovações e dois casos pendentes explícitos. A suíte de loja confirmou autorização, preços do servidor, estoque, descarte de autorização indevida, repetição do evento financeiro, expiração e separação dos ambientes de pagamento. O gate release:check continua bloqueado pelos 12 critérios pendentes e cloudValidated falso.

[Correções e plano financeiro](FINANCEIRO-PR25.md)

Na rodada das correções, os 25 testes focados passaram sem TODO. A suíte completa teve 329 aprovações e 51 falhas herdadas, sem falhas novas. O pré-voo financeiro também foi conferido no banco isolado com os fingerprints anterior e corrigido, as chaves únicas e os privilégios da RPC.
