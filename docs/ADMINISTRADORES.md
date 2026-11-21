# Administrador: função única

O aplicativo utiliza somente **Administrador** para todas as contas com acesso administrativo. Todas têm as mesmas permissões de administração da plataforma, produtos, destaques, pedidos, configurações da loja, aprovação de mensagens, atendimento e concessão/remoção de acesso administrativo.

A concessão é validada no servidor: uma conta comum não consegue se promover por perfil, metadata ou requisição forjada. O botão Tornar administrador informa que o acesso é à administração da plataforma, da loja e dos atendimentos. Administradores podem remover o acesso de outro administrador, mas não o próprio. Alterações de função são serializadas no banco. A remoção devolve os atendimentos à fila e revoga ambas as fontes antigas de autorização, impedindo que um vínculo antigo mantenha acesso.

Os registros individuais de saúde continuam protegidos pelas regras de proprietário. Atendimento atribuído continua visível somente para o participante e o administrador responsável; ter acesso administrativo não autoriza ler conversas atribuídas a outra pessoa. O painel geral mantém apenas os indicadores agregados existentes. Nenhum administrador pode marcar pagamento como aprovado manualmente.

## Ativar
Execute todo `supabase/setup/unified-administrators.sql` no SQL Editor do mesmo Supabase. O download é `NeoPeptideos-administradores.sql`. Requer as configurações anteriores de conversas e membros/destaques. Não apaga contas, registros, produtos ou históricos e não muda pagamentos. As contas administrativas existentes são reconhecidas igualmente, sem copiar ou substituir registros. Os nomes antigos de algumas tabelas/funções permanecem internos para compatibilidade; não representam funções diferentes no aplicativo.

Depois recarregue o aplicativo; sair e entrar novamente atualiza imediatamente as permissões carregadas na sessão. Não execute scripts antigos de funções administrativas depois desse instalador; se necessário, reaplique este arquivo por último. O SQL pode ser repetido sem conceder novamente um acesso já removido.

Prévia publicada não significa que o SQL foi aplicado no seu banco. Testes automatizados locais cobrem igualdade entre as duas fontes existentes, concessão por administrador, recusa a usuário comum, bloqueio da remoção do próprio acesso, revogação completa, repetição do instalador e preservação da privacidade de saúde e atendimentos. A validação das contas reais depende da aplicação do SQL.

## Avisos de cadastro no NeoPep Teste

O atalho da administração consulta a contagem ao voltar para o app e a cada 30 segundos enquanto a página está visível. Na visão geral, o servidor confirma a leitura do administrador e devolve um resumo temporário com até cinco nomes. O histórico fica na mesma página com busca por nome ou e-mail, filtros de novos e por período, detalhes expansíveis e páginas de 20 resultados. O filtro Novos inclui os vistos nesta visita e os ainda pendentes.

A criação da conta no Supabase Auth é a fonte do evento. Contas anteriores à migração aparecem no histórico sem aviso retroativo. Os recibos guardam somente os identificadores do administrador e da conta e o horário da leitura. A remoção de uma conta exclui seus recibos. O RPC exige sessão e vínculo em `neo_private.admin_members`. A localização é apresentada como indisponível. O último acesso usa o horário mais recente entre login no Auth e atividade autenticada do app. A interface apresenta o fuso local.

A migração `20261121170551_admin_signup_notices.sql` é aditiva. Em caso de reversão do frontend, é possível publicar novamente o commit anterior de homologação preservando os recibos existentes. O servidor continua protegendo a consulta por vínculo de administrador.

### Aviso flutuante e estatísticas de público

A confirmação de leitura continua no servidor. O aviso flutuante mostra até cinco nomes, tem barra de progresso e pode ser fechado. Os nove segundos contam enquanto o aviso está visível. A lista fica entre os indicadores gerais e Estatísticas de público.

O dashboard usa Auth e atividade autenticada para contar cadastros e contas cujo último acesso registrado cai no período. Os períodos são em UTC. Os grupos de dispositivos e campanhas consideram contas cadastradas no intervalo e que autorizaram observações. Segmentos com menos de cinco contas são omitidos. Percentuais representam os grupos exibidos. Uma referência ausente permanece desconhecida.

A coleta técnica é opcional no Perfil. As contas podem exportar ou apagar suas próprias observações. O servidor guarda apenas a primeira e a última observação permitida de dispositivo e campanha, com expiração de 90 dias. Registros expirados deixam de ser servidos e são removidos em lotes durante novas observações autorizadas. Em um ambiente ocioso, a exclusão física desses lotes depende de manutenção periódica. A conta excluída perde imediatamente as observações pela chave estrangeira.

A origem geográfica exige um caminho autenticado entre uma fonte confiável de localização aproximada no servidor e o Supabase. A hospedagem atual ainda não integra essa atribuição. A interface apresenta Localização não disponível. Conversão de visitantes, frequência, retenção por coorte e conversão Premium aguardam dados próprios. Nenhuma fonte externa ou permissão do navegador foi ativada.

A migração de staging `20261121181510_admin_audience.sql` é aditiva. A reversão do frontend para o commit anterior interrompe a coleta enquanto as tabelas privadas e a autorização do servidor permanecem válidas.

A Vercel documenta cabeçalhos de país, região e cidade para suas funções. A configuração pendente é uma função no domínio de staging que valide a sessão em qnuluspqfazdppciermw, confirme a preferência de coleta e encaminhe somente os campos aproximados por um canal autenticado de servidor para servidor. A confiança desses cabeçalhos deve ser verificada no deployment protegido antes da ativação. [Cabeçalhos da Vercel](https://vercel.com/docs/headers/request-headers)
