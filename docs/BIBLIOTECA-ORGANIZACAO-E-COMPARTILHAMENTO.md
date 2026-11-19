# Biblioteca: organização, prévias estáveis e compartilhamento

A ordem padrão é **Mais recentes**. O destaque continua alimentando a tela inicial, mas não coloca materiais antigos na frente dos novos na Biblioteca. No topo, **Filtrar e organizar** permite buscar por título/descrição, selecionar PDF/texto/imagem/vídeo/link, restringir a destaques e ordenar por recentes, antigos ou acessados.

Cartões usam prévia à esquerda e título/descrição à direita quando há espaço. Em telas menores, os blocos ficam empilhados. PDF/TXT usam uma prévia em retrato; imagem e vídeo mantêm sua proporção, sem corte. Os nomes técnicos e tamanhos saíram dos cartões; o arquivo original e seu nome continuam preservados no armazenamento. Ações administrativas são ícones com descrição acessível e dica ao passar o mouse.

Prévias carregadas são preservadas durante as atualizações. Contagem, metadados e links de download podem mudar sem recriar a imagem/canvas. A montagem provisória de novos cartões usa conteúdo inerte para não iniciar carregamentos duplicados. Mudança real de arquivo ou uma recarga completa ainda precisa carregar o conteúdo normalmente.

## Ativar “Mais acessados”

Execute no SQL Editor do Supabase o arquivo completo `NeoPeptideos-ordenacao-e-acessos-biblioteca.sql`, incluindo a última linha `commit;`. É a migração 025; exige os controles de arquivos da migração 024. Ela não apaga materiais, anexos ou configurações. Pode ser repetida.

Depois recarregue o aplicativo. A opção **Mais acessados** fica habilitada quando o servidor confirmar essa atualização. Recentes, antigos, layout e compartilhamento já funcionam com a estrutura anterior.

A contagem começa em zero na ativação; não inventa histórico. Conta uma abertura por material, conta autenticada e dia, no fuso America/Sao_Paulo. Abrir um anexo, ler o texto ou acessar um link externo conta como abertura; atualizações automáticas, carregar miniaturas, filtrar e compartilhar o link não aumentam o número. A interface mostra somente o agregado, não a identidade dos leitores. Repetir a leitura no mesmo dia não infla o contador. A ordenação e os filtros são calculados no servidor sobre os materiais, retornando até 100 resultados por consulta, conforme o limite já existente.

## Compartilhar

Cada publicação tem **Compartilhar link da publicação**. O link contém o identificador do material e abre a Biblioteca nesse item. O destinatário precisa entrar na conta e concluir o cadastro, se necessário. Material removido aparece como indisponível. O link não contém token de autenticação, URL temporária de Storage nem dados de saúde. Após login no mesmo navegador, o aplicativo retoma a publicação; em outro navegador o destinatário pode abrir novamente o link depois de entrar.

**Compartilhar arquivo** aparece somente se houver anexo com download permitido. Se houver vários, escolha um. O aplicativo verifica o acesso e prepara uma cópia em memória. Toque em **Compartilhar arquivo** na janela para escolher o aplicativo e o destinatário no menu do aparelho. Esse segundo toque mantém a compatibilidade com navegadores que exigem ação imediata do usuário.

Quando a Web Share API com arquivos não está disponível, a janela oferece baixar para compartilhar pelo aparelho. O download e o compartilhamento de arquivo respeitam a configuração individual do administrador. Enviar uma cópia não é o mesmo que enviar o link: arquivos já recebidos fora do aplicativo não podem ser revogados. A configuração não é DRM nem impede capturas ou cópias do que pode ser visualizado.

Não é necessário atualizar funções do Mercado Pago ou configurar uma API externa para estes recursos.

## Verificação

Testes cobrem ordenação sem prioridade de destaque, filtros, persistência dos elementos de imagem após atualizações/renovação de URLs, falhas temporárias de mídia, contagem autenticada sem duplicação diária, link após login, limpeza de dados ao trocar de conta, compartilhamento de arquivo com gesto explícito e recusa de download pelo servidor. A suíte também mantém os testes anteriores de leitor e renderização real de PDF. Compartilhamento nativo, proporções e aparência em Safari/iPhone real ainda precisam de conferência no aparelho.
