# NeoPep Connect AI — modalidades Desktop e Nuvem

Decisão de 27/11/2026. Manter a integração administrativa privada e somente leitura.

## Desktop (homologado)
ZIP 1.0.5, instalação manual e OAuth individual. Validado em duas contas Codex Windows. Não alterar o pacote nem revogar as conexões existentes.

## Nuvem (pendente)
Registro privado do MCP diretamente no ChatGPT Web, em conta elegível. Mesmo endpoint https://connect.neopep.com.br/mcp, OAuth com CIMD quando disponível, escopo campaigns:read. Nome sugerido: NeoPep Connect AI – Nuvem. Sem credenciais embutidas, sem acesso de escrita e sem publicação no catálogo público.

Pré-requisito: permissões/assinatura compatíveis com MCP personalizado. Segundo a documentação oficial de 27/11/2026, Business/Enterprise/Edu têm suporte completo na Web; Pro pode conectar MCP de leitura. Plus não consta como elegível para esse registro; não assumir suporte. Criação móvel não suportada. Testar execução móvel separadamente se a plataforma permitir.

Procedimento: https://chatgpt.com/plugins → + → Adicionar servidor MCP personalizado → preencher URL e autenticação → autorizar leitura → criar plugin → registrar identificador técnico real (plugin_asdk_app...) → nova conversa → verificar ferramentas e consultar campanha. Não fabricar identificador.

Critérios de aceite: identidade administrativa validada; get_capabilities, list_campaigns e get_campaign funcionando; consultar horários, grupos, recibos e recorrências; sem exposição de dados de terceiros; sem operações de escrita; funcionar com Windows desligado. Testar ChatGPT Web e iOS separadamente. Se não elegível, manter Desktop e registrar bloqueio de plataforma; não criar novo ZIP como tentativa de contorno.

Referências oficiais:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/app-review

A publicação pública requer intenção explícita, identidade verificada e revisão da OpenAI; fora do escopo desta decisão.
