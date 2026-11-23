# Visualizador de vídeo da Biblioteca

Vídeos próprios e YouTube abrem em um diálogo que ocupa o viewport sem a navegação do aplicativo. O módulo recebe o mesmo URL de visualização já autorizado pela Biblioteca. Fechar remove o elemento de mídia, libera o scroll e retorna o foco ao acionador. Alterar a rota ou a conta encerra a reprodução.

O player próprio usa os eventos do elemento de vídeo para atualizar reprodução, tempo e busca. Durante reprodução contínua, título, X e controles desaparecem após três segundos sem interação. A pausa, a busca, o ponteiro e o teclado voltam a exibi-los. Toque fora dos controles apenas os revela. O botão central alterna reprodução. O controle de volume só aparece quando o navegador aceita alterar o volume programaticamente. O controle de áudio do sistema permanece disponível.

O iframe do YouTube mantém seu próprio player. O título e o X externos ficam disponíveis porque eventos de toque e reprodução internos não são expostos ao diálogo pelo fluxo atual. O app usa o embed aprovado pelo resolvedor de links e não injeta comandos nem controles no iframe. Arquivos de imagem, texto e PDF continuam em seus leitores existentes. Nenhuma ação de download, captura ou compartilhamento foi adicionada.

## Tela inteira e orientação

| Ambiente | Comportamento preparado | Evidência desta entrega |
|---|---|---|
| Desktop Chromium | O navegador pode colocar o conteúdo do diálogo em fullscreen. O X ou Escape encerra a visualização conforme o estado de fullscreen. | Fullscreen real na sessão Chromium, além de reprodução e busca em MP4 H.264. |
| Android | Fullscreen padrão quando permitido. O diálogo ajusta o tamanho ao viewport e à orientação. | Emulação Pixel 7 em Chromium com MP4 e mudança de viewport durante a reprodução. |
| Safari/iOS e PWA | Usar fullscreen padrão quando disponível, ou o player nativo via `webkitEnterFullscreen` quando permitido. O modo nativo pertence ao sistema e usa o seu próprio comando de saída. O X continua disponível ao retornar ao diálogo. | Emulação iPhone 13 em Chromium com rotação simulada. A chamada ao fallback WebKit foi exercitada com mock. Safari e PWA em aparelho físico permanecem pendentes. |
| Restrições do sistema | Sem fullscreen autorizado, o diálogo continua imersivo. O layout reage à mudança de orientação e a resize sem bloquear a rotação nem os gestos do sistema. | Empacotamento do shell PWA, teste do viewport e verificações de áreas seguras. |

O cenário de navegador `node tests/library-video-browser.cjs` usa arquivos H.264 verticais e horizontais gerados pelo FFmpeg. Exercita reprodução, pausa, retomada, busca por teclado, temporizador de controles, toque sem alternar reprodução, mudança de orientação, X, restauração de foco e erro de mídia. O navegador intercepta a origem do YouTube apenas nesse teste. A requisição ao serviço real recebeu HTTP 403 do proxy, portanto a reprodução remota continua pendente de homologação.

Os testes `library-files-ui`, `library-ui`, `library-sharing`, `admin-pdf` e `pwa` exercitam os fluxos que compartilham a Biblioteca e totalizaram 28 aprovações. Build, check e empacotamento da prévia também passaram. `library-discovery` falha pela mesma ausência de `vault.decrypted_secrets` na base `c4bfdd4` e nesta candidata.
