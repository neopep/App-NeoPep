# NeoPep Connect AI — pacote candidato 0.1.0

O pacote contém o manifesto portátil, a configuração do MCP remoto de Teste, uma skill e os ativos oficiais do NeoPep copiados do aplicativo no build. O endpoint ainda aguarda homologação e provisionamento autorizado. O pacote é independente do ChatGPT Sites.

## Instalação privada após homologação

- **ChatGPT:** adicione um servidor MCP personalizado em Plugins, quando essa opção estiver disponível para sua conta ou workspace. Use a URL de Teste e autorize a conexão individual. A associação a uma instalação privada específica depende do registro no cliente.
- **Codex:** registre o mesmo servidor remoto na configuração MCP do cliente, ou use o pacote em uma fonte de plugins compatível. Confirme a organização, a disponibilidade e o login OAuth antes de usar.
- **Claude:** adicione a URL do MCP remoto como conector personalizado. Confirme a política do plano/workspace e o retorno OAuth.
- **Gemini:** adicione a URL como aplicativo conectado personalizado quando o recurso estiver disponível para a conta, a região e o cliente. O ZIP não é um instalador Gemini.

Cada conta autoriza o acesso separadamente. A mesma URL pode atender múltiplas conexões escopadas, desde que o emissor OAuth, a revisão do papel administrativo e a revogação estejam ativos. Sites pode servir para teste alternativo.

## Preparação para revisão pública

A documentação da OpenAI indica a submissão de endpoint HTTPS estável pelo caminho **With MCP**. Antes de submeter, valide descoberta OAuth, PKCE S256, redirects registrados, revisão de escopos, políticas públicas de privacidade e termos, ativos, testes com conta de revisão e elegibilidade. Use apenas dados de Teste. A publicação depende de autorização separada.

Referências oficiais:

- [Empacotamento OpenAI](https://developers.openai.com/plugins/build/plugins)
- [Autenticação OpenAI](https://developers.openai.com/plugins/build/auth)
- [Submissão OpenAI](https://developers.openai.com/plugins/deploy/submission)
- [MCP no Codex](https://developers.openai.com/codex/mcp)
- [Conectores personalizados Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Aplicativos conectados Gemini](https://support.google.com/gemini/answer/17209137)
