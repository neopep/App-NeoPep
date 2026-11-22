# Triagem da linha de base dos testes

A referência foi executada na main em `d55b85c` antes das alterações multiagente. Foram 296 casos, 229 aprovados e 67 falhas. A classificação descreve o primeiro sintoma observável em cada caso. A causa definitiva dos contratos que divergiram exige investigação específica.

| Classe | Casos |
| --- | ---: |
| DOM/VM: global ausente | 16 |
| DOM: fixture, resposta ou expectativa de interface divergente | 12 |
| PG: papel service_role ausente | 10 |
| PG: stub Vault ausente | 9 |
| Loja SQL: validação de pagamento diverge da expectativa | 6 |
| Edge pagamentos: status ou contrato divergente | 6 |
| Edge push: chamada RPC esperada ausente | 3 |
| PG: contrato de esquema/assinatura divergente | 2 |
| PWA: expectativa de texto ou implementação divergente | 2 |
| Fotos: URL inválida no teste | 1 |

## Evidências da investigação

- Os testes de banco com papel ausente, Vault ausente ou assinatura divergente usam fixtures diferentes. A fixture multiagente inclui papéis e Vault sintético. A aplicação integral das migrações em PostgreSQL isolado verifica assinaturas e dependências separadamente.
- Em promoções e galeria, casos são interrompidos pela validação de CPF/CNPJ ou nome de cobrança, inclusive onde a asserção aguardava rejeição por valores. Um caso de diretório falha porque uma redefinição de função remove defaults. Um caso de conversas ao vivo usa fixture sem a coluna email utilizada pelo SQL.
- Os testes DOM registram globais ausentes no VM, elementos nulos e formato de pedidos diferente do esperado. As falhas de Edge ocorreram com transporte simulado. Por exemplo, checkout retornou 502 onde se esperava 200, e o mock de push não registrou a chamada de conclusão esperada.
- As correções dessas classes permanecem fora do escopo da MA-03. [Pendências](../conhecimento/PENDENCIAS.md)

## Casos catalogados

