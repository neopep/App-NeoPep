# Pop-ups e campanhas

Abra Campanhas no painel. Crie um rascunho, preencha o texto e use as prévias de celular e computador. Salvar cria ou atualiza a campanha. Ativar / agendar aplica as datas do formulário no fuso IANA informado e usa os dias da semana e as horas para a recorrência. Para uma campanha única, defina início e encerramento no mesmo dia. Para janela diária atravessando meia-noite, use intervalos separados. Horas inexistentes por ajuste de relógio são recusadas. Em caso de hora ambígua, vale a interpretação padrão do PostgreSQL. Arquivar retira a campanha de circulação e preserva os totais. Duplicar copia a configuração dos canais para um novo rascunho, sem recibos.

O editor pesquisa documentos da Biblioteca, produtos ativos e descontos gerais da Loja. Documentos abrem o material e produtos abrem a ficha existente. Ofertas e promoções levam à Loja, onde continuam valendo os preços, cupons e critérios do checkout. O editor também aceita links manuais e imagens estáticas do mesmo domínio.

Imagens do editor são redimensionadas para até 1.600 px, regravadas como JPEG e armazenadas no bucket privado `neo-campaign-images`, com limite de 5 MB. Só administradores podem enviar. O pop-up recebe URL assinada de 120 segundos após a reserva autenticada da campanha. Remover a imagem no editor desvincula o arquivo da campanha. A limpeza física de imagens desvinculadas demanda verificação de referências antes de qualquer exclusão.

Segmentos usam a data de criação no Auth ou o vínculo com a comunidade. A opção Vincular plano a uma conta grava a associação em `neo_private.campaign_plans` mediante autorização administrativa. Use o UUID da conta e um código em minúsculas. Deixe o código vazio para remover o vínculo. A associação fica sob RLS e registra quem a modificou e quando. A segmentação ignora metadados da conta. O vínculo por plano é mantido pelo administrador de campanhas, sem integração com faturamento.

O pop-up espera a sessão e o cadastro, respeita a prioridade, a frequência e o limite por conta. O painel conta exibições e cliques, sem atribuição de compras. O canal push funciona separadamente. O worker pode reservar um aviso por campanha e dispositivo elegível, mesmo sem abertura do app. A fila considera opt-in específico do Perfil, inscrição do dispositivo, agenda e público. O texto é genérico e leva ao Início.

O consumo da fila exige um worker publicado no Supabase `qnuluspqfazdppciermw` com `NEO_STAGING_CAMPAIGN_PUSH=1`. Mantenha essa opção desligada até testar consentimento e destinatário com um único dispositivo fictício. O ensaio pode ser manual, com cron desligado. Nenhuma alteração de VAPID é necessária.

Para retirar a funcionalidade, pause as campanhas, preserve o bloqueio do worker de push e restaure o frontend anterior. As migrações são aditivas e mantêm os registros já criados.

## Manual e dicas

A aba Campanhas oferece **Como criar uma campanha** ao lado de **Nova campanha**. O manual original integra o pacote estático. O diálogo mantém o formulário montado e restaura foco e rolagem ao fechar. As setas mudam de página, **Ajustar** retorna à escala automática e os controles de zoom funcionam também por pinça. **Texto da página** oferece o conteúdo extraído para leitura assistida. Os 26 textos de ajuda aparecem nos respectivos campos. Escape ou um toque fora recolhe a dica.

O leitor administrativo é independente da Biblioteca e usa o PDF.js local. Para outro documento administrativo público, inclua o arquivo em `dist/assets/` e passe caminho, título e botão de origem a `NeoAdminPDF.open`. Documentos privados exigem um fluxo autenticado próprio.
