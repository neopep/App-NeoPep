# PR #36 · Preservação e liberação

A candidata permanece em revisão. O ponto local anterior é `backup/pr36-20261123-local` em `bbf4949`. O working tree estava limpo. O player de `c18688f` já está no PR como `3f1a528`. O objeto `2ea8aa5` não foi localizado nas referências locais e remotas consultadas. O comentário vinculante foi lido integralmente no HTML público do PR.

O merge local `a72f0ba` incorporou `staging/permanente` em `d4876be` à branch de desenvolvimento. Em `dist/shop.js`, os conflitos preservam o filtro e a recarga da Loja aprovados em Teste. Em `dist/style.css`, os estilos do reprodutor convivem com os da Loja. Em `dist/sw.js` e `scripts/build-staging.cjs`, o shell inclui o player e o cache é renovado. A entrada da branch em `git.deploymentEnabled` segue desativada.

## Matriz de evidências

| Funcionalidade | Versão de referência | Implementação e banco | Testes | Resultado e pendências |
|---|---|---|---|---|
| Loja | `d4876be` e migração complementar do Teste | `dist/shop.js` preservado integralmente a partir do estado de Teste. Duplicação, galeria, visibilidade, listas separadas, catálogo e inventário administrativo. Delta oficial altera apenas `neo_shop` e preserva a cadeia e os grants. | PGlite valida modos, rascunho, links diretos, destaques, carrinho, checkout, histórico e reaplicação do delta. Chromium desktop e iPhone 13 emulado validam vitrine administrativa e Gerenciar. | Cenários direcionados passaram. Mercado Pago, estoque em compra real e assinatura dos catálogos dos dois projetos ainda bloqueiam a liberação. |
| Campanhas e Connect | PR #35 em `d1a3a66` | Recuperação seletiva de `dist/admin/admin*.js` e `connect-ui.css`. A interface usa `neo_campaign_wa_sync` pelo adaptador `src/cloud.js`. A montagem duplicada do Connect foi evitada. | DOM cobre abas, ações administrativas, rascunho de atualização e recuperação de destinatários. Contas e grupos são simulados. | Interface validada localmente. A RPC existente, isolamento de destinatários, persistência real, editor em Safari e fluxo de publicação exigem homologação. |
| Player, PDF e Biblioteca | Reprodutor `3f1a528`, preservado no merge | `library-video.js` antes de `library-files.js`; PDF permanece no fluxo próprio; PWA conserva o novo asset. | Chromium com MP4 real de teste, iframe simulado, expiração/recusa de URL privada, abertura e fechamento e atualização offline. | Passou no navegador local. Safari/PWA física, YouTube real e RLS remoto pendentes. O card da Biblioteca ainda usa ícone quando o retorno de destaques não inclui o anexo; a revisão completa de compartilhamento segue aberta. |
| Calculadora, peso e avatar | `71a90ae` e `84780b5` para calculadora; `cc4905f` para avatar | Calculadora 3D, dosagens locais por conta e peso com casas decimais mantidos. Cabeçalho, Perfil, Comunidade e Atendimento compartilham o preenchimento circular. O editor e o encoder usam a mesma geometria. | Verificações de cálculo, gráfico, fotos e Chromium com imagens verticais, horizontais e quadradas, comparando prévia e recorte salvo. | Cenários direcionados passaram. Dispositivo iPhone físico e fluxos completos continuam pendentes. |
| Cadastro e consentimentos | `9d77c6d` e `20261123190000` | `src/app.js` solicita permissão do dispositivo apenas ao salvar opção de localização recém-ativada, em ambiente compatível. Coordenadas não são lidas nem transmitidas. O mecanismo já instalado continua registrando região aproximada da conexão. O cabeçalho permite geolocalização na própria origem. | Preferências e revogação em PGlite; geolocalização concedida, negada e indisponível com mock. | Falha ou recusa deixa a localização desativada; as demais escolhas seguem. Integração em iPhone e ordem completa dos lembretes ainda exigem homologação. Produção precisa de configuração própria para oferecer coleta de região. |
| Antes/Depois | Estado atual de Teste | Comparador e exportação pessoal preservados. | Composição, isolamento e exportação exercitados localmente. | Salvar a comparação no Storage privado e selecionar para publicação confirmada em grupo continuam pendentes. |
| Alimentação | Matriz do PR #36 | Card `Minha alimentação` imediatamente acima da Loja, com `Em breve`. | Gate de preservação. | Reserva visual disponível. A especificação funcional futura está abaixo. |
| Comunidade e Atendimento | Teste e auditoria de `3f1a528` | `dist/support.js` invalida a tentativa pendente ao sair da conversa e libera o microfone se a permissão chegar depois. Cursor de páginas antigas e preservação dos nós de mídia mantidos. | Banco isolado e DOM cobrem leitura, aceite, idempotência, isolamento, mídia e atualização do rascunho. | Cenários direcionados passaram. Realtime em três sessões reais, paginação integral da Comunidade, deltas completos, ausência de piscadas e economia medida em bytes seguem pendentes. |
| Notificações e segurança | Versão de Teste, dispatcher existente | Nenhuma alteração no dispatcher ou cron. Testes distinguem lote interno do serviço e payload externo sem nome nem mensagem. | Testes de avisos privados, leitura, aceite e Edge mock. | Entrega real, recuperação por cron e isolamento de destinos entre projetos seguem pendentes. |
| Auth, Premium, monitoramento e pagamentos | Contratos do Teste e `main` em `4b91093` | Sem substituição de Edge Functions, configurações oficiais, callbacks ou regras financeiras. | Suíte de Auth, Loja e Mercado Pago comparada com a base. | Falhas preexistentes de pagamento e fixtures impedem atestar prontidão. Compra em homologação e auditoria dos serviços oficiais pendentes. |

