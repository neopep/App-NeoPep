# Loja — galeria e exclusão de produtos

## Interface
- Botão Gerenciar com texto visível no iPhone, sobrescrevendo a regra genérica que ocultava o texto dos botões dourados do cabeçalho.
- Adicionar produto, Pedidos e Entrega e condições ficam abaixo de Gerenciar loja.
- Lixeira acessível na lista e na edição. A confirmação é obrigatória.
- Até seis fotos por produto, seleção múltipla, remoção de fotos do rascunho e escolha da capa. A primeira foto é usada no catálogo e nos destaques. A ficha do produto apresenta miniaturas para alternar imagens.
- A sanitização existente converte imagens para JPEG. Selecionar/trocar fotos preserva os campos digitados. URLs de prévia são liberadas quando a edição termina ou a conta muda.

## Ativação no Supabase
No mesmo projeto, executar **somente** `supabase/setup/shop-gallery.sql` inteiro, até `commit;`, no SQL Editor. É a migração 018, adicional à estrutura de loja/destaques já instalada. Não executar novamente o instalador antigo completo. A migração foi testada para reexecução sem substituir produtos nem pedidos.

O SQL acrescenta `photo_paths` e `deleted_at`; não migra nem apaga dados de saúde. Fotos de capa antigas continuam funcionando por fallback. O RPC anuncia `shop_extensions` somente depois da instalação. Antes disso, a interface preserva a foto única e deixa a lixeira indisponível, informando a atualização necessária. Não envia várias fotos para uma API que as ignoraria.

A execução remota depende do responsável no painel Supabase; não foi realizada pelo agente. Confirmar o resultado e testar uma publicação/edição com duas fotos e exclusão de produto de teste antes de considerar a integração real validada.

## Exclusão e acesso
Excluir marca o produto como excluído, retira publicação e destaque, remove o item dos carrinhos e impede novas inclusões/edições. O registro permanece internamente para preservar histórico e operações financeiras; os pedidos guardam seu retrato original. Não há exclusão física de pedidos nem reembolsos automáticos. Essa abordagem é intencional e o diálogo explica que a retirada é da loja.

Fotografias permanecem no bucket privado existente. A leitura por compradores só permite fotos vinculadas a produto ativo e não excluído; administradores mantêm acesso aos ativos do catálogo. URLs assinadas já emitidas podem continuar válidas até expirar (180 segundos). Remover uma foto da galeria ou excluir um produto não apaga imediatamente o arquivo do Storage. Limpeza física de arquivos órfãos não faz parte desta migração.

Contas comuns não podem salvar ou excluir produtos, nem chamar diretamente as funções internas de compatibilidade. Todas as decisões são conferidas no servidor, não somente pela visibilidade dos botões.

## Validação
Testes de PostgreSQL local: autorização, galerias inválidas/duplicadas/sem upload, permissões de fotos, capa, compatibilidade de clientes antigos, exclusão idempotente, carrinhos e preservação dos pedidos. Testes DOM: edição e campos preservados ao selecionar imagens, várias fotos, escolha/removal da capa, miniaturas, confirmação de exclusão e compatibilidade com banco anterior.

Validação visual Safari/iPhone e execução no Supabase real permanecem necessárias. Não foi feita edição de produtos reais ou consulta de dados privados do catálogo pelo agente.
