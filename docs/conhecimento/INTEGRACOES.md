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