| Caso | Arquivo e linha | Classe |
| --- | --- | --- |
| Configurações usa API autorizada e não oferece armazenamento de chaves no navegador | `tests/admin-ui.test.cjs:6` | DOM: fixture, resposta ou expectativa de interface divergente |
| controle de cadastro só habilita após consultar e bloqueia estado após falha | `tests/admin-ui.test.cjs:8` | DOM: fixture, resposta ou expectativa de interface divergente |
| agent workspace enforces encrypted integrations, modes, private drafts, stale replies and scheduling | `tests/agent-workspace.test.cjs:7` | PG: stub Vault ausente |
| Conversa: resumo escolhido e validado, foto privada até aprovação, retry e isolamento | `tests/community-chat.test.cjs:7` | PG: papel service_role ausente |
| entrada deriva nome do perfil; apenas administradores reais têm aprovação automática | `tests/community-entry.test.cjs:7` | PG: papel service_role ausente |
| arquivo privado: reserva, publicação atômica, visibilidade, leitura anterior e exclusão | `tests/community-files.test.cjs:7` | PG: papel service_role ausente |
| configuração protegida, publicação direta opcional e preferências reversíveis | `tests/community-settings.test.cjs:7` | PG: papel service_role ausente |
| Comunidade: adesão explícita, moderação, autorização, exportação e exclusão | `tests/community.test.cjs:7` | PG: papel service_role ausente |
| diretório percorre todas as contas, busca limpa e data somente para equipe | `tests/directory-featured.test.cjs:7` | PG: contrato de esquema/assinatura divergente |
| estrela persiste; administrador edita produtos, destaques e acessa pedidos | `tests/directory-featured.test.cjs:13` | Loja SQL: validação de pagamento diverge da expectativa |
| biblioteca: recentes antes de destaque, filtros globais e acessos reais limitados por conta/dia | `tests/library-discovery.test.cjs:7` | PG: stub Vault ausente |
| edição completa é administrativa, preserva ID e acessos e aplica arquivos e destaque atomicamente | `tests/library-editor.test.cjs:7` | PG: stub Vault ausente |
| anexos oficiais da biblioteca: upload administrativo, leitura privada e vínculo validado | `tests/library-media.test.cjs:7` | PG: stub Vault ausente |
| biblioteca: somente conteúdo oficial, destaque autorizado e compatibilidade | `tests/library.test.cjs:7` | PG: stub Vault ausente |
| tempo real atualiza mensagem enquanto escreve e mantém o rascunho privado | `tests/live-conversations-ui.test.cjs:4` | DOM/VM: global ausente |
| fila mostra Atender, exige aceite e abre no mesmo espaço | `tests/live-conversations-ui.test.cjs:5` | DOM/VM: global ausente |
| áudio requer permissão, é anexado à mensagem e enviado pelo botão normal | `tests/live-conversations-ui.test.cjs:6` | DOM/VM: global ausente |
| microfone é liberado ao deixar a conversa, inclusive se a permissão chegar depois | `tests/live-conversations-ui.test.cjs:8` | DOM/VM: global ausente |
| receber texto não substitui o player de áudio que já está na conversa | `tests/live-conversations-ui.test.cjs:9` | DOM/VM: global ausente |
| atendimento exclusivo: fila sem conteúdo, disputa de aceite, histórico, anexos, funções e revogação | `tests/live-conversations.test.cjs:8` | PG: contrato de esquema/assinatura divergente |
| avisos privados deixam de alcançar os outros administradores após o aceite e respeitam leitura | `tests/live-conversations.test.cjs:27` | PG: stub Vault ausente |
| instalador completo de conversas repete sem apagar histórico ou desfazer atendimento | `tests/live-conversations.test.cjs:34` | PG: stub Vault ausente |
| Etapa2: onboarding atômico, consentimento no servidor e isolamento de todas as novas tabelas | `tests/multiuser.test.cjs:7` | PG: papel service_role ausente |
| Etapa2: administrador é validado no servidor; metadata e perfil não permitem autopromoção | `tests/multiuser.test.cjs:8` | PG: papel service_role ausente |
| Etapa2: migração com recibo é idempotente, verificada e isolada | `tests/multiuser.test.cjs:9` | PG: papel service_role ausente |
| Etapa2: limites persistem entre chamadas, códigos de erro não aceitam informações pessoais | `tests/multiuser.test.cjs:10` | PG: papel service_role ausente |
| fotos locais: IndexedDB preserva Blob, exporta e exclui individualmente | `tests/photos.test.cjs:3` | Fotos: URL inválida no teste |
| configurações e IA: autorização, consentimento, fila, limite e prioridade humana | `tests/platform-ai.test.cjs:7` | PG: stub Vault ausente |
| usuário abre somente o chat da equipe, com bolhas escapadas e sem lista de outros participantes | `tests/private-conversations-ui.test.cjs:4` | DOM/VM: global ausente |
| administrador abre lista e conserva rascunho separado por atendimento | `tests/private-conversations-ui.test.cjs:5` | DOM/VM: global ausente |
| retentativa após resposta perdida reutiliza ID e não cria nova mensagem | `tests/private-conversations-ui.test.cjs:7` | DOM/VM: global ausente |
| primeiro toque em Enviar confirma a mensagem antes de o teclado fechar | `tests/private-conversations-ui.test.cjs:9` | DOM/VM: global ausente |
| atendimento de IA exige confirmação e só processa texto após autorização | `tests/private-conversations-ui.test.cjs:11` | DOM/VM: global ausente |
| conversas privadas: isolamento, administração, remetente confiável, idempotência e histórico | `tests/private-conversations.test.cjs:7` | PG: papel service_role ausente |
| envio discreto, descarte de inscrição expirada e bloqueio de endpoint arbitrário | `tests/push-edge.test.cjs:6` | Edge push: chamada RPC esperada ausente |
| postagem da comunidade usa mensagem sem conteúdo pessoal e fila própria | `tests/push-edge.test.cjs:8` | Edge push: chamada RPC esperada ausente |
| aviso privado usa fila separada e não inclui o conteúdo da conversa | `tests/push-edge.test.cjs:10` | Edge push: chamada RPC esperada ausente |
| ativação pendente não pede permissão nem oferece sucesso fictício | `tests/push-ui.test.cjs:2` | DOM/VM: global ausente |
| logout remove inscrição própria no servidor e cancela assinatura do dispositivo | `tests/push-ui.test.cjs:3` | DOM/VM: global ausente |
| push usa mensagem discreta e clique abre somente a área do app | `tests/pwa.test.cjs:4` | PWA: expectativa de texto ou implementação divergente |
| notificação comunitária não repete conteúdo e abre a conversa | `tests/pwa.test.cjs:5` | PWA: expectativa de texto ou implementação divergente |
| promoções: cálculo por escopo, melhor benefício, acúmulo, cupons, reservas e pagamento seguro | `tests/shop-discounts.test.cjs:7` | Loja SQL: validação de pagamento diverge da expectativa |
| limite do cupom é reservado por pedido, libera na expiração e origem sem desconto é preservada | `tests/shop-discounts.test.cjs:35` | Loja SQL: validação de pagamento diverge da expectativa |
| galeria e exclusão: autorização, fotos privadas, compatibilidade e pedidos preservados | `tests/shop-gallery.test.cjs:7` | Loja SQL: validação de pagamento diverge da expectativa |
| checkout autentica o usuário e usa somente itens e valores do servidor | `tests/shop-payments-edge.test.cjs:7` | Edge pagamentos: status ou contrato divergente |
| webhook exige assinatura atual e busca a situação real, ignorando status do corpo | `tests/shop-payments-edge.test.cjs:8` | Edge pagamentos: status ou contrato divergente |
| recebedor, moeda e modo incompatíveis não confirmam pagamento | `tests/shop-payments-edge.test.cjs:9` | Edge pagamentos: status ou contrato divergente |
| reembolso parcial vai para conferência e indisponibilidade não vira aprovação | `tests/shop-payments-edge.test.cjs:10` | Edge pagamentos: status ou contrato divergente |
| checkout envia o total líquido exato e restringe o Pix escolhido para o desconto | `tests/shop-payments-edge.test.cjs:14` | Edge pagamentos: status ou contrato divergente |
| webhook informa a forma efetivamente verificada no provedor | `tests/shop-payments-edge.test.cjs:15` | Edge pagamentos: status ou contrato divergente |
| catálogo mostra carrinho e entrega, mas bloqueia pagamento sem integração | `tests/shop-ui.test.cjs:6` | DOM: fixture, resposta ou expectativa de interface divergente |
| checkout preparado cria pedido com total conferido e redireciona ao provedor | `tests/shop-ui.test.cjs:7` | DOM: fixture, resposta ou expectativa de interface divergente |
| gestor tem cadastro com foto, preço e estoque | `tests/shop-ui.test.cjs:9` | DOM: fixture, resposta ou expectativa de interface divergente |
| destaques reais preenchem carrossel e estrela aparece no cadastro de produto | `tests/shop-ui.test.cjs:10` | DOM: fixture, resposta ou expectativa de interface divergente |
| Voltar da loja retorna da ficha ao catálogo e da entrega ao carrinho | `tests/shop-ui.test.cjs:12` | DOM: fixture, resposta ou expectativa de interface divergente |
| gerenciar organiza ações; galeria salva capa escolhida e preserva campos digitados | `tests/shop-ui.test.cjs:14` | DOM: fixture, resposta ou expectativa de interface divergente |
| fotos existentes podem virar capa e sair da galeria; miniaturas alternam na ficha | `tests/shop-ui.test.cjs:16` | DOM: fixture, resposta ou expectativa de interface divergente |
| lixeira exige confirmação e atualização de banco; exclusão recarrega catálogo | `tests/shop-ui.test.cjs:18` | DOM: fixture, resposta ou expectativa de interface divergente |
| administrador cria regra de quantidade e cupom de origem, sem expor os controles ao cliente | `tests/shop-ui.test.cjs:23` | DOM: fixture, resposta ou expectativa de interface divergente |
| cotação alterada pede revisão e permite confirmar novamente sem travar o checkout | `tests/shop-ui.test.cjs:25` | DOM: fixture, resposta ou expectativa de interface divergente |
| loja: autorização, preço no servidor, estoque, isolamento e confirmação financeira exclusiva | `tests/shop.test.cjs:7` | Loja SQL: validação de pagamento diverge da expectativa |
| expiração libera estoque uma só vez e pagamento atrasado sem estoque exige conferência | `tests/shop.test.cjs:25` | Loja SQL: validação de pagamento diverge da expectativa |
| agent management is administrator-only and suggestions remain a private editor | `tests/support-agent-ui.test.cjs:3` | DOM/VM: global ausente |
| participants have a normal conversation without mode selector or admin suggestion editor | `tests/support-agent-ui.test.cjs:4` | DOM/VM: global ausente |
| agent replies align as sent for administrators and received for participants | `tests/support-agent-ui.test.cjs:5` | DOM/VM: global ausente |
| mode selector stays open while conversation data refreshes | `tests/support-agent-ui.test.cjs:6` | DOM/VM: global ausente |
| administrador único: mesmas permissões, promoção protegida, revogação completa e privacidade | `tests/unified-administrators.test.cjs:7` | PG: stub Vault ausente |
