# Pop-ups e campanhas

Abra Campanhas no painel. Crie um rascunho, preencha o texto e use as prévias de celular e computador. Salvar cria ou atualiza a campanha. Ativar / agendar aplica as datas do formulário no fuso IANA informado e usa os dias da semana e as horas para a recorrência. Para uma campanha única, defina início e encerramento no mesmo dia. Para janela diária atravessando meia-noite, use intervalos separados. Horas inexistentes por ajuste de relógio são recusadas. Em caso de hora ambígua, vale a interpretação padrão do PostgreSQL. Arquivar retira a campanha de circulação e preserva os totais. Duplicar copia a configuração dos canais para um novo rascunho, sem recibos.

O editor pesquisa documentos da Biblioteca, produtos ativos e descontos gerais da Loja. Documentos abrem o material e produtos abrem a ficha existente. Ofertas e promoções levam à Loja, onde continuam valendo os preços, cupons e critérios do checkout. O editor também aceita links manuais e imagens estáticas do mesmo domínio.

Imagens do editor são redimensionadas para até 1.600 px, regravadas como JPEG e armazenadas no bucket privado `neo-campaign-images`, com limite de 5 MB. Só administradores podem enviar. O pop-up recebe URL assinada de 120 segundos após a reserva autenticada da campanha. Remover a imagem no editor desvincula o arquivo da campanha. A limpeza física de imagens desvinculadas demanda verificação de referências antes de qualquer exclusão.

Segmentos usam a data de criação no Auth ou o vínculo com a comunidade. A opção Vincular plano a uma conta grava a associação em `neo_private.campaign_plans` mediante autorização administrativa. Use o UUID da conta e um código em minúsculas. Deixe o código vazio para remover o vínculo. A associação fica sob RLS e registra quem a modificou e quando. A segmentação ignora metadados da conta. O vínculo por plano é mantido pelo administrador de campanhas, sem integração com faturamento.

O pop-up espera a sessão e o cadastro, respeita a prioridade, a frequência e o limite por conta. O painel conta exibições e cliques, sem atribuição de compras. O canal push funciona separadamente. O worker pode reservar um aviso por campanha e dispositivo elegível, mesmo sem abertura do app. A fila considera opt-in específico do Perfil, inscrição do dispositivo, agenda e público. O texto é genérico e leva ao Início.

O consumo da fila exige um worker publicado no Supabase `qnuluspqfazdppciermw` com `NEO_STAGING_CAMPAIGN_PUSH=1`. Mantenha essa opção desligada até testar consentimento e destinatário com um único dispositivo fictício. O ensaio pode ser manual, com cron desligado. Nenhuma alteração de VAPID é necessária.

Para retirar a funcionalidade, pause as campanhas, preserve o bloqueio do worker de push e restaure o frontend anterior. As migrações são aditivas e mantêm os registros já criados.

## Manual e dicas

O ícone circular ao lado de **Nova campanha** abre o manual original em tela cheia. As páginas seguem na vertical. O leitor renderiza as páginas próximas da área visível e descarta as demais da memória. O leitor tem zoom por pinça e texto acessível, e restaura o foco e a rolagem ao fechar. O balão dos 26 textos orienta os campos do aplicativo sem mudar o layout. Toque fora ou pressione Escape para fechar.

O leitor administrativo é independente da Biblioteca e usa o PDF.js local. Para outro documento administrativo público, inclua o arquivo em `dist/assets/` e passe caminho, título e botão de origem a `NeoAdminPDF.open`. Documentos privados exigem um fluxo autenticado próprio.


## Divulgação manual pelo WhatsApp

Use **Campanhas WhatsApp** para cadastrar grupos, selecionar conteúdo de uma campanha compartilhada e programar divulgações. O link de convite serve para acesso ao grupo. Cada publicação é registrada por grupo. Imagens reutilizam a campanha e os anexos da Biblioteca precisam estar autorizados para download. A autorização é conferida na preparação. Em aparelhos com compartilhamento nativo, o sistema entrega o conteúdo à interface do dispositivo. No desktop é possível copiar a mensagem ou o link e preparar arquivos para anexar separadamente.

Escolha manualmente WhatsApp e o grupo. A abertura do aplicativo não registra envio. **Confirmar publicação** grava o administrador e a hora. Se houver recorrência, a próxima ocorrência segue os dias e o fuso informados. Lembretes são consultados enquanto a área WhatsApp estiver aberta, sem push. Cada administrador recebe uma vez o lembrete por ocorrência. A lista de grupos aceita busca por nome e categoria. A fila apresenta até 100 registros, priorizando pendências.

A ajuda contextual usa o mesmo balão de Campanhas App. O cabeçalho aceita um futuro manual pelo leitor administrativo quando houver um PDF aprovado. Nenhum manual provisório é fornecido. O envio manual não depende de credenciais de WhatsApp, contratação ou integração externa. Uma futura automação exige autorização própria, API oficial, revisão das condições do WhatsApp, limites, possíveis custos e risco de bloqueio.
