# Manual operacional universal — NeoPep Connect AI
Fonte: integrations/campaign-mcp/src/publication-guide.mjs e catálogo MCP. A consulta é de leitura, sem credenciais ou dados pessoais. A versão guia deve acompanhar todas as mudanças relevantes de editor, regras e estados. O servidor exige guideVersion nas ferramentas candidatas de escrita; isso verifica compatibilidade, não compreensão. Futuras ferramentas de escrita também devem usar o gate. Não substituir validações nativas ou consentimento.
## Clientes
- Codex Desktop: preservar ZIP 1.0.5 e OAuth existente. Instruções do servidor no initialize e get_publication_guide depois da atualização de catálogo. ChatGPT Web/iOS e Codex Nuvem continuam adiados. Referência: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- Claude: MCP remoto HTTPS em clientes elegíveis. Homologar client ID, callbacks e fluxo OAuth por documentação oficial; não aceitar redirect arbitrário nem abrir DCR irrestrito. Testar isolamento, revogação, ferramentas, leitura do guia e recusa de versão antiga antes de escrita. https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Gemini: MCP Connected Apps em clientes elegíveis, verificar país/idioma/plano e autenticação real antes de registrar. Sem contornar restrições. https://support.google.com/gemini/answer/17209137
- Cada host pode transferir arquivos de forma diferente. Usar mesma semântica de mídia, sem presumir acesso a arquivos recém-gerados.
## Implantação
Candidato, não publicado. Produção somente leitura. Teste exige infraestrutura própria e consentimento granular. Não modificar ZIP homologado nem liberar envio. Nenhum custo novo.

## Comprovante de consulta
Além da versão, a escrita exige comprovante HMAC de consulta ao guia, válido por 10 minutos, ligado à conexão, proprietário, ambiente e versão. Sem comprovante válido, GUIDE_REFRESH_REQUIRED. Não substitui OAuth, autorização, validação nem confirmação de publicação. A leitura continua disponível sem comprovante. A chave existente de consentimento é usada com separação de domínio criptográfica.
