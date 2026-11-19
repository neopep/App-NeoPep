# Administrador: função única

O aplicativo utiliza somente **Administrador** para todas as contas com acesso administrativo. Todas têm as mesmas permissões de administração da plataforma, produtos, destaques, pedidos, configurações da loja, aprovação de mensagens, atendimento e concessão/remoção de acesso administrativo.

A concessão é validada no servidor: uma conta comum não consegue se promover por perfil, metadata ou requisição forjada. O botão Tornar administrador informa que o acesso é à administração da plataforma, da loja e dos atendimentos. Administradores podem remover o acesso de outro administrador, mas não o próprio. Alterações de função são serializadas no banco. A remoção devolve os atendimentos à fila e revoga ambas as fontes antigas de autorização, impedindo que um vínculo antigo mantenha acesso.

Os registros individuais de saúde continuam protegidos pelas regras de proprietário. Atendimento atribuído continua visível somente para o participante e o administrador responsável; ter acesso administrativo não autoriza ler conversas atribuídas a outra pessoa. O painel geral mantém apenas os indicadores agregados existentes. Nenhum administrador pode marcar pagamento como aprovado manualmente.

## Ativar
Execute todo `supabase/setup/unified-administrators.sql` no SQL Editor do mesmo Supabase. O download é `NeoPeptideos-administradores.sql`. Requer as configurações anteriores de conversas e membros/destaques. Não apaga contas, registros, produtos ou históricos e não muda pagamentos. As contas administrativas existentes são reconhecidas igualmente, sem copiar ou substituir registros. Os nomes antigos de algumas tabelas/funções permanecem internos para compatibilidade; não representam funções diferentes no aplicativo.

Depois recarregue o aplicativo; sair e entrar novamente atualiza imediatamente as permissões carregadas na sessão. Não execute scripts antigos de funções administrativas depois desse instalador; se necessário, reaplique este arquivo por último. O SQL pode ser repetido sem conceder novamente um acesso já removido.

Prévia publicada não significa que o SQL foi aplicado no seu banco. Testes automatizados locais cobrem igualdade entre as duas fontes existentes, concessão por administrador, recusa a usuário comum, bloqueio da remoção do próprio acesso, revogação completa, repetição do instalador e preservação da privacidade de saúde e atendimentos. A validação das contas reais depende da aplicação do SQL.
