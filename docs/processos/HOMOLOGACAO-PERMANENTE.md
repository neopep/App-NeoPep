# Homologação permanente do NeoPep

| Ambiente | Frontend | Origem Git |
| --- | --- | --- |
| Produção | `https://app.neopep.com.br` | `main` |
| Homologação | `https://teste.app.neopep.com.br` | `staging/permanente`, até a migração autorizada para `staging` |

O Supabase de homologação é `qnuluspqfazdppciermw`. Contas, sessões, arquivos, dados, credenciais, filas e dispositivos de homologação são exclusivos desse projeto. A ref existente `staging/multiagentes-homologacao` impede criar `staging` no mesmo namespace Git. Preserve a ref até aprovar sua migração.

## Vercel, DNS e PWA

- No projeto Vercel dedicado à homologação, conecte `neopep/App-NeoPep` e use a branch de homologação como branch de produção **desse projeto**. Os pushes nela passam a gerar deployments automáticos. Confirme que o projeto oficial continua ligado à main. Se o plano ou o repositório atual impedir a separação, traga o custo e a restrição para aprovação.
- Aplique proteção de acesso no projeto de homologação e conceda acesso somente aos testadores. Confirme que o domínio personalizado também exige autenticação. Use os valores de DNS exibidos pela Vercel para `teste.app.neopep.com.br` e confirme o certificado HTTPS antes de testar login, PWA e notificações.
- O build de staging valida a chave pública Supabase `NEO_STAGING_SUPABASE_PUBLISHABLE_KEY` no projeto de homologação. Configure-a na Vercel. Defina `NEO_STAGING_VAPID_PUBLIC_KEY` somente na etapa de validação de push. `NEO_STAGING_GOOGLE_ENABLED=1` e `NEO_STAGING_APPLE_ENABLED=1` são opcionais depois de configurar provedores dedicados ao staging.
- A PWA usa nome NeoPep Teste, ID e escopo canônicos `/neo/`, cache próprio e origem separada. Valide instalação, atualização, cache offline e notificações em um perfil de navegador dedicado. As páginas são servidas com `X-Robots-Tag: noindex, nofollow`.

## Auth e integrações

1. No Auth do staging, desabilite o cadastro público. Configure Site URL para `https://teste.app.neopep.com.br` e redirects exatos `https://teste.app.neopep.com.br/neo/` e `https://teste.app.neopep.com.br/`. Confirme os redirects de recuperação e a restrição de cadastro pelo endpoint de configuração.
2. Crie por administração, sem convite por e-mail, `admin-ma@example.invalid` e `participante-ma@example.invalid`, com senhas exclusivas e confirmação administrativa. Use o [SQL de preparação](../../release/staging/preparar-contas.sql) para conceder administração somente à conta fictícia designada. Prepare o perfil sintético no onboarding. Teste JWT de ambas, negação ao usuário comum, login, logout, sessão, RLS e chamadas autenticadas às Edge Functions. Use a fixture somente no estado de isolamento para o qual ela foi escrita.
3. Configure `ALLOWED_ORIGINS=https://teste.app.neopep.com.br` para as funções que exigem origem. Mantenha provas sem segredos. Crie integrações de IA com chaves, projeto, cotas e criptografia de staging (`NEO_AI_ENCRYPTION_KEY`). Teste mensagens sintéticas. Pagamentos usam exclusivamente Sandbox, webhook e origem de staging. Use somente contas e endereços de teste. Provedores Google/Apple, quando testados, usam clientes separados e callback do Auth de staging.
4. A função `auth-settings` exige decisão específica sobre o token administrativo e o escopo da gestão. Prefira a configuração pelo painel. O conector disponível executa SQL e implanta Edge Functions, mas não configura Auth ou seus usuários.

| Edge Function | Estado ou dependência de homologação |
| --- | --- |
| `ai-reply`, `agent-integrations` | Instaladas com JWT. Teste autenticado após Auth, CORS e provedor de IA de staging. |
| `push-dispatch` | Instalada com JWT. Prepare segredos e dispositivos conforme a seção abaixo. |
| `auth-settings` | Pendente de decisão sobre gestão do Auth e credencial administrativa. |
| `delete-account` | Pendente de implantação e ensaio destrutivo com conta descartável e autorização específica. |
| `platform-integrations` | Pendente de implantação e configuração das integrações de teste. |
| `mercadopago-create`, `mercadopago-webhook`, `shop-integrations` | Pendentes de configuração Sandbox e validação do checkout, assinatura, idempotência e status de pedidos. |

## Restauração de push

1. Crie VAPID exclusivo do staging. Configure `NEO_VAPID_PUBLIC_KEY`, `NEO_VAPID_PRIVATE_KEY`, `NEO_VAPID_SUBJECT` e `NEO_PUSH_CRON_SECRET` somente no projeto de homologação. No Vault, guarde o mesmo segredo como `neo_push_cron_secret` e o JWT anon legado do mesmo projeto como `neo_push_gateway_jwt`. Confirme projeto e emissor. O JWT atende ao gateway, e o segredo autoriza o worker. Use um perfil de navegador ou dispositivo descartável.
2. Antes de ligar os gatilhos, confirme zero inscrições, ambiente e CORS de staging, JWT verificado e endpoint de staging. Valide a chamada autenticada do worker com as filas vazias. O SQL [de ativação](../../release/staging/ativar-push.sql) restaura os corpos originais com o cabeçalho JWT e deixa o padrão de preferências desativado. Confira o ID no painel e a configuração `app.settings.supabase_url` usada pela guarda. O GUC estava ausente na verificação de 20/11/2026. Após conferir o projeto no painel e a URL de conexão, defina a URL esperada somente na transação ou conexão de staging como uma segunda guarda. Não altere a configuração global do banco.
3. Instale o [fallback de cron](../../release/staging/agendar-push.sql) **somente** no staging após o teste manual. Use o mesmo endpoint e cabeçalhos do SQL de ativação, com leitura dos segredos em tempo de execução e sem gravar seus valores no comando do job. Inicie com uma frequência aprovada e registre o ID do job. Desabilite-o pelo nome `neo-staging-push-fallback` antes da [reversão de push](../../release/staging/desativar-push.sql).
4. Com um dispositivo opt-in de staging, ensaie lembrete pessoal agendado, publicação na comunidade, mensagem de atendimento, novo material de biblioteca e mudanças de pedido. Confira título, corpo, destino do clique, deduplicação, retry, opt-out e remoção de inscrição expirada. Teste eventos e o fallback separadamente. Use apenas notificações fictícias e nunca reutilize inscrições da produção.

## Revisão de segurança

[Inventário dos 43 avisos e 48 ocorrências](AUDITORIA-HOMOLOGACAO.md). Execute a matriz de autorizações com contas fictícias antes de liberar acesso. Registre aceite dos grants usados pelo cliente e a decisão sobre o gatilho `rls_auto_enable()`. Mantenha a granularidade de papéis como trabalho separado.
