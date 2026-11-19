# Edição da Biblioteca

Administradores podem editar título, descrição, link, destaque e anexos pelo ícone de lápis. Remover anexos e alterar a permissão de download só é efetivado em Salvar alterações. A edição mantém o endereço, a data original e os acessos. Se outro administrador alterar o material durante a edição, é necessário reabrir para evitar sobrescrever mudanças.

Execute `supabase/setup/library-editor.sql` no SQL Editor após a atualização de arquivos 024. Esse instalador reúne 025 e 026 em uma transação e pode ser executado novamente. O pacote completo `platform-media-ai.sql` também inclui essas etapas. Sem 026, a edição completa fica indisponível. Não foi aplicada remotamente pelo editor.

Os números de acessos são apresentados e enviados pela API apenas para administradores após 026. A ordenação por popularidade continua disponível para todos. Remover um anexo desvincula o arquivo privado; links assinados já emitidos continuam válidos até expirar.

Links do YouTube mostram diretamente o player incorporado, sem uma segunda etapa para carregá-lo. A reprodução exige tocar no play nativo. TikTok mantém a ativação por toque e Instagram abre o original quando não é possível incorporar.

Prévia e texto ficam lado a lado a partir de 375 pixels CSS, incluindo a largura de 390 pixels do iPhone 13. Abaixo disso ficam empilhados. Testes de DOM e SQL cobrem edição, concorrência, acesso e manutenção do iframe; a conferência visual em Safari/iPhone real permanece pendente.

## Reprodução do YouTube
O play da prévia abre o mesmo visualizador interno dos arquivos, com Voltar e o player incorporado oficial do YouTube. O vídeo solicita reprodução após esse toque; permissões do navegador ou restrições do vídeo podem exigir o play nativo. Fechar, trocar de conta ou navegar remove o iframe e encerra a reprodução. O link Abrir no YouTube permanece como alternativa. Nenhuma nova migração SQL é necessária para esse ajuste.
