# Correção de anexos e controle de download

O cadastro começa no botão **Adicionar material**, visível apenas para administradores. Ele abre uma janela com título, descrição, link, anexos e **Destacar na tela inicial**; o formulário não ocupa o mural. Fechar a janela mantém o rascunho em memória na mesma conta. Sair da conta limpa esse rascunho.

Depois de o servidor aceitar a publicação, a janela mostra uma confirmação com ícone de concluído e as opções **Ver na biblioteca** e **Adicionar outro material**. Em caso de falha, mantém dados e anexos para nova tentativa, sem confirmação falsa. A atualização automática não substitui o seletor de arquivos enquanto ele está aberto.

A interface mostra uma miniatura assim que o arquivo é selecionado, informa envio/erro e permite abrir a prévia antes da publicação. O arquivo é enviado ao Storage privado na seleção; fica disponível aos demais usuários quando o material é publicado. Uma seleção durante a atualização automática não é mais descartada. Falhar ao preparar o download não apaga o link de visualização.

Para ativar os controles por arquivo, execute no SQL Editor do Supabase o arquivo completo `NeoPeptideos-corrigir-anexos-biblioteca.sql`, até a última linha `commit;`. Esta é a migração 024 e depende da Biblioteca com anexos/vídeos (020 a 022) já instalada. Ela é independente das atualizações de desconto e das funções do Mercado Pago. Pode ser repetida e não exclui materiais existentes.

Depois recarregue o aplicativo. Em Comunidade → Biblioteca, cada arquivo tem **Permitir download** para o administrador. A escolha é salva por arquivo; o botão de baixar só aparece quando permitido, inclusive no leitor. Arquivos anteriores mantêm download permitido por padrão. Somente administradores podem alterar a opção e anexar arquivos aos materiais existentes.

Use **Adicionar anexos** no próprio cartão para completar materiais já publicados, por exemplo “Conhecimento” ou “Protocolo”. Título, texto e destaque são preservados. Se a seleção anterior foi descartada antes do envio, não há arquivo armazenado a recuperar automaticamente: selecione-o de novo. Há limite de seis anexos por material; fotos/PDF/TXT até 10 MB, vídeos até 50 MB.

No mural, imagens mostram miniatura, TXT mostra um trecho do conteúdo e vídeos tentam exibir o primeiro quadro, sem reprodução automática. Arquivos sem quadro compatível continuam acessíveis no player interno. Materiais somente com texto têm acesso à leitura completa.

Imagens abrem dentro do aplicativo. PDFs têm miniatura da primeira página e leitor com páginas, ampliação e texto da página. TXT longo é paginado para permitir leitura completa sem sobrecarregar a tela. O leitor usa Mozilla PDF.js hospedado junto ao aplicativo; não envia arquivos para Google ou outro visualizador externo. Os arquivos continuam privados no Supabase e as URLs são temporárias. Conteúdos PDF protegidos por senha ou com recursos não suportados podem exigir outro formato.

**Permitir download controla a função disponibilizada pelo aplicativo, não é DRM.** Quem pode visualizar recebe o conteúdo e ainda pode capturá-lo ou salvá-lo com recursos do aparelho. Não há garantia de bloquear cópias. Links assinados já emitidos continuam válidos até expirar; imagens/textos usam 60 segundos, PDFs e vídeos até 30 minutos para suportar leitura/reprodução. A opção não revoga retroativamente um link já emitido.

Validação automatizada cobre seleção durante atualização, envio imediato, miniaturas, falha/reenvio, preservação de rascunho, configuração de download, autorização por conta, anexação a material existente e leitura/renderização real de PDF. Revisão visual e testes em Safari/iPhone real ainda precisam ser feitos no aparelho.

## Visualização e compartilhamento na Biblioteca

Os cartões e leitores da Biblioteca oferecem visualização autorizada e compartilhamento do link interno da publicação. O acesso ao conteúdo privado continua sujeito à sessão e às permissões do servidor. A opção administrativa de permitir o uso do arquivo em campanhas preserva o contrato existente de `allow_download`. O leitor PDF da Biblioteca compartilha a visualização contínua do leitor administrativo e abre o anexo por uma URL temporária autorizada.
