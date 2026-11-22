# NeoPep Connect 0.2.6 Teste

Base do candidato: `75f5b441beb2d0a6472d5544e639f53f9184c069`, versão 0.2.5. O Connect conserva os perfis existentes, o cofre DPAPI, o protocolo de listagem e envio manual de texto e o atualizador assinado. Este candidato destina-se à homologação.

## Usar o editor

1. Em **Configurações → Tema**, escolha Claro, Escuro ou Seguir sistema. A escolha é aplicada imediatamente e restaurada ao reiniciar. O modo de sistema usa as cores fornecidas aos controles WinForms. A logo vem do ícone oficial existente no repositório.
2. Em **Publicar → Preparar campanha**, selecione em Grupos um grupo de teste da conta e escolha-o no editor. Use a busca para localizar um dos grupos selecionados.
3. Escreva a campanha manualmente ou consulte **Produto do app**, **Oferta do app**, **Campanha do painel** ou **Rascunho salvo**. Produto e oferta fornecem o nome como sugestão de título. Campanha do painel reaproveita título, mensagem e rótulo de CTA disponíveis. A consulta usa a RPC administrativa existente e requer sessão válida e computador autorizado. Salvar rascunho é uma operação local.
4. Confira o mockup com grupo, quebras de linha, título e CTA. É possível selecionar, substituir ou remover um JPEG ou PNG local. A cópia reduzida pode ser armazenada no rascunho DPAPI. Ao confirmar o envio manual ao grupo, o bridge usa a mesma imagem como anexo JPEG e o conteúdo da prévia como legenda. O rascunho não é enviado ao Supabase.
5. Salve e reabra o rascunho, ou programe a revisão para uma data futura do Windows. O horário é persistido em UTC e mostrado no fuso local. Você pode reagendar ou cancelar. Com o Connect aberto, a bandeja emite um lembrete genérico quando chega o horário. Depois de fechar o Connect, o lembrete fica pendente até a próxima abertura. O agendamento não publica mensagens.
6. Com texto ou imagem e grupo elegível, escolha **Revisar e publicar agora**. Só ocorre envio ao confirmar a composição apresentada. A aceitação pelo WhatsApp não comprova entrega ou leitura. Se a resposta for incerta, confira o grupo antes de repetir.

## Homologação

- Compilar Teste x64 com `connect/windows/build.ps1 -Perfil Teste -Version 0.2.6`. O artefato público da CI serve para verificação, e o executável é mantido fora do repositório público. Para instalar pela atualização existente, o build privado deve incorporar a chave pública permanente, ser assinado pelo custodiante e passar pela aprovação do painel.
- Instalar por cima da versão 0.2.5 na mesma conta Windows de Teste, sem desinstalar. Conferir preferências, autenticação, cofre DPAPI, sessão WhatsApp, grupos e broker de atualização.
- Alternar os temas e reabrir. Conferir navegação, tabulação, foco e DPI 100%, 125% e 150%. Testar foto vertical e horizontal, uma imagem inválida, edição, persistência e restauração. Consultar catálogo, oferta e campanha do painel com usuário autorizado e sem sessão. Testar agendamento, cancelamento e ausência de envio ao chegar o horário. Validar texto e imagem reais apenas no grupo autorizado, com confirmação no Windows.
- O fluxo suporta uma publicação manual por destino e um rascunho local. Outros tipos de mídia, múltiplos destinos no mesmo disparo, inventário de rascunhos e persistência central de campanhas do Windows ficam para etapa posterior. O painel já oferece a segunda origem de conteúdo, por leitura.

## Evidência automatizada

O [runner Windows x64](https://github.com/neopep/App-NeoPep/actions/runs/45040796499) compilou o commit `77e04e0` e validou autenticação dos pacotes, tema e marca, atualização da prévia WinForms, reabertura de rascunho DPAPI, instalação, inicialização, remoção e preservação do cofre ao atualizar das linhas de base 0.1.1 e 0.1.2. O EXE de CI tinha 50.157.568 bytes e SHA-256 `462040f886eb66f442de738b1d3a40619d14a50d64f01fddb413652497443ba8`. Os 13 testes focados do Connect e os 7 testes do bridge passaram. O teste do bridge usa WhatsApp fictício. A conferência interativa sobre uma instalação 0.2.5 com sessão real continua pendente. O repositório privado retornou 404 para a integração desta sessão, então não houve artefato de instalação compartilhado nem aprovação do candidato.

## Ajustes da auditoria no PR #18

A prévia ganhou moldura de smartphone desenhada com escala da interface, câmera, cabeçalho do chat, conversa rolável e indicador inferior. O instalador e o executável incorporam um ICO em sete tamanhos gerado a partir de `dist/assets/logo-neopep.png`. A janela, o atalho e a bandeja usam o mesmo ícone.

O catálogo reaproveita apenas produtos ativos e aplica descrição, preço informado pelo catálogo e foto autorizada. Campanhas reaproveitam título, corpo, CTA com URL HTTPS configurada e imagem cadastrada no Storage. A origem fica identificada no rascunho. Fotos passam pela sessão Teste e pela RLS do Storage, com limite e sem redirecionamento. Ofertas reaproveitam o rótulo público disponível na RPC de catálogo. Não há URL individual de produto no contrato atual. Imagens externas ou sem formato suportado podem ser adicionadas manualmente em JPEG/PNG.

A programação local é sempre identificada como **lembrete de revisão**. Publicação programada automática continua indisponível até existir autorização explícita por destino, fila auditável e testes independentes. O envio imediato de texto e imagem preserva a confirmação existente.
