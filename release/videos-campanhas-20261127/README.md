# Vídeos nas campanhas — candidata 27/11/2026

Base: Produção Vercel READY 3164ccc09cca6385867f44fb7d616dc1faac097d. Teste publicado separadamente em 9f236f0910eb54ce82485f8c26ea2cc84ac39b6f. Não substituir uma base pela outra.

- Menu +: Vídeo, MP4 até 25 MiB (26.214.400 bytes), modo legenda ou mensagem separada. Sem cortes/conversão no editor. PDF/TXT continuam em 5 MiB. Prévia curta mantém 500 KiB.
- Biblioteca: ícone de download apenas para anexos com allow_download=true; a autorização de campanha permanece separada. Reutiliza a opção Arquivo original e revalidação.
- Connect: limites do transporte/IPC ajustados; vídeo acima de 16 MiB segue como documento MP4 para preservar os bytes, sem depender do limite de vídeo inline. Abaixo disso, preserva o comportamento de vídeo. WhatsApp pode processar mídia inline.
- SQL candidata modifica somente limites e negociação de capacidade; bloqueia arquivos grandes para workers antigos. Nenhum envio, alteração de flags ou migração remota executados.
- Antes de publicar: confirmar versão disponível 0.2.16 (ou ajustar allowlists para a versão assinada escolhida); CI web + Windows + testes da ponte, testar limites e permissões nos dois bancos, ensaiar SQL em banco isolado, gerar pacote Windows assinado e atualizar dispositivo, aplicar SQL Teste, testar campanha de arquivo até 25 MiB em grupo autorizado com aprovação do operador, reconciliar patch na branch vigente de Teste, regenerar dist/cloud.js pelo build, verificar cache e deploy. Depois promover Produção com mesma validação; não fazer merge em main desatualizada. Sem envio real nesta execução.
- A candidata foi criada para não interromper a integração Connect AI e as revisões atuais em produção. Gate automático Vercel desabilitado na branch. Não realizar deploy antes dos testes.
