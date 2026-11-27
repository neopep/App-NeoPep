# NeoPep Connect AI — pacote candidato 0.1.0

O pacote contém o manifesto portátil, a configuração do MCP remoto do ambiente selecionado, uma skill e os ativos oficiais do NeoPep copiados do aplicativo no build. O endpoint ainda aguarda homologação e provisionamento autorizado. O pacote é independente do ChatGPT Sites.

## Instalação privada após homologação

- **ChatGPT:** adicione um servidor MCP personalizado em Plugins, quando essa opção estiver disponível para sua conta ou workspace. Use a URL do ambiente autorizado e autorize a conexão individual. A associação a uma instalação privada específica depende do registro no cliente.
- **Codex:** registre o mesmo servidor remoto na configuração MCP do cliente, ou use o pacote em uma fonte de plugins compatível. Confirme a organização, a disponibilidade e o login OAuth antes de usar.
- **Claude:** adicione a URL do MCP remoto como conector personalizado. Confirme a política do plano/workspace e o retorno OAuth.
- **Gemini:** adicione a URL como aplicativo conectado personalizado quando o recurso estiver disponível para a conta, a região e o cliente. O ZIP não é um instalador Gemini.

Cada conta autoriza o acesso separadamente. A mesma URL pode atender múltiplas conexões escopadas, desde que o emissor OAuth, a revisão do papel administrativo e a revogação estejam ativos. Sites pode servir para teste alternativo.

## Catálogo local versionado

Em um checkout autorizado da branch e do commit escolhido, rode na raiz do repositório:

```sh
python3 integrations/campaign-mcp/build-plugin.py --environment test --marketplace-tree /tmp/neopep-teste.zip
python3 integrations/campaign-mcp/build-plugin.py --environment production --marketplace-tree /tmp/neopep-producao.zip
```

O catálogo versionado está em `.agents/plugins/marketplace.json`. Abra o checkout no Codex ou ChatGPT Desktop compatível, reinicie o cliente e escolha **NeoPep Connect AI — catálogo local** na lista de plugins. Instale só o ambiente autorizado. O catálogo é uma distribuição local. A visibilidade do repositório e o acesso às campanhas são controles distintos.

Para atualizar, confira a revisão aprovada no GitHub, regenere a árvore e reinicie o Desktop. Se o cliente mantiver a versão em cache, desative e reinstale o plugin pelo catálogo. Para remover acesso, revogue primeiro a conexão individual no NeoPep e então desinstale no cliente. Outra conta deve concluir seu próprio fluxo OAuth, sem copiar credenciais.

## Compatibilidade de ChatGPT Plus

A documentação descreve fontes locais no Desktop e no Codex. A instalação deste pacote no Desktop, o conector no navegador e a disponibilidade no iPhone estão pendentes de teste individual com um endpoint HTTPS autorizado, três clientes elegíveis e OAuth ativo. Uma instalação local não comprova sincronização com Web ou iPhone. ChatGPT Sites é opcional.

O diretório público fica fora desta entrega. Nenhum pacote foi submetido.

- [Empacotamento e catálogos locais](https://developers.openai.com/plugins/build/plugins)
- [Conectar e testar](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Autenticação OAuth](https://developers.openai.com/plugins/build/auth)
