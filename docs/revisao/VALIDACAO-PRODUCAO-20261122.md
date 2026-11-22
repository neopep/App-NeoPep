# Verificações da candidata de produção

Build, check, prévia e verificação estática da candidata passaram. A auditoria de dependências de execução retornou zero vulnerabilidades no momento da consulta. O inventário SQL e a criação de buckets passaram em PGlite, incluindo reaplicação, recusa de bucket público e ausência de corpos de funções na saída. O comparador verificou um delta sintético e os invariantes recusaram a exposição de um bucket.

| Suite completa | Total | Passaram | Falharam |
|---|---:|---:|---:|
| main f123749 | 296 | 229 | 67 |
| staging/permanente fa8429a | 375 | 313 | 62 |
| Candidata e1a22d7 | 375 | 316 | 59 |

Os mesmos nomes dos 59 casos falhos constam nas duas bases. O teste que exigia título e corpo de eventos no push foi alinhado ao contrato discreto, preservando categoria e rota. As duas outras falhas da homologação não se repetiram com a identidade oficial preservada.

A revisão final do isolamento teve 28 testes direcionados aprovados. A prévia Chromium abriu a raiz a 1440 px e a rota legada a 375 px, sem tráfego externo. Foram conferidos evolução, fotos, loja e comunidade no modo de demonstração. Os resultados não validam Auth, compras, cron, Vercel ou Storage remotos.

## Impacto sobre a decisão

- **Loja e pagamentos:** fixtures de CPF/CNPJ, nome de pagamento e formato de retorno de pedidos; asserções divergentes em Edge de Mercado Pago. São críticas e exigem teste autenticado de checkout e reconciliação de webhook em ambiente isolado.
- **Autorização, comunidade e biblioteca:** fixtures sem papéis, coluna de Auth ou Vault. Esses erros interrompem os testes antes da comprovação de RLS e isolamento real.
- **Atendimento e push:** o ambiente de teste omite queueMicrotask e temporizadores, ou o banco local carece de Vault. Verificar os fluxos em ambiente representativo com consentimento e sem disparos reais.
- **Rotinas e diretório:** a mudança de defaults em função já existente requer auditoria de dependências antes de redigir o delta de produção.

## Registro dos casos falhos

