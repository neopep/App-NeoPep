# Integrações

| Serviço | Evidência no repositório | Validação pendente |
| --- | --- | --- |
| Supabase | SDK oficial, Auth, Storage, RPCs e Edge Functions. [Ativação](../ETAPA-2-ATIVACAO.md) | Ambiente instalado, duas contas reais, Storage privado e exclusão. |
| CAPTCHA e e-mail | Turnstile integrado e orientação de Resend/SMTP. [Conexão](../CONEXAO-SUPABASE.md) · [E-mail](../EMAIL-PRODUCAO.md) | Widget e fluxos completos em origem autorizada, entrega externa, confirmação, recuperação e limites. |
| Google e Apple | Guias de preparação. Os provedores estavam desligados na última verificação relatada. [Configuração](../CONFIGURACAO-NUVEM.md) | Decisão de ativação, credenciais, callbacks e teste efetivo. |
| Web Push | Código PWA, VAPID, `push-dispatch` e rotinas da base. [Notificações](../ATIVAR-NOTIFICACOES.md) | Agendamento, inscrições, revogação e recebimento real nos aparelhos. |
| Mercado Pago | Funções de criação, webhook e gestão das integrações. [Monetização](MONETIZACAO.md) | Conta de teste, credenciais e ciclo completo do pedido. |
| OpenAI, Gemini e Claude | Adaptadores do agente no servidor. [IA](INTELIGENCIA-ARTIFICIAL.md) | Seleção, autorização, quotas e testes reais. |
| Hospedagem e pacotes nativos | Manifesto estático, configuração Vercel e exemplo Capacitor. [Vercel](../VERCEL.md) · [Mobile](../../mobile/README.md) | Origem e audiência reais, QA dos dispositivos e implementação nativa. |

A árvore de Edge Functions inclui `auth-settings`, `delete-account`, `push-dispatch`, `platform-integrations`, `agent-integrations`, `ai-reply`, `shop-integrations`, `mercadopago-create` e `mercadopago-webhook`. A implantação de cada função tem verificação própria. [Funções](../../supabase/functions/)

## Ignored Build Step do Vercel

Em 20/11/2026, o responsável confirmou que salvou no projeto `app-neopep`, no modo Custom, o comando abaixo. A lógica foi validada com o Git local. O resultado da execução no Vercel permanece **não verificado**.

```sh
test -n "$VERCEL_GIT_PREVIOUS_SHA" && git diff --quiet --no-renames "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':!docs/**/*.md' ':!AGENTS.md' ':!CLAUDE.md' ':!GEMINI.md' ':!CHANGELOG.md' ':!.github/copilot-instructions.md'
```

O Vercel ignora a compilação com saída `0` e pode prosseguir com saída diferente de zero. As aspas preservam o padrão para o Git, com os asteriscos sem barras invertidas. A exclusão abrange apenas os caminhos listados. O passo pode permitir a compilação se o SHA anterior estiver vazio (`1`), se o objeto estiver ausente no checkout (`128` na simulação) ou se o diff acumulado incluir alterações fora da lista (`1`). O SHA usado pelo Vercel pode anteceder a ponta anterior da `main`. Um resultado local com a base esperada cobre somente essa comparação. [Registro da validação](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-002)

## Identidade Git e Vercel

O responsável informou que o Vercel bloqueou uma publicação porque o e-mail de autoria do commit anterior não estava verificado no GitHub. O checkout herdava a identidade global. A correção gravou nome e e-mail autorizados com `git config --local` e conferiu as identidades efetivas do autor e do committer. A verificação da conta e o reconhecimento pelo Vercel dependem dos respectivos serviços. [Registro técnico](../memoria/HISTORICO-DE-ALTERACOES.md#mem-20261120-003)

A configuração local fica em `.git/config`. O checkout reaberto manteve a identidade, mas uma clonagem nova pode herdar a configuração global. Para provisionamento repetível, o Codex Cloud oferece um script de instalação salvo. Em revisão futura, esse script pode aplicar `git config --local user.name` e `git config --local user.email` com valores autorizados fornecidos nas configurações privadas do ambiente, quando disponíveis. Confira os quatro comandos do [AGENTS.md](../../AGENTS.md) também antes de cada commit, porque uma restauração pode reutilizar o snapshot sem executar o script e variáveis de ambiente podem mudar a identidade efetiva. Preserve a configuração global e mantenha endereços pessoais fora da documentação.
