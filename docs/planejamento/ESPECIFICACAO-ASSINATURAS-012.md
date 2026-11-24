# Especificação detalhada — #012 Assinaturas, planos, recursos e pagamentos
Versão 2.0 | 24/11/2026 | Planejamento, nenhum checkout recorrente integrado nesta revisão.

## Objetivo aprovado
Painel administrativo controla planos, benefícios, regras Free/Premium, trial, quotas, acesso manual gratuito a usuários e assinatura recorrente PWA por Mercado Pago. Futuramente suportar billing Apple/Google sem amarrar o modelo de direitos ao provedor, mas **não integrar lojas nativas agora**. O aplicativo deve mostrar Minha assinatura. O administrador deve conseguir mudar planos/benefícios/limites sem modificar código depois que a infraestrutura inicial estiver instalada.

## Base real encontrada
- Loja atual possui checkout próprio Mercado Pago e webhook, que devem ser preservados integralmente.
- A tabela privada campaign_plans existe nos bancos Teste e Produção para segmentação de campanhas; documentação informa que seu vínculo é administrativo e NÃO um sistema de assinaturas e faturamento.
- Premium/limites existentes precisam de inventário próprio no código e no banco antes de escolher nomes de recursos, para não duplicar lógica de bloqueio.
- Ainda não foi testado evento recorrente de assinatura real. Não deduzir isso de pagamento de produto bem-sucedido.

## Navegação
Painel Administrativo → Assinaturas e Pagamentos com:
1. Planos — criar/editar/ativar/desativar, preços, periodicidades, trial, versão, descrição e ordem de exibição.
2. Funcionalidades — catálogo de recursos controláveis; matriz plano × recurso, limites e regras.
3. Assinantes — lista com usuário, plano comercial, situação financeira, acesso efetivo, validade, testes e filtros.
4. Gerenciar acessos — conceder manualmente, ajustar limites individuais, suspender/revogar concessões; também em Admin → Usuários → Gerenciar assinatura.
5. Pagamentos — eventos recorrentes, histórico de cobrança, falhas, retries, cancelamentos, reembolsos e reconciliação.
6. Relatórios — assinantes ativos, novos, cancelados, trials, conversão, receita recorrente verificada, estornos e inadimplência; não somar vendas da Loja a MRR.
7. Integrações — status, webhooks próprios, modo Teste/Produção e versões de provedores, sem mostrar segredos no frontend.
Usuário final → Minha assinatura com plano, benefícios, limites restantes, data de renovação, histórico permitido e gerenciamento/cancelamento segundo regras contratuais.

## Modelo de planos
### Campos
- ID imutável, slug, nome, descrição curta/longa, código interno, ordem de exibição e status: rascunho, disponível para novas assinaturas, oculto para novas vendas ou encerrado para novos.
- Moeda, preço e periodicidade (mensal, anual etc.), modo promocional, validade de oferta, número de dias de teste grátis, política de início de cobrança, eventuais impostos e regras de renovação.
- Versão da oferta, início de vigência, migração dos assinantes legados e observação administrativa.
- Desativar um plano para novas vendas NÃO deve encerrar automaticamente assinaturas vigentes.
- Alterar preço de um plano não implica cobrar preço novo de contratos existentes sem regra/procedimento compatível e aviso; manter snapshot da oferta por assinatura.

### Matriz de direitos
Chave técnica imutável por funcionalidade implementada; nome de apresentação configurável. Exemplos: weight.record, weight.history, measures.record, photo.compare, calculator.use, library.access, nutrition.use, community.access, ai.requests, ai.tokens, exports.create, media.storage.
Valores por plano: enabled, unlimited, trial_days, max_uses, max_per_day, max_per_month, max_items, storage_bytes, ai_credit_budget, renovação de cota. Nem todo recurso aceita todos os tipos; usar esquema tipado, com validação.
O catálogo precisa ser derivado de recursos implementados; criar recurso no painel não produz código funcional por mágica. Uma vez registrado, habilitar/desabilitar no plano não exige deploy.
Permissões devem ser verificadas no servidor para mutações e conteúdos pagos; ocultar botão no frontend é apenas UX. Recursos privados não ficam públicos por compartilhar link.

