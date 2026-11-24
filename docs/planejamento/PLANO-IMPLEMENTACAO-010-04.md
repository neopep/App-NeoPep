# Plano executável — #010.04, custos e aquisição no editor existente da Loja
Data: 24/11/2026 · Foco atual após 010.03-B · **PROPOSTO / A IMPLEMENTAR, NÃO PUBLICADO**

## Referências e evidência existente
- Fonte canônica: docs/planejamento/ESPECIFICACAO-LOJA-010-011.md; decisões históricas em PLANO-MESTRE-NEOPEP-2026-11-24.md; PR #50 e relatório 010.03-A.
- Base anterior: Git staging/permanente @ 0970ae6. **Ambiente Supabase Teste já contém a migração** `shop_cost_foundation`, ledger remoto `20261124164148`, gerado de arquivo Git `20261124160000_shop_cost_foundation.sql`. Não reaplicar.
- 010.03-B: inspeção SQL de leitura em Teste confirmou quatro tabelas RLS=true, tabela/view sem SELECT direto para anon/authenticated/service_role, funções internas sem EXECUTE para esses papéis, view `shop_acquisition_costs` com `security_invoker=true`, registros de custos/movimentações = 0. **Não foram feitos testes autenticados com conta real, checkout integrado ou concorrência multi-sessão contra Teste**.
- Editor real: `dist/shop.js` função `productForm()` contém `field('price', 'Preço em reais', ...)` e `field('stock','Estoque disponível',...)`. Preservar esses campos e formulário, suas validações e fluxo de salvar produto. `src/app.js` e `src/cloud.js` e qualquer origem geradora devem ser localizados antes de editar `dist`.
- **Risco material:** a fundação de dados é privada e inacessível diretamente a `authenticated` e `service_role`. Não tentar consulta client-side, GRANT indiscriminado nem `SECURITY DEFINER` improvisado. É necessária camada administrativa autenticada com ACL real; revisar o modo seguro de invocação no NeoPep atual.

## Escopo aprovado pela especificação
Adicionar ao **mesmo editor de produto em Loja → Gerenciar** uma área integrada "Custos e aquisições" que:
1. distingue **custo não informado** de custo explicitamente R$ 0,00;
2. captura **moeda BRL ou USD**, custo **unitário**, data da aquisição, quantidade adquirida, fonte/cotação e data do câmbio quando USD;
3. preserva valores anteriores; aquisição deve gerar histórico auditável, não sobrescrever registro anterior nem recalcular pedidos passados;
4. mostra custo unitário convertido em BRL, total da compra, referência de cotação, estado de salvamento, falha e confirmação, de forma acessível e responsiva;
5. mantém custos **visíveis somente para administradores autorizados**, com defesa no servidor, nunca no catálogo público ou payload de compradores;
6. **não cria um segundo estoque** nem duplica campos já existentes;
7. **não altera checkout, criação de pedido, reserva existente, webhook, credenciais, status de pagamento ou baixa automática**.

## Decisões e segurança obrigatórias antes de codificar
- O custo médio ponderado móvel é **proposta do diagnóstico**, não política contábil formalmente aceita. Registrar decisão explícita e testes para compras com custo conhecido/desconhecido e devoluções.
- Diferenciar **"Informar custo histórico de estoque atual"** (somente custo; não inventar compra nem somar saldo) de **"Registrar aquisição/entrada de estoque"** (entrada real com quantidade, motivo e atualização transacional do stock). Não lançar aquisição e incrementar estoque por conveniência sem esta escolha clara.
- Contrato admin versionado: sessão verificada, `public.neo_admin_access()` ou verificador server-side equivalente; entidade privada protegida; chave idempotente; checagem de saldo/revisão do produto; rejeição de tentativa concorrente; retornar apenas campos admin necessários.
- A função interna `neo_private.shop_record_stock_adjustment` foi preparada para futura RPC e não está liberada diretamente ao browser. Identificar wrapper/API de privilégio mínimo, se necessário criar nova migração aditiva **apenas no código** e testar em PostgreSQL isolado. Não aplicar migração remota adicional sem plano de revisão.
- Conversão USD→BRL: taxa positiva, origem verificável, data/hora e valor imutável; nunca utilizar cotação atual para reescrever história.
- Dinheiro: parsing locale pt-BR preciso, armazenar inteiros/decimal conforme contrato; nunca usar float para cálculos monetários persistidos. Validar campos e rejeitar entrada parcial/ambígua. Não fazer custo ausente virar zero.
- Se os direitos atuais de service_role parecerem insuficientes, usar papel e caminho efetivamente autorizado pelo projeto; **não conceder acesso global às tabelas de custo**.
- Para produto duplicado: não copiar aquisições/CMV do produto original como se fossem compra nova; investigar a cópia do saldo existente e não alterá-la neste módulo por acidente.
- Em caso de conflito de versão ou falha, nenhum saldo/custo parcial deve ser gravado. Logs sem segredos ou dados pessoais.

## Sequência de implementação sugerida
- **010.04.1** Mapear `productForm()`, submissão do produto, `src/cloud.js`, ACL administrativas, hooks de UI e armazenamento de custo. Registrar baseline e efeitos colaterais.
- **010.04.2** Definir contrato admin de leitura de custo e escrita da aquisição; decisões sobre custo histórico versus reposição, política custo médio, estados e compatibilidade.
- **010.04.3** Implementar backend seguro e testes isolados com contas de acesso negativo, idempotência, concorrência, rollback e precisão BRL/USD; não aplicar em Produção, nem disparar webhook.
- **010.04.4** Implementar UI dentro do editor existente, incluindo tratamento de dados não disponíveis, cálculo apenas demonstrativo e validação por servidor.
- **010.04.5** Testar frontend (mobile/iOS/Android/desktop emulação), admin/não admin, campos, formato, salvar/reabrir, custo antigo e ausência de vazamento; verificar regressão de preço, estoque, visibilidade e checkout com simulações.
- **010.04.6** Criar PR independente em rascunho, documentação cumulativa e plano de aplicação em Teste. **Não marcar homologado ou aprovado sem QA real e decisão do proprietário.**

## Critérios de aceite
1. Conta não-admin não consegue ver ou escrever custo por browser, RPC, API ou payload da vitrine.
2. Sem custo cadastrado, mostrar "Não informado"; custo zero explícito persiste como zero.
3. Duas tentativas idênticas com mesma chave não duplicam aquisição/estoque; alteração simultânea com saldo obsoleto é rejeitada.
4. Custo informado em USD mostra taxa histórica e valor BRL consistente, sem editar lançamentos passados.
5. Cadastro de custo sem reposição não modifica `stock`; reposição escolhida explicitamente aplica uma única entrada transacional.
6. Alterar custo hoje não modifica o total financeiro de venda antiga nem recalcula checkout.
7. Continuidade e acessibilidade do gerenciador existente; nenhuma nova tela/painel duplicado.
8. As PRs #41–#50 não são incorporadas automaticamente, nenhum merge em main, nenhuma migração em Produção.
9. Documentar SHA, testes, ambiente e pendências no `CONTROLE-DE-EXECUCAO.md` e `QUADRO-DE-PRIORIDADES.md`.

## Estado de autorização
Proprietário disse **«Vamos avançar»** após aplicação 010.03-B, autorizando prosseguir com verificação e preparação da próxima etapa. Essa instrução **não equivale a aceite funcional do #010, nem autoriza modificar produção, webhook, pagamentos reais ou executar migration adicional remota sem verificação**.
