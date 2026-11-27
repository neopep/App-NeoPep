# Vídeos nas campanhas — candidata 27/11/2026

Base: Produção Vercel READY 3164ccc09cca6385867f44fb7d616dc1faac097d. Teste publicado separadamente em 9f236f0910eb54ce82485f8c26ea2cc84ac39b6f. Não substituir uma base pela outra.

- Menu +: Vídeo, MP4 até 25 MiB (26.214.400 bytes), modo legenda ou mensagem separada. Sem cortes/conversão no editor. PDF/TXT continuam em 5 MiB. Prévia curta mantém 500 KiB.
- Biblioteca: ícone de download apenas para anexos com allow_download=true; a autorização de campanha permanece separada. Reutiliza a opção Arquivo original e revalidação.
- Connect: limites do transporte/IPC ajustados; vídeo acima de 16 MiB segue como documento MP4 para preservar os bytes, sem depender do limite de vídeo inline. Abaixo disso, preserva o comportamento de vídeo. WhatsApp pode processar mídia inline.
- SQL candidata modifica somente limites e negociação de capacidade; bloqueia arquivos grandes para workers antigos. Nenhum envio, alteração de flags ou migração remota executados.
- Antes de publicar: confirmar versão disponível 0.2.16 (ou ajustar allowlists para a versão assinada escolhida); CI web + Windows + testes da ponte, testar limites e permissões nos dois bancos, ensaiar SQL em banco isolado, gerar pacote Windows assinado e atualizar dispositivo, aplicar SQL Teste, testar campanha de arquivo até 25 MiB em grupo autorizado com aprovação do operador, reconciliar patch na branch vigente de Teste, regenerar dist/cloud.js pelo build, verificar cache e deploy. Depois promover Produção com mesma validação; não fazer merge em main desatualizada. Sem envio real nesta execução.
- A candidata foi criada para não interromper a integração Connect AI e as revisões atuais em produção. Gate automático Vercel desabilitado na branch. Não realizar deploy antes dos testes.

## Separação obrigatória — determinação de 27/11/2026

Este pacote é independente do projeto **NeoPep Connect AI**. Não modificar MCP, OAuth, agentes, catálogo/manual da IA, Cloudflare Workers da IA, configurações ou fluxos de autenticação, nem integrar alterações de IA por meio desta PR. O NeoPep Connect Windows é alterado exclusivamente no transporte de mídia de campanhas WhatsApp. Preservar a base vigente de cada ambiente e aplicar somente o diff desta PR. A ordem autorizada de publicação é **Produção primeiro, Teste depois**; compilação/homologação de candidato não equivale a publicação. A falha preexistente da CI do manual Connect AI (`46038322930`) fica registrada como independente e não será corrigida nesta tarefa. Executar CI própria de campanhas/Windows, mantendo intacta a CI de IA.
