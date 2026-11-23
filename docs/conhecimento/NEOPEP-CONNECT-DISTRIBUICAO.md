# Distribuição independente do NeoPep Connect

## Teste 0.2.7

O banco de Teste já registra 0.2.7 como `approved`, com assinatura de manifesto, evidência e objeto de 50.496.512 bytes. SHA-256 registrado `145b5f174f36972071e8e166ae3ca38c38eeac3cd06e5c309325d8131b02d096`. A conferência foi somente leitura. O binário dessa versão não foi preparado novamente.

Em Windows, use a sessão Teste em um computador aprovado e faça **Verificar atualizações**. Antes de confirmar **Atualizar agora**, confira a oferta e feche os compositores de ambos os perfis. Depois, compare a sessão, o QR, o cofre e os grupos de Teste e confirme que Produção inicia sem dados daquele perfil. Faça o ensaio de falha e rollback em um computador de homologação. Nunca exponha URLs assinadas. Authenticode da 0.2.7 existente ainda depende de verificação do arquivo no Windows, separada da assinatura do manifesto.

## Esteira privada

O workflow comum recebe o perfil explicitamente e usa a árvore dual-ambiente. O candidato de Produção vem de um SHA revisado da main. O agente de Produção tem configuração DPAPI, histórico, tarefa agendada, token e rota próprios. A configuração de Teste sem o campo de perfil continua válida. Atualize os scripts do agente Teste preservando o `agent.xml` e os recibos locais. Atualize o Git blob confiável somente depois de revisar o workflow privado.

A mesma chave pública RSA pinada mantém compatibilidade com os clientes instalados. O perfil faz parte da assinatura e o cliente também valida o host do URL. O novo token de Produção é independente e somente seu digest vai em `NEO_CONNECT_PRODUCTION_AGENT_TOKEN_SHA256` na Edge do projeto oficial. O certificado Authenticode é separado da chave de manifesto e deve estar disponível no cofre do usuário Windows. Em Produção o agente assina o setup, exige timestamp e status válido e só então calcula os bytes e SHA-256 assinados no manifesto. O broker recebe somente o arquivo daquele ambiente, confere seu hash e cadastra rascunho. Um manifesto de Teste não pode ser reaproveitado em Produção.

A lista registra a evidência de build e verificação apenas após gravar o rascunho. O estado anterior à assinatura fica nos recibos locais. Sem contato com o agente, o painel não confirma seu progresso. As ações de aprovação e bloqueio continuam restritas ao administrador e ao projeto atual. O cliente instala após confirmação da pessoa.

## Ativação e evidências pendentes

1. Aplicar o workflow revisado ao repositório privado com a conta autorizada. Instalar o agente de Produção no Windows custodiante com o thumbprint Authenticode e o blob aprovado. Preservar o agente de Teste, seu token e recibos.
2. Publicar a Edge de rascunho em Produção após aprovação do PR e configuração do digest próprio. O broker JWT de download, o bucket privado e a RPC de evidência já existem. Conferir rejeição do token de Teste.
3. Após promoção seletiva da árvore do Windows, solicitar o candidato oficial pelo workflow privado, verificar Authenticode e evidência e deixar em rascunho. Este passo não deve copiar o objeto já existente em Teste.
4. Ensaiar Teste com 0.2.4, 0.2.5 ou 0.2.6 autorizada, e depois dois logins e dois WhatsApps em 0.2.7. Em Produção validar em dispositivo explicitamente autorizado antes de qualquer distribuição.

[Issue #30](https://github.com/neopep/App-NeoPep/issues/30)
