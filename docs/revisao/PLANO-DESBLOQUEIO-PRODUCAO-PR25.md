# NeoPep — plano objetivo de desbloqueio da Produção (PR #25)

**Atualizado em 22/11/2026.** Estado consultado diretamente no GitHub, Supabase e configuração versionada. **Não é autorização para deploy nem DDL.** O objetivo é disponibilizar a candidata sem substituir silenciosamente funções, dados ou pagamentos atuais.

## Diagnóstico verificável do bloqueio

- Pull request [#25](https://github.com/neopep/App-NeoPep/pull/25) **aberto, DRAFT**, base `main`, branch `release/preparacao-paridade-producao-20261122`. Sem merge.
- GitHub Actions [#45078762590](https://github.com/neopep/App-NeoPep/actions/runs/45078762590): **job “Candidata sem deploy” passou**; o job separado **“Gate de evidências” falhou** porque executou `npm run release:check` e os critérios de liberação não estão satisfeitos. Isso **não** é falha de build.
- `release/web-readiness.json` tem **12 checks marcados `pending`**, sem evidência de verificação; `scripts/release-check.cjs` exige **todos** com `status=verified` e `evidence` preenchido.
- **Abertura pública solicitada pelo proprietário.** A candidata agora contém `publicRegistration: true` e `previewRegistration: false`; `cloudValidated: false` foi preservado até verificação remota. CAPTCHA e e-mail estão configurados **no frontend**, mas SMTP, Auth signup, CAPTCHA real e redirects não foram comprovados; Google e Apple estão desabilitados no frontend. No `main` ainda consta `publicRegistration: false` e `previewRegistration: true` — **nenhuma alteração foi promovida ao site em produção**. A flag de preview também permite tentar cadastro na UI de uma prévia alcançável, portanto não substitui o controle de signup do serviço Supabase Auth.
- `vercel.json` mantém `git.deploymentEnabled["release/preparacao-paridade-producao-20261122"]=false`. Portanto não se pode alegar um deployment READY desta candidata com base apenas no CI; é necessária verificação no projeto Vercel correto, após planejamento e autorização.
- O banco de Produção tem schema e dados em uso apesar de ledger de migrações consultado vazio; Teste tem 16 versões, quatro não correspondentes 1:1 aos arquivos Git. Uma implantação automática do baseline é indevida.
- A versão implantada de `mercadopago-webhook` em Produção não possui tratamento explícito de reembolso parcial na auditoria do código. A correção candidata ainda não passou homologação real no sandbox.
- Há backup do banco e 34 objetos Storage exportados, mas **nenhum ensaio de restauração completa do backup oficial**. O proprietário autorizou prosseguir na auditoria sem reboot/Docker nesta rodada; essa escolha não comprova recuperação.

## Ordem de execução para tirar o NO-GO

| Ordem | Gate / verificação | O que falta para marcar concluído | Pode ser resolvido sem publicar? |
|---:|---|---|---|
| 1 | Escopo | Confirmar que a primeira liberação será **controlada** ou **pública completa**, e quais módulos ficam inertes; preservar PRs #22/#23 fora do pacote | SIM |
| 2 | Compatibilidade de banco | Conferir o delta com catálogo atual, ledger, ACLs, funções oficiais, cron e 7 lotes sem replay de migrações históricas | SIM (somente leitura + clone) |
| 3 | Recuperação | Testar restauração do banco e objetos em destino **isolado autorizado**; se impossível nesta rodada, registrar exceção e decisão consciente **sem dizer que passou** | SIM em clone, sujeito a infraestrutura |
| 4 | Autorização e privacidade | Com **duas contas descartáveis**: login, troca de usuário, permissão de administrador, exclusão/exportação de dados, acesso anônimo a Storage e RLS | SIM em Teste / ambiente isolado |
| 5 | Pagamentos | Checkout, mesma chave de idempotência, webhook com HMAC, reembolso parcial/total, duplicidade e mismatch com contas **sandbox**, sem operações financeiras reais | SIM com configuração sandbox isolada |
| 6 | Infra externa | Vercel: projeto e domínio corretos, env vars *sem exibir segredos*, branch/deploy, HTTPS, CORS, Auth redirects, CAPTCHA e SMTP/recuperação | PARCIAL: preview controlado primeiro |
| 7 | PWA e notificações | Navegadores móveis, instalação/atualização, consentimento de push; definir por escrito se push fica inerte na liberação | SIM em preview |
| 8 | Operações legais | Informações públicas de privacidade, controlador, contato, prazos de retenção e processo de suporte | SIM |
| 9 | Autorizações separadas | Proprietário aprova expressamente **lotes SQL**, eventual **Edge**, **frontend/Vercel**, **merge** e exposição de cadastro; não agrupar ações irreversíveis | Exige decisão |
| 10 | Pós-publicação | Verificar SHA realmente servido, HTTPS, Auth, pedidos, logs, disponibilidade e rollback; registrar evidência **depois** do deploy controlado | NÃO: pós-deploy |

### Regra contra bloqueio circular

O item `public_url_https` exige a candidata `READY` após autorização, mas o gate atual bloqueia qualquer merge antes de todos os itens estarem verificados. **Não declarar esse item verificado sem publicação.** Resolver com duas etapas distintas de evidência: (a) confirmar URL/HTTPS e deployment da candidata em **preview não público**; (b) confirmar a versão oficial `READY` em checklist **pós-publicação**. Se a política exigir o deployment oficial antes do merge, a política deverá ser revisada e formalmente aprovada — não contornada com alteração de JSON.

## Proposta de primeira liberação controlada (não aprovada)

- Preservar o banco e as Edge Functions de Produção até a reconciliação apropriada; **não sobrescrever** Auth, `delete-account`, Mercado Pago, push ou atendimento existente.
- Manter por padrão `publicRegistration=false` se o objetivo inicial for disponibilizar a nova versão a contas existentes/autorizadas, sem abrir cadastros a todos.
- Manter **campanhas push automáticas, agentes extras e canal Windows Connect** desativados/inertes; ativar mediante homologação específica. Essa limitação não elimina necessidade de testar segurança das partes liberadas.
- Se o frontend novo exigir tabelas não implantadas, **não liberar suas telas funcionais** antes de migrar o conjunto necessário com rollback e autorização; conferir contrato por tela/API.
- Se a Loja real for mantida, preservar suas funções implantadas até completar sandbox. Caso nova UI introduza diferenças de pagamento sem compatibilidade demonstrada, impedir checkout na candidata enquanto o fluxo não for aprovado. Não assumir que desligar a Loja é possível sem alteração explícita e teste da UI.
- O PR #25 exclui as entregas dos PRs #22/#23; não anunciar estes recursos como publicados por este PR.

## O que PODE ficar para depois e o que NÃO pode ser ignorado

**Adiável apenas se fora do escopo/efetivamente desativado:** novos agentes multiagentes, distribuição Windows, campanhas automáticas, observabilidade externa, novas funcionalidades de PRs #22/#23. O teste completo dos fluxos opcionais desativados pode ir para uma liberação específica posterior.

**Não ignorar:** isolamento entre contas, autenticação, acesso aos dados privados, compatibilidade das funções que realmente serão servidas, comportamento de pagamentos ativos, verificação de domínio e configuração Vercel, reversibilidade da publicação e autorização explícita de cada mudança. O ensaio de restauração foi adiado, mas permanece risco relevante e deve ser reavaliado antes de alterações de banco.

## Pendências atuais do release-check (fonte `release/web-readiness.json`)

1. `public_url_https` — Vercel/HTTPS/READY
2. `auth_email_delivery` — SMTP, confirmação, recuperação
3. `auth_redirects_captcha` — URLs exatas e Turnstile
4. `two_account_isolation` — usuário A não acessa conta B
5. `private_storage` — leitura/escrita privada e anônima
6. `delete_account` — Edge/remoção com conta descartável
7. `export_restore` — exportação de conta, arquivos e recuperação
8. `legal_operations` — controlador, retenção, contato e direitos
9. `catalog_release` — migração financeira, Orders/webhook sandbox
10. `iphone_android` — Safari/Chrome, PWA e anexos
11. `backup_monitoring` — recuperação e capacidade de reversão
12. `notifications_scope` — push testado ou escopo limitado documentado

Além disso `cloudValidated` é `false` na configuração oficial da candidata.

**Decisão ao atualizar este documento: continuar NO-GO até que as evidências e autorizações da publicação escolhida sejam obtidas. Não apagar checks, não preencher status falsamente e não desbloquear o merge só para ficar verde.**

## Preparação objetiva da abertura pública — 22/11/2026

- **Pedido do proprietário:** liberar acesso e novas contas para qualquer pessoa, não apenas usuários existentes.
- **Feito no PR #25:** `dist/config.js` mudou para `publicRegistration=true` e `previewRegistration=false`, sem alterar `cloudValidated=false` nem ligar Google/Apple ficticiamente.
- **Feito no PR #25:** `scripts/release-check.cjs` exige formalmente o modo público (sem preview) e `tests/release-check.test.cjs` verifica o bloqueio de configurações incorretas. O pipeline [#45079446202](https://github.com/neopep/App-NeoPep/actions/runs/45079446202) aprovou o job **Candidata sem deploy**; o gate de evidência segue propositalmente bloqueado.
- **Read-only Supabase Produção:** dentre 17 relações tabelares inspecionadas nos schemas `public` e `storage`, todas exibem RLS ligado, nenhuma apareceu com acesso direto sem RLS. Isso **não prova** isolamento nas políticas nem segurança de `SECURITY DEFINER` — continuar testes cruzados e de signup.
- **Pendente essencial externo:** Supabase Auth precisa permitir novos usuários de fato (Settings → Authentication → Allow new users to sign up), ter confirmação SMTP verificável, redirect e CAPTCHA Turnstile configurados; conferir separadamente as configurações [Auth/Providers](https://supabase.com/dashboard/project/cpslafpzjtbpmoxxysaa/auth/providers), [Auth SMTP](https://supabase.com/dashboard/project/cpslafpzjtbpmoxxysaa/auth/smtp), [URL Configuration](https://supabase.com/dashboard/project/cpslafpzjtbpmoxxysaa/auth/url-configuration) e [Protection](https://supabase.com/dashboard/project/cpslafpzjtbpmoxxysaa/auth/protection). O conector atual não expõe as configurações de Auth, e nenhuma foi alterada.
- **Pendente essencial Vercel:** integração de Vercel não conectada neste ambiente; configuração do candidato bloqueia publicação automática de sua branch. Validar projeto/branch/READY/domínio e só então efetuar deploy após assinatura do plano de release. Não confundir um CI verde com deploy verificado.
- **Não concluído:** full público não está servido. Sem testes de pagamento e cross-account, não declarar aptidão para uma liberação irrestrita.

## Atualização de escopo após confirmação do proprietário — 22/11/2026

**Origem:** proprietário confirmou que o projeto Teste é cópia da Produção e que **não promoveu mudanças intencionais em contas/Auth nem Mercado Pago** no Teste. A fonte oficial desses módulos permanece a Produção, não a diferença de Teste.

- A função `supabase/functions/mercadopago-create/index.ts` da candidata foi restaurada ao mesmo blob Git da `main` (`5e9fc48c...`), assim como `mercadopago-webhook/index.ts` (`9886398a...`). **Não existe substituição de Edge financeira em escopo no lançamento inicial**.
- As propostas opcionais de correção do provedor, preservadas para possível trabalho futuro, estão em `release/production/optional-finance/mercadopago-*/`. Os testes dessas propostas não representam uma autorização ou alteração da Produção.
- A migração de checkout `20261122190100_shop_checkout_retry.sql` saiu de `supabase/migrations` e está somente em `release/production/optional-finance/`. O lote `07-financeiro` está marcado **optional=true** e **SEPARATE_FINANCE_RELEASE_ONLY**. A primeira abertura pública **não executa** esse lote. Os ensaios sintéticos continuam cobrindo-o para futuro uso separado.
- Incluído teste CI que confere os hashes Git da implementação financeira ativa contra os blobs oficiais, além da exclusão da migração do diretório automático.
- Confirmada por leitura Supabase a permanência das Edge oficiais `mercadopago-create` v16, `mercadopago-webhook` v11, `auth-settings` v12 e `delete-account` v8, todas ACTIVE. **Nenhuma Edge ou migração foi aplicada na Produção.**
- **Imagem recebida do painel Vercel:** a linha `app-neopep-staging` aparece `Ready`, com ambiente `Production` **do próprio projeto de homologação** e branch `staging/permanente`. As linhas `app-neopep` exibidas são tentativas `Preview` com status `Error`. A imagem **não mostra nem comprova o deployment de Produção atual de `app-neopep`**. Abrir um deployment `Error` de `app-neopep` e inspecionar **Build Logs** e aba de configuração Git/Production antes de alterar qualquer projeto.
- O checkout e o login oficiais, apesar de preservados, ainda requerem smoke tests funcionais controlados para exposição pública; e-mail de confirmação, Auth redirects, CAPTCHA e isolamento de dados de novos usuários não são comprovados pela origem copiada.

**Gate:** continua NO-GO até os fluxos públicos essenciais passarem. A remoção de novas mudanças financeiras reduz o escopo, mas não torna os pagamentos atuais automaticamente homologados.