### Alimentação · especificação inicial

O card reserva a posição do módulo. O escopo para desenho posterior é registro voluntário de refeições, consulta por dia e edição ou exclusão pelo titular. O desenho deve definir quais campos são necessários, o fluxo sem conexão, controles de privacidade e exportação antes de propor armazenamento. A presente entrega só implementa o card; tabelas, IA e compartilhamento dependem de aprovação própria.

## Publicação posterior

**Teste `qnuluspqfazdppciermw`.** Usar o build de homologação com marca TESTE e conferir a URL, Auth, CAPTCHA, chaves públicas, callbacks e Storage privados do ambiente. Executar `release/shop-admin-visibility/preflight.sql` e cruzar objeto e ledger da migração complementar com o registro `20261123203830` informado na auditoria. Só considerar novos deltas se objetos e histórico divergirem. Verificar a RPC de grupos com contas sintéticas, registrar apenas uma publicação de ensaio sem disparo real e testar o player, instalação/atualização da PWA, carrinho e pagamento em ambiente de homologação. Conferir separadamente URLs dos gatilhos, Vault, pg_net e cron. O histórico contém referência ao dispatcher oficial. Nenhum script histórico deve ser reaplicado para ajustar esse destino.

**Produção `cpslafpzjtbpmoxxysaa`.** Após auditoria e ensaio aceitos, preparar promoção contra a `main` oficial. A `main` em `4b91093` executa `npm run build`; a candidata de homologação executa `node scripts/build-staging.cjs && npm run build`. Na promoção, usar o build oficial e as configurações oficiais de domínio, callbacks e CSP. Confirmar ausência da marca TESTE e preservar domínio, Auth, Mercado Pago, estoque, usuários, pedidos, arquivos e agendamentos. O [preflight](../../release/shop-admin-visibility/preflight.sql) consulta definição por hash, grants, ledger, dependências e políticas pertinentes sem exportar segredos. A auditoria relata ausência do marcador administrativo no backend oficial. O [delta de Produção](../../release/shop-admin-visibility/production.sql) aceita apenas o corpo anterior revisado ou a definição já atualizada, aborta em divergências e preserva tabelas, grants e dependências. Registrar o identificador do delta no processo aprovado para o ledger, conforme o estado efetivamente encontrado. O SQL foi ensaiado em PGlite com repetição. A assinatura e o catálogo instalados ainda dependem de comparação autenticada.

**Backup e reversão.** Antes de qualquer execução, registrar revisão do frontend, definição e privilégios da RPC, ledger, contagens de pedidos/produtos, associação de mídias e snapshot do banco. Restaurar o snapshot e uma amostra do Storage em projeto isolado, conferir acesso por conta, estoque, idempotência de checkout, backups e integridade dos anexos. Guardar evidência do ensaio. Em regressão do frontend, interromper promoção e voltar ao build anterior compatível, mantendo o filtro da vitrine se necessário para impedir exposição. Se houver erro no SQL, a transação aborta; para reversão após commit, usar a definição anterior extraída e revisada em transação separada, com aprovação específica se reabrir acesso à vitrine. Não houve ensaio remoto de restauração nesta execução.

As consultas aos Supabase e à Vercel foram bloqueadas no túnel HTTP pelo proxy. O estado dos serviços consta da auditoria vinculante e não foi reconfirmado diretamente. Nenhuma migração remota, entrega de WhatsApp ou publicação foi realizada.

## Execução e comparação

