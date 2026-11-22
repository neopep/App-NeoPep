# Auditoria autenticada de Edge Functions e Mercado Pago Orders — 22/11/2026

**Escopo:** versões/metadados de implantação lidos diretamente do Supabase oficial e de Teste; revisão das fontes versionadas no PR #25 e dos testes sintéticos, **sem chamar a API de pagamentos, sem criar pedidos, sem chaves e sem deploy**. Todas as versões listadas estavam `ACTIVE` na consulta. **NÃO é homologação real em sandbox.**

## Inventário de funções ativas

| Função | Produção — versão / `verify_jwt` | Teste — versão / `verify_jwt` | Ação segura |
|---|---|---|---|
| `mercadopago-webhook` | v11 / false | não instalada | Preservar até homologar substituição; valida assinatura HMAC no handler. |
| `mercadopago-create` | v16 / false | não instalada | Preservar até homologar contrato de Orders, JWT interno e idempotência. |
| `shop-integrations` | v9 / false | não instalada | Não sobrescrever. |
| `auth-settings` | v12 / true | não instalada | Não sobrescrever. |
| `delete-account` | v8 / false | não instalada | Não sobrescrever. |
| `ai-reply` | v9 / false | v6 / true | Não substituir binário nem gateway sem validar autorização interna. |
| `push-dispatch` | v3 / false | v4 / true | Preservar cron oficial e autenticação interna; não duplicar notificações. |
| `agent-integrations` | v8 / false | v4 / true | Manter implantação oficial; separar agentes inertes. |
| `platform-integrations` | v7 / false | v3 / true | Manter implantação oficial; observabilidade staging-only não deve virar endpoint público. |
| `connect-update` | não instalada | v2 / true | Canal Windows oficial ainda bloqueado. |
| `connect-release-draft` | não instalada | v2 / false | Não usar credencial/agente de Teste no canal oficial. |

`verify_jwt=false` apenas indica que a verificação de JWT não é exigida no gateway. **Não significa automaticamente rota pública sem proteção; o handler deve autenticar cada operação, e isso ainda requer testes.** Nunca mudar `verify_jwt` sem aprovar o contrato do endpoint.

## Contrato financeiro identificado

**Produção live** (somente leitura da função implantada):
- `mercadopago-webhook` **v11** usa HMAC SHA-256 para o cabeçalho de assinatura e consulta `GET /v1/orders/{id}` para obter o status real, mas **não contém tratamento explícito de `partially_refunded`**. Os eventos podem ser classificados incorretamente. A origem oficial **ainda não recebeu** a correção.
- `mercadopago-create` **v16** valida a conta por token internamente e envia `X-Idempotency-Key` para `POST /v1/orders`. O gatilho de idempotência do banco ainda depende da rotina oficial pré-migração.

**Candidata na branch do PR #25**:
- A fonte `supabase/functions/mercadopago-webhook/index.ts` reconhece `status_detail=partially_refunded` no pedido ou pagamento e encaminha `p_status=partially_refunded` à revisão financeira. Conferir casos múltiplas transações/reembolsos para não tratar indevidamente estados mistos.
- A fonte `supabase/functions/mercadopago-create/index.ts` mantém `X-Idempotency-Key`; a migração financeira versão `20261122190100` corrige a recuperação de pedidos repetidos com a mesma chave mesmo após carrinho esvaziado, sujeita a fingerprint e testes no clone.
- `tests/shop-payments-edge.test.cjs` usa mocks de HTTP/Supabase; o ensaio PostgreSQL 17 usa dados sintéticos. **Não houve autorização para compras/transações sandbox reais nem foram inspecionadas credenciais**, logo qualquer afirmação de homologação externa seria incorreta.

Documentação oficial de referência:
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/refund-order/post
- https://www.mercadopago.com.br/developers/pt/docs/mp-point/resources/migrate-payment-intent-to-orders?scope=prod

## Sequência obrigatória de homologação em SANDBOX

1. Confirmar conta de teste do Mercado Pago, credenciais sandbox e recebedor correspondente **sem expor tokens em logs, GitHub ou ChatGPT**. Usar destino isolado sem tráfego real da produção e sem cron oficial.
2. Ensaiar recuperação de um pedido com a **mesma chave** após o carrinho ter sido esvaziado; confirmar retorno do mesmo order ID, mesmo total/frete/endereço e nenhuma nova reserva ou cobrança; com chave distinta, criar transação independente após nova cotação.
3. Ensaiar `processed` com `status_detail=partially_refunded` no pedido e em transação; confirmar `paid_review` em vez de `approved`, sem liberar estoque/entrega equivocadamente, inclusive repetição do mesmo webhook (um evento lógico).
4. Ensaiar reembolso integral, chargeback, cancelamento, pendente, falha, múltiplas transações, inconsistência de moeda/recebedor/ambiente/valor e retorno indisponível; manter revisão/pendência em vez de aprovação fictícia.
5. Rejeitar assinatura inválida/expirada, id divergente e ordem de outra conta; testar permissões de `authenticated`, RLS, origem CORS, dados sensíveis e idempotência de notificações.
6. Examinar tentativas históricas de pagamento **sem link persistido** e preparar reparo por identidade e pedido, sem criar cobrança duplicada.
7. Registrar evidências desidentificadas dos casos, tempos, respostas, IDs de teste mascarados, status DB, versão do binário, rollback e decisão operacional. Somente depois submeter separadamente o lote SQL e a publicação Edge à autorização humana.

## Riscos de promover Edge automaticamente

- A implantação oficial de Auth, loja, conta e pagamentos já difere da homologação; nunca copiar a lista de Edge do Teste em bloco.
- O banco oficial possui `pg_cron` para push, o Teste não. Preservar permissões e controle de emissão; push/campanhas continuam inertes até consentimento e validação.
- Publicar uma Edge de webhook antes da migração financeira/contratos pode mudar o comportamento de pedidos reais. Conservar binários oficiais até uma janela autorizada e reversível.

**Status de pagamento:** código com correção preparado + testes sintéticos; **sandbox real PENDENTE**. **PR #25 ainda NO-GO**.