| Teste | Erro observado |
|---|---|
| agent workspace enforces encrypted integrations, modes, private drafts, stale replies and scheduling (tests/agent-workspace.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| Conversa: resumo escolhido e validado, foto privada até aprovação, retry e isolamento (tests/community-chat.test.cjs:7:1) | error: role "service_role" does not exist |
| entrada deriva nome do perfil; apenas administradores reais têm aprovação automática (tests/community-entry.test.cjs:7:1) | error: role "service_role" does not exist |
| arquivo privado: reserva, publicação atômica, visibilidade, leitura anterior e exclusão (tests/community-files.test.cjs:7:1) | error: role "service_role" does not exist |
| configuração protegida, publicação direta opcional e preferências reversíveis (tests/community-settings.test.cjs:7:1) | error: role "service_role" does not exist |
| Comunidade: adesão explícita, moderação, autorização, exportação e exclusão (tests/community.test.cjs:7:1) | error: role "service_role" does not exist |
| diretório percorre todas as contas, busca limpa e data somente para equipe (tests/directory-featured.test.cjs:7:1) | error: cannot remove parameter defaults from existing function |
| estrela persiste; administrador edita produtos, destaques e acessa pedidos (tests/directory-featured.test.cjs:13:1) | error: Informe o nome que sera exibido no pagamento. |
| biblioteca: recentes antes de destaque, filtros globais e acessos reais limitados por conta/dia (tests/library-discovery.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| edição completa é administrativa, preserva ID e acessos e aplica arquivos e destaque atomicamente (tests/library-editor.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| anexos oficiais da biblioteca: upload administrativo, leitura privada e vínculo validado (tests/library-media.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| biblioteca: somente conteúdo oficial, destaque autorizado e compatibilidade (tests/library.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| tempo real atualiza mensagem enquanto escreve e mantém o rascunho privado (tests/live-conversations-ui.test.cjs:4:1) | ReferenceError [Error]: queueMicrotask is not defined |
| fila mostra Atender, exige aceite e abre no mesmo espaço (tests/live-conversations-ui.test.cjs:5:1) | ReferenceError [Error]: queueMicrotask is not defined |
| áudio requer permissão, é anexado à mensagem e enviado pelo botão normal (tests/live-conversations-ui.test.cjs:6:1) | ReferenceError [Error]: queueMicrotask is not defined |
| microfone é liberado ao deixar a conversa, inclusive se a permissão chegar depois (tests/live-conversations-ui.test.cjs:8:1) | ReferenceError [Error]: queueMicrotask is not defined |
| receber texto não substitui o player de áudio que já está na conversa (tests/live-conversations-ui.test.cjs:9:1) | ReferenceError [Error]: queueMicrotask is not defined |
| atendimento exclusivo: fila sem conteúdo, disputa de aceite, histórico, anexos, funções e revogação (tests/live-conversations.test.cjs:8:1) | error: column "email" does not exist |
| avisos privados deixam de alcançar os outros administradores após o aceite e respeitam leitura (tests/live-conversations.test.cjs:27:1) | error: relation "vault.decrypted_secrets" does not exist |
| instalador completo de conversas repete sem apagar histórico ou desfazer atendimento (tests/live-conversations.test.cjs:34:1) | error: relation "vault.decrypted_secrets" does not exist |
| Etapa2: onboarding atômico, consentimento no servidor e isolamento de todas as novas tabelas (tests/multiuser.test.cjs:7:1) | error: role "service_role" does not exist |
| Etapa2: administrador é validado no servidor; metadata e perfil não permitem autopromoção (tests/multiuser.test.cjs:8:1) | error: role "service_role" does not exist |
| Etapa2: migração com recibo é idempotente, verificada e isolada (tests/multiuser.test.cjs:9:1) | error: role "service_role" does not exist |
| Etapa2: limites persistem entre chamadas, códigos de erro não aceitam informações pessoais (tests/multiuser.test.cjs:10:1) | error: role "service_role" does not exist |
| configurações e IA: autorização, consentimento, fila, limite e prioridade humana (tests/platform-ai.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
| usuário abre somente o chat da equipe, com bolhas escapadas e sem lista de outros participantes (tests/private-conversations-ui.test.cjs:4:1) | ReferenceError [Error]: queueMicrotask is not defined |
| administrador abre lista e conserva rascunho separado por atendimento (tests/private-conversations-ui.test.cjs:5:1) | ReferenceError [Error]: queueMicrotask is not defined |
| retentativa após resposta perdida reutiliza ID e não cria nova mensagem (tests/private-conversations-ui.test.cjs:7:1) | ReferenceError [Error]: queueMicrotask is not defined |
| primeiro toque em Enviar confirma a mensagem antes de o teclado fechar (tests/private-conversations-ui.test.cjs:9:1) | ReferenceError [Error]: queueMicrotask is not defined |
| atendimento de IA exige confirmação e só processa texto após autorização (tests/private-conversations-ui.test.cjs:11:1) | ReferenceError [Error]: queueMicrotask is not defined |
| conversas privadas: isolamento, administração, remetente confiável, idempotência e histórico (tests/private-conversations.test.cjs:7:1) | error: role "service_role" does not exist |
| ativação pendente não pede permissão nem oferece sucesso fictício (tests/push-ui.test.cjs:2:1) | ReferenceError: setInterval is not defined |
| logout remove inscrição própria no servidor e cancela assinatura do dispositivo (tests/push-ui.test.cjs:3:1) | ReferenceError: setInterval is not defined |
| promoções: cálculo por escopo, melhor benefício, acúmulo, cupons, reservas e pagamento seguro (tests/shop-discounts.test.cjs:7:1) | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /valores/. Input: |
| limite do cupom é reservado por pedido, libera na expiração e origem sem desconto é preservada (tests/shop-discounts.test.cjs:35:1) | error: Informe um CPF ou CNPJ válido. |
| galeria e exclusão: autorização, fotos privadas, compatibilidade e pedidos preservados (tests/shop-gallery.test.cjs:7:1) | error: Informe o nome que sera exibido no pagamento. |
| checkout autentica o usuário e usa somente itens e valores do servidor (tests/shop-payments-edge.test.cjs:7:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| webhook exige assinatura atual e busca a situação real, ignorando status do corpo (tests/shop-payments-edge.test.cjs:8:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| recebedor, moeda e modo incompatíveis não confirmam pagamento (tests/shop-payments-edge.test.cjs:9:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| reembolso parcial vai para conferência e indisponibilidade não vira aprovação (tests/shop-payments-edge.test.cjs:10:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| checkout envia o total líquido exato e restringe o Pix escolhido para o desconto (tests/shop-payments-edge.test.cjs:14:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| webhook informa a forma efetivamente verificada no provedor (tests/shop-payments-edge.test.cjs:15:1) | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: |
| catálogo mostra carrinho e entrega, mas bloqueia pagamento sem integração (tests/shop-ui.test.cjs:6:1) | AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value: |
| checkout preparado cria pedido com total conferido e redireciona ao provedor (tests/shop-ui.test.cjs:7:1) | TypeError [Error]: Cannot read properties of null (reading 'querySelector') |
| gestor tem cadastro com foto, preço e estoque (tests/shop-ui.test.cjs:9:1) | TypeError [Error]: orders.filter is not a function |
| destaques reais preenchem carrossel e estrela aparece no cadastro de produto (tests/shop-ui.test.cjs:10:1) | TypeError [Error]: orders.filter is not a function |
| Voltar da loja retorna da ficha ao catálogo e da entrega ao carrinho (tests/shop-ui.test.cjs:12:1) | AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value: |
| gerenciar organiza ações; galeria salva capa escolhida e preserva campos digitados (tests/shop-ui.test.cjs:14:1) | TypeError [Error]: orders.filter is not a function |
| fotos existentes podem virar capa e sair da galeria; miniaturas alternam na ficha (tests/shop-ui.test.cjs:16:1) | TypeError [Error]: orders.filter is not a function |
| lixeira exige confirmação e atualização de banco; exclusão recarrega catálogo (tests/shop-ui.test.cjs:18:1) | TypeError [Error]: orders.filter is not a function |
| administrador cria regra de quantidade e cupom de origem, sem expor os controles ao cliente (tests/shop-ui.test.cjs:23:1) | TypeError [Error]: orders.filter is not a function |
| cotação alterada pede revisão e permite confirmar novamente sem travar o checkout (tests/shop-ui.test.cjs:25:1) | TypeError [Error]: Cannot read properties of null (reading 'type') |
| loja: autorização, preço no servidor, estoque, isolamento e confirmação financeira exclusiva (tests/shop.test.cjs:7:1) | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /Autorização/. Input: |
| expiração libera estoque uma só vez e pagamento atrasado sem estoque exige conferência (tests/shop.test.cjs:25:1) | error: Informe um CPF ou CNPJ válido. |
| agent management is administrator-only and suggestions remain a private editor (tests/support-agent-ui.test.cjs:3:1) | ReferenceError [Error]: queueMicrotask is not defined |
| participants have a normal conversation without mode selector or admin suggestion editor (tests/support-agent-ui.test.cjs:4:1) | ReferenceError [Error]: queueMicrotask is not defined |
| agent replies align as sent for administrators and received for participants (tests/support-agent-ui.test.cjs:5:1) | ReferenceError [Error]: queueMicrotask is not defined |
| mode selector stays open while conversation data refreshes (tests/support-agent-ui.test.cjs:6:1) | ReferenceError [Error]: queueMicrotask is not defined |
| administrador único: mesmas permissões, promoção protegida, revogação completa e privacidade (tests/unified-administrators.test.cjs:7:1) | error: relation "vault.decrypted_secrets" does not exist |
