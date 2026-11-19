# Biblioteca em destaque no início

O antigo card de ciência foi substituído por uma entrada da Biblioteca. “Ver biblioteca” abre a Comunidade já na aba Biblioteca. “Ler material” abre essa aba, destaca o material escolhido e posiciona a lista nele. O conteúdo completo e os links externos continuam na biblioteca; a página inicial não carrega vídeos externos automaticamente.

Administradores podem marcar “Destacar na tela inicial” ao publicar um material e ativar/desativar o destaque em materiais existentes. Os destaques são reais, cadastrados no banco, sem cópia de registros de saúde ou mensagens privadas. O card mostra título e prévia de até 180 caracteres. Até 12 destaques alternam a cada 6,5 segundos, com controles de navegação/pausa e respeito à redução de movimento. Sem destaques, aparece uma entrada neutra para explorar a biblioteca, sem conteúdo fictício.

## Ativar no Supabase
Executar `supabase/setup/library-featured.sql` completo, até `commit;`, no SQL Editor do mesmo projeto. Essa atualização é independente do SQL de galeria da loja. Não executar novamente os instaladores anteriores. O arquivo adiciona somente a coluna `featured` aos materiais existentes e o RPC `neo_library`. Nenhum material existente é marcado automaticamente. Reexecutar mantém as escolhas já salvas.

Depois, atualizar o aplicativo ou usar Atualizar na aba Biblioteca. Antes dessa instalação, o acesso normal à biblioteca e a publicação antiga continuam funcionando; os controles de destaque ficam desativados. O envio de destaque não é simulado nem ignorado silenciosamente.

## Acesso e atualização
O RPC exige conta autenticada, perfil e termos aceitos. Leitura retorna somente materiais oficiais da biblioteca; criar/alterar destaque exige autorização administrativa no servidor. Não há acesso anônimo à tabela privada nem concessão de privilégios ao cliente.

A página inicial usa uma consulta própria aos destaques; não busca mensagens do grupo nem entra na comunidade automaticamente para preencher o card. O acesso pela biblioteca mantém o fluxo de entrada já existente. Mudanças da conta limpam o estado do card e respostas antigas são descartadas.

Atualizações usam invalidação local ao editar/remover, os eventos já recebidos da comunidade e reconciliação a cada minuto quando o início está visível. Na aba Biblioteca, a rolagem e os campos do formulário, inclusive a estrela, são preservados durante as atualizações.

## Validação e limites
Testes locais PostgreSQL: autorização, isolamento das tabelas privadas, tipos de destaque, prévia limitada, compatibilidade com publicação anterior, remoção e reexecução. Testes DOM: navegação direta à aba/material, preservação de rascunho/estrela, cadastro com booleano, carrossel, escape de conteúdo e troca de conta durante consulta.

A execução do SQL remoto, o teste com materiais reais e a conferência visual no iPhone dependem da ativação no projeto Supabase. Nenhuma alteração de material real foi feita pelo agente.
