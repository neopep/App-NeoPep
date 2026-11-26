# Liberação de documentos originais — 26/11/2026

Autorização explícita do responsável para PDF/MP4 direto nas campanhas. Estado confirmado após operação administrativa: enabled=true, originals_enabled=true, fila rich waiting/leased/started/uncertain=0 em Produção e Teste. Antes da alteração, um Connect aprovado com versão compatível e heartbeat recente foi confirmado em cada ambiente. Operação transacional, com locks de fila e controle, exigindo fila ociosa. Nenhuma mensagem foi enviada pelo procedimento. Limite vigente 5 MiB por original e 500 KiB para a prévia curta; mantém confirmações de envio, propriedade, validação de formato, dispositivo autorizado e demais gates. Nenhuma alteração nas permissões dos membros ou materiais da Biblioteca.

A configuração foi alterada nos bancos, sem novo deploy. Envio real de documento ainda requer teste pelo responsável no grupo autorizado. O aceite de cliente não comprova necessariamente entrega a cada destinatário. Se for necessário suspender esta modalidade, usar a configuração existente originals_enabled=false em janela ociosa, sem desabilitar autorização ou segurança dos outros recursos.

## Biblioteca: nova candidata de compartilhamento por anexo

A autorização de download dos membros deve permanecer separada da autorização de exportação em campanhas. Candidata desenvolvida na branch de Teste, sem aplicação da migração ou publicação neste registro:
- inherit: mantém a regra anterior.
- cover: capa + link.
- preview: somente vídeo curto + link, sem autorizar o original.
- original: arquivo PDF/MP4 integral elegível, e prévia para vídeo quando disponível.
- Alterações explicitamente confirmadas pelo administrador proprietário do anexo, verificação da versão anterior da permissão, revalidação antes do download e URL assinada privada. Sem autorização de envio automático.
- A prévia precisa ser gerada pelo Connect. PDF pode ser compartilhado como documento ou capa + link. O limite do original é mantido. Uma cópia já enviada ao WhatsApp não pode ser recolhida por alteração posterior da autorização.

CI, aplicação integral da migração, revisão de concorrência e homologação real ainda necessárias para a nova candidata. O gate de envio de originais existente foi habilitado conforme autorização, não se confundindo com o novo controle por material.