## Motor de acesso efetivo (entitlements)
Separar três fontes:
A. Plano contratado financeiramente — relação assinante/provedor/ID externo/status/período.
B. Plano ou acesso concedido manualmente por administrador — sem cobrança e sem mexer na assinatura financeira.
C. Exceções por recurso/limite do usuário, com motivo, autor e data de validade.
O acesso efetivo resulta da avaliação versionada dessas fontes, com regras de precedência explícitas e auditáveis. Proposta inicial: revogação de segurança sempre prevalece; uma concessão manual pode complementar acesso de um plano pago sem cancelar cobrança; uma exceção individual substitui somente o recurso designado; expiração remove a exceção; fallback ao plano Free. Essa precedência precisa ser validada em testes e confirmada antes de publicação.
Distinguir data/hora de vigência de acesso e data de próxima cobrança, fuso UTC no servidor e apresentação local. Não exigir pagamento em um recurso que já foi concedido grátis enquanto concessão válida.

## Administrador → Gerenciar acessos
Fluxo:
1. Buscar usuário por nome, e-mail ou identificador autorizado.
2. Ver perfil mínimo, plano comercial, status da cobrança, nível efetivo, fontes de direito, usos e validade.
3. Escolher Atribuir plano de cortesia sem cobrança (7, 30, 90, 365 dias, personalizado ou indefinido), Suspender acesso, Revogar concessão, Alterar limite por recurso ou Liberar recurso extra.
4. Opcionalmente inserir motivo interno; destacar se há assinatura paga ativa e mostrar aviso que **a concessão não cancela cobrança existente**.
5. Prévia dos direitos antes/depois, confirmação, evento auditável (admin, horário servidor, mudança, validade, motivo) e notificação ao usuário quando aplicável.
6. Ao expirar cortesia, recomputar direitos sem apagar registros da pessoa; respeitar paid plan vigente caso exista.
Não permitir que admin manipule dados de cartão nem registre assinatura paga fictícia para liberar acesso.

## Teste grátis e quotas
- Trial por plano e por recurso, configurável por dias desde evento de ativação definido; impedir reinícios ilimitados por logout/reinstalação.
- Exemplo aprovado de conceito: registro de peso disponível gratuitamente por 30 dias, depois exigir plano conforme configuração. Não significa que esta política já esteja ativada.
- Quota por janela: uso diário/mensal, mensagens, tokens, armazenamento, quantidade de registros; reset por relógio de servidor, transação idempotente e visibilidade do saldo ao usuário.
- Para IA, debitar estimativa ou consumo real sem expor prompts/dados sensíveis a publicidade; registrar custo, fornecedor e tokens quando dados confiáveis existirem.
- Falha no monitoramento de cota não pode gerar cobrança silenciosa. Definir comportamento seguro quando serviço indisponível.
- No downgrade, manter dados históricos privados; restringir novas ações conforme plano, com exportação e comunicação das regras.

