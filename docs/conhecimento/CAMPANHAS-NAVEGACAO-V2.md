# Central de Campanhas

A aba Campanhas abre na lista do App. O seletor de canal mantém o contexto de cada lista durante a navegação. Os cards incluem estado, canais, última alteração e métricas disponíveis. Use o breadcrumb ou **Voltar à lista** no detalhe da campanha. Uma URL com os parâmetros `admin`, `channel`, `campaignView` e `campaign` pode ser aberta diretamente por um administrador autorizado.

| Canal | Telas |
| --- | --- |
| App | Campanhas, Resultados, Públicos e planos |
| WhatsApp | Campanhas, Publicações, Grupos, NeoPep Connect |

**Nova campanha** abre o fluxo Conteúdo → Canais → Configurar → Revisar. Uma campanha salva pode servir aos dois canais. Suas abas de edição compartilham o mesmo formulário. A prévia e a ajuda preservam os campos preenchidos. Ao sair de uma edição com alterações, confirme o descarte ou permaneça no formulário.

Em WhatsApp, **Publicações** começa na fila. **Nova divulgação** abre a seleção de campanha, grupos, anexos e horário. **Grupos** começa na lista pesquisável. As configurações de agendamento do WhatsApp descrevem divulgação manual e lembretes. A confirmação humana continua no fluxo existente. As telas do NeoPep Connect continuam acessíveis pela aba correspondente.

## Prévia do WhatsApp

Use **Ver prévia no WhatsApp** no card, no editor ou na revisão. No modo **Painel**, a composição de texto é a mesma usada no compartilhamento manual do navegador. A mídia e os anexos aparecem como arquivos separados. No modo **Connect**, a prévia simula imagem com legenda no mesmo balão. A hora é ilustrativa, e a aparência pode variar conforme o cliente do WhatsApp. Arquivos locais são visualizados sem upload. Imagens persistidas dependem do acesso autorizado existente. A prévia não agenda, confirma ou envia mensagens.

## Checklist para homologação

- [ ] Entrar com uma conta administrativa de teste e conferir listas, filtros, paginação, breadcrumbs e retorno à posição anterior. Testar recarga e Voltar/Avançar do navegador.
- [ ] Criar um rascunho fictício e confirmar que os campos continuam preenchidos entre as etapas, abas, manual e prévia. Testar sair, desistir do descarte e voltar.
- [ ] Conferir as filas e grupos com fixtures, incluindo formulários, anexos autorizados, fuso, recorrência e lembretes. Conferir as telas do Connect com o processamento pausado.
- [ ] Comparar a prévia com o texto copiado pelo painel e com uma fixture de imagem e legenda do Connect. Conferir tema claro/escuro, teclado, Safari no iPhone, PWA instalado e Android.
- [ ] Confirmar a negativa para conta comum e ausência de efeitos de publicação, envio e push ao abrir ou fechar a prévia.

As capturas foram produzidas com dados fictícios em Chromium. [Desktop escuro](../evidencias/campanhas-v2/dark.png) · [largura de iPhone, tema claro](../evidencias/campanhas-v2/light.png).