- `npm run build`, `npm run check` e `npm run pretest` passaram.
- `node --test tests/release-preservation.test.cjs` passou nos 7 critérios.
- A rodada dirigida de conversas, notificações, preferências e navegação do Connect teve 36 aprovações. A rodada de PWA, Biblioteca, campanhas e preservação teve 42 aprovações. A rodada de Fotos e preservação teve 36 aprovações. As rodadas têm testes em comum.
- Os testes Chromium da Loja, vitrine administrativa, player e avatar passaram. O iframe do YouTube e os serviços de acesso privado foram simulados. O MP4 e o Service Worker foram executados no navegador.
- Com build e prévia empacotados em cada checkout, a suíte inteira teve 351 aprovações e 43 falhas na candidata, contra 319 aprovações e 62 falhas em `d4876be`. Todas as 43 falhas da candidata já existiam na base, segundo os nomes dos casos. As falhas incluem fixtures de autenticação e Vault, dados fiscais do checkout, testes de DOM e contratos de pagamento. O resultado não comprova ausência de regressões em fluxos remotos ou sem cobertura.

<details>
<summary>43 testes que ainda falham</summary>

- Comunidade: adesão explícita, moderação, autorização, exportação e exclusão
- Conversa: resumo escolhido e validado, foto privada até aprovação, retry e isolamento
- Etapa2: administrador é validado no servidor; metadata e perfil não permitem autopromoção
- Etapa2: limites persistem entre chamadas, códigos de erro não aceitam informações pessoais
- Etapa2: migração com recibo é idempotente, verificada e isolada
- Etapa2: onboarding atômico, consentimento no servidor e isolamento de todas as novas tabelas
- Voltar da loja retorna da ficha ao catálogo e da entrega ao carrinho
- administrador cria regra de quantidade e cupom de origem, sem expor os controles ao cliente
- administrador único: mesmas permissões, promoção protegida, revogação completa e privacidade
- agenda tem eventos recorrentes e alerta sem prefixos Elo
- agent workspace enforces encrypted integrations, modes, private drafts, stale replies and scheduling
- anexos oficiais da biblioteca: upload administrativo, leitura privada e vínculo validado
- arquivo privado: reserva, publicação atômica, visibilidade, leitura anterior e exclusão
- ativação pendente não pede permissão nem oferece sucesso fictício
- biblioteca: recentes antes de destaque, filtros globais e acessos reais limitados por conta/dia
- biblioteca: somente conteúdo oficial, destaque autorizado e compatibilidade
- catálogo mostra carrinho e entrega, mas bloqueia pagamento sem integração
- checkout autentica o usuário e usa somente itens e valores do servidor
- checkout envia o total líquido exato e restringe o Pix escolhido para o desconto
- checkout preparado cria pedido com total conferido e redireciona ao provedor
- configuração protegida, publicação direta opcional e preferências reversíveis
- configurações e IA: autorização, consentimento, fila, limite e prioridade humana
- cotação alterada pede revisão e permite confirmar novamente sem travar o checkout
- destaques reais preenchem carrossel e estrela aparece no cadastro de produto
- diretório percorre todas as contas, busca limpa e data somente para equipe
- edição completa é administrativa, preserva ID e acessos e aplica arquivos e destaque atomicamente
- entrada deriva nome do perfil; apenas administradores reais têm aprovação automática
- estrela persiste; administrador edita produtos, destaques e acessa pedidos
- expiração libera estoque uma só vez e pagamento atrasado sem estoque exige conferência
- fotos existentes podem virar capa e sair da galeria; miniaturas alternam na ficha
- galeria e exclusão: autorização, fotos privadas, compatibilidade e pedidos preservados
- gerenciar organiza ações; galeria salva capa escolhida e preserva campos digitados
- gestor tem cadastro com foto, preço e estoque
- limite do cupom é reservado por pedido, libera na expiração e origem sem desconto é preservada
- lixeira exige confirmação e atualização de banco; exclusão recarrega catálogo
- logout remove inscrição própria no servidor e cancela assinatura do dispositivo
- loja: autorização, preço no servidor, estoque, isolamento e confirmação financeira exclusiva
- promoções: cálculo por escopo, melhor benefício, acúmulo, cupons, reservas e pagamento seguro
- publicação contém só NeoPeptídeos e mantém o endereço anterior com arquivos idênticos
- recebedor, moeda e modo incompatíveis não confirmam pagamento
- reembolso parcial vai para conferência e indisponibilidade não vira aprovação
- webhook exige assinatura atual e busca a situação real, ignorando status do corpo
- webhook informa a forma efetivamente verificada no provedor

</details>
