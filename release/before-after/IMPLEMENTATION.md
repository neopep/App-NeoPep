# Antes/Depois — contrato de implementação, PR #36

**Status:** backend SQL preparado, NÃO aplicado. Não anunciar a funcionalidade como pronta. Preservar Mercado Pago e branch de Teste.

## Fluxo aprovado
1. Usuário autenticado abre Comparar e compartilhar, seleciona duas fotos próprias de datas diferentes; a composição JPEG já existe no app.
2. Mostrar ação "Salvar no NeoPep" após renderização real; pedir confirmação para salvar uma imagem íntima no armazenamento privado e verificar consentimento de fotos.
3. Upload de JPEG até 5 MiB em `neo-comparisons`, com path `<uid>/<uuid>.jpg`, `upsert:false`. Inserir metadados em `neo_saved_comparisons` apenas após sucesso. Em falha de inserção, remover upload; em troca de conta abortar a operação e limpar material em memória. Não usar `neo_photos` para guardar o composto.
4. Listagem privada das comparações, prévia por URL assinada temporária, excluir com confirmação e limpeza em Storage. Não disponibilizar link público.
5. No formulário de publicação de Grupo, seletor opcional de composições salvas, exibindo data/miniatura e confirmação explícita antes de **copiar** imagem para o fluxo privado já existente de publicação `neo-community`. Nenhum vínculo público automático com o original ou com `neo-comparisons`; usar somente o mecanismo de imagem do post e as permissões já existentes.
6. Nunca publicar sem gesto explícito, nunca reaproveitar confirmação anterior; ao cancelar/erro permanecer privada.

## Garantias de segurança e implantação
- Aplicar script somente após revisar RLS, privilégios de `neo_photos`, bucket, política de exclusão da conta, dependências, políticas existentes e mecanismo de retenção de órfãos. A política SELECT exige metadados: cliente deve consultar o registro após upload antes de pedir URL assinada.
- A tabela é de imagens sensíveis; limitar consultas por `auth.uid()`, impedir seleção de fotos de outros perfis, acesso anônimo e exposição por URL persistente.
- Não reaplicar SQL em Produção sem preflight e backup; gerar migração oficial pela CLI quando o contrato estiver aprovado.
- Aguardar testes negativos de conta A/B, troca de sessão no meio do upload, repetição, foto original excluída, limite de tamanho, expiração de URL, interrupção de rede e comportamento do iPhone.
- O SQL em `release/before-after/prepare.sql` é proposta inicial; os objetos são novos e exigem checagem das políticas preexistentes antes de execução.

## Testes de aceite
- A salva; B não lê/edita/exclui; C anônimo recebe 401/403; página inicial não mostra nenhuma comparação compartilhada.
- Compartilhamento só acontece após confirmação explícita em Grupo; cancelamento não produz post; publicação usa imagem da cópia e não expõe `neo-comparisons`.
- Excluir item remove metadados + objeto e não invalida post já publicado por vontade do autor.
- Sem migração, interface detecta recurso indisponível e não indica salvamento bem-sucedido.
- Teste em Safari/PWA e restauração de backups antes de promover.
