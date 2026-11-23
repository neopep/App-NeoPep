# Loja · Visibilidade por membro e duplicação

Na edição de um produto existente, a seta abre o modo e as listas de membros. Uma escolha no modo bloqueado ou autorizado é salva independentemente. O modo público deixa ambas as listas intactas. O servidor dá acesso aos administradores autorizados para gerenciar. A pesquisa aceita nome ou e-mail, e retorna apenas nome, ID, avatar e a seleção necessária. Uma seta recolhida mantém o restante do formulário disponível.

A migração `20261123220000_shop_member_visibility.sql` adiciona o modo privado, as listas, a deduplicação de cópias e um sinal Realtime sem IDs de produto ou membro. A RPC pública `neo_shop` preserva a cadeia instalada, incluindo `neo_shop_v36`, e aplica a regra a catálogo, destaques, ficha, carrinho e checkout. As políticas de Storage continuam consultando `neo_shop_photo` para assinar URLs. URLs emitidos anteriormente mantêm sua validade original. Só novas cotações/carrinhos filtram itens inacessíveis. Pedidos existentes, pagamentos e respectivos registros financeiros mantêm o fluxo anterior.

Duplicar opera em uma transação e usa uma chave por tentativa. Copia as configurações, ambas as listas e as referências a fotos privadas. Exige uma galeria consistente, cria ID próprio, preserva o original e abre a edição com publicação desmarcada. O estoque informado é copiado para o rascunho. O administrador pode ajustá-lo antes de publicar. A exclusão lógica da cópia preserva a galeria do original.

## Validação

- Teste SQL em PGlite com aplicação e repetição da migração, contas distintas, lista vazia, conta nova, persistência entre modos, tentativa direta de consulta/compra, foto, pedido sem bloqueio e histórico. A duplicação verifica os três modos, independência, fotos, ID, rascunho e repetição da solicitação.
- Teste Chromium desktop e iPhone 13 emulado com RPC simulada para a seta, salvamento automático, seleção preservada, edição de rascunho e atualização da sessão aberta.
- Build, check e empacotamento passaram. Na suíte dirigida de 23 testes, 10 passaram e 13 falharam. As mesmas 13 falhas foram reproduzidas na base de 22 testes. A suíte inclui galeria, dados fiscais e fixtures de DOM legadas. O cenário adicional de checkout com CPF sintético passou em banco isolado.

## Condições operacionais

1. Confirmar no painel a conexão de cada projeto Vercel com seu repositório, branch, escopo de Preview e chave pública de backend. O Git aponta para `staging/permanente` na configuração de homologação. O projeto Produção, a configuração ativa do domínio, o catálogo instalado e o histórico de migrações exigem verificação remota.
2. No Supabase Teste `qnuluspqfazdppciermw`, verificar `neo_shop`, `neo_shop_v36`, `neo_shop_photo`, roles, galeria privada e publicação `supabase_realtime`. Confirmar que os nomes de dependências são os esperados e que as versões aninhadas da Loja continuam privadas. Conferir o ponto de recuperação antes da migração.
3. Aplicar a migração no Teste e exercitar com administrador e duas contas fictícias. Verificar draft invisível, galeria, pesquisa e persistência, Realtime e fallback, ausência de acesso direto e checkout autorizado com o modo de pagamento Teste. Só então promover o código web.
4. Para Produção `cpslafpzjtbpmoxxysaa`, repetir a pré-verificação pelo projeto oficial e promover somente após Teste confirmado. Manter a política de bloqueio no banco se for preciso recuar o frontend. Qualquer reversão que reabra acesso exige análise do estado e decisão explícita.

A resolução dos projetos supabase.co e api.vercel.com retornou 403 no proxy deste workspace. O ensaio remoto, a migração e o deploy não foram executados.
