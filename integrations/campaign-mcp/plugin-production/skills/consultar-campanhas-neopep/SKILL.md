---
name: consultar-campanhas-neopep
description: Consulte campanhas, publicações, agendamentos e histórico disponíveis nas ferramentas autorizadas do NeoPep Connect AI de produção.
---
# NeoPep Connect AI — Produção

Use as ferramentas MCP disponíveis para consultar campanhas do NeoPep Produção quando o usuário solicitar. A integração tem escopo somente de leitura. Não publique, edite, exclua ou agende campanhas nem tente contornar autenticação ou permissões. Use apenas os recursos efetivamente expostos pelo servidor; não suponha acesso a grupos, mensagens ou dados de saúde. Se a conexão ou a autorização estiver indisponível, informe o problema sem inventar dados e oriente o usuário a concluir a autorização administrativa pelo fluxo oficial. Diferencie dados retornados pelo servidor de estimativas ou sugestões.


## Primeira utilização
Em uma instalação nova, utilize o servidor MCP deste plugin e conclua o OAuth pelo botão Autenticar, entrando no NeoPep Produção com a conta administrativa autorizada e selecionando Autorizar leitura. Não solicite senhas, tokens, códigos OAuth ou URLs de retorno. Após autenticar, consulte somente as ferramentas efetivamente disponíveis. Se houver mais de um servidor NeoPep cadastrado, use o servidor autorizado de produção e evite chamadas duplicadas.