## Mercado Pago recorrente (PWA)
### Arquitetura proposta
Adapter separado de billing para recorrência, sem sobrescrever mercadopago-create nem mercadopago-webhook da Loja. Cada assinatura possui identificador interno e externos, account_id, plano/versão/oferta, provedor, status financeiro, current_period_start/end, cancel_at_period_end, trial_start/end, próxima cobrança e timestamps.
Eventos do provedor entram por endpoint separado, com verificação de autenticidade, deduplicação por ID de evento, processamento idempotente, reconciliação ativa e logs redigidos. Não confiar só no retorno do navegador.
Estados sugeridos: iniciada, trial, ativa, pagamento pendente, cobrança falha, suspensa, cancelada para renovação, encerrada, reembolsada, disputa. A matriz de transições deve seguir os eventos reais da API confirmados na implementação.
A oferta e o preço exibidos devem corresponder ao preço efetivamente contratado. Nunca conceder Premium com base em evento não verificado.
### Operações
Assinar, consultar, atualizar método quando suportado, cancelar agora ou no fim do ciclo conforme política, tratar reembolso, reativação e troca de plano com regras de prorrata explicitadas. Proteger contra cliques duplicados, callbacks fora de ordem e indisponibilidade do provedor. Reconciliar assinaturas ativas periodicamente sem sobrecarregar API/custo.
### Testes
Sandbox/credenciais de Teste, uma conta fictícia, webhook autenticado, evento repetido/fora de ordem, cancelamento, cobrança falha e recuperação, troca de plano, conflito com cortesia grátis, indisponibilidade de banco e manutenção de direitos Free. Produção só após homologação e autorização explícita.

## Apple e Google futuros
Arquitetura provider-neutral desde o início: financial_subscriptions, provider_events, entitlements separados; recibos e notificações Apple/Google validados no backend quando integrações forem autorizadas. Não assumir que pagamento Mercado Pago para recursos digitais pode ser oferecido dentro do app nativo; revisar regras atuais das lojas e países no momento do lançamento. Não criar configurações secretas das lojas antes da necessidade.

## Esquema conceitual proposto — nomes sujeitos ao catálogo existente
- plan_catalog: planos e visibilidade comercial.
- plan_versions: condições imutáveis da oferta.
- feature_catalog: recursos implementados e tipos de limite.
- plan_feature_rules: direito e quotas por versão.
- subscription_contracts: vínculo financeiro/provedor.
- subscription_payment_events: eventos deduplicados (sem dados sensíveis de pagamento).
- manual_access_grants: concessões, suspensões e validade.
- individual_feature_overrides: exceções por usuário.
- quota_ledger: consumo idempotente e resets.
- entitlement_snapshots (opcional): cache invalidável, nunca autoridade independente.
- admin_access_audit: trilha de mudanças.
Usar neo_private e RPC/Edge autorizada, RLS, constraints, índices, chave de idempotência, política de retenção e deleção, sem expor segredos ou dados financeiros. Evitar confundir o conceito antigo campaign_plans com plan_catalog.

## Métricas e relatórios
MRR somente de contratos financeiros ativos, normalizado por período; não contar cortesias, trials não pagos e total de vendas de produtos; exibir cancelamentos, churn com denominador e período, conversão de trial, receita observada, inadimplentes e taxa de falhas. Cada métrica deve ter definição, fonte e data de atualização. Dados financeiros não devem aparecer para membro comum.

## Subetapas aprovadas para execução futura
012.1 auditoria Premium e esquemas;
012.2 catálogo de recursos/versões de plano;
012.3 enforcement server-side com RLS/limites;
012.4 painel Planos/Funcionalidades;
012.5 concessões manuais e Usuários;
012.6 Minha assinatura e testes Free/Premium;
012.7 adapter Mercado Pago e sandbox;
012.8 reconciliação/webhooks próprios e relatórios;
012.9 ativação controlada em Produção;
012.10 documentação futura Apple/Google, sem integração de cobrança nativa.

## Critérios de aceite essenciais
- Administrador cria 3 planos distintos e alterna recurso/limite sem nova publicação de código.
- Cortesia de 30 dias não cria cobrança nem cancela assinatura paga existente.
- Cortesia expirou: direitos recalculados, dados do usuário preservados.
- Plano/recursos Premium protegidos no servidor, inclusive URL direta/RPC e troca de conta.
- Limites não podem ser contornados por dois dispositivos simultâneos ou múltiplas chamadas.
- Pedido de produto da Loja continua no mesmo webhook/ciclo; alteração de assinatura não reprocessa pedido.
- Cobrança real não é ativada sem confirmação independente de payload/evento, pagamento de teste e aceite do usuário.
