# NeoPep Connect AI — compatibilidade e distribuição privada

Decisão do usuário: ChatGPT, Claude e Gemini são três clientes-alvo obrigatórios do projeto, além do Codex como cliente auxiliar de desenvolvimento. Um único servidor MCP remoto Cloudflare, catálogo e contratos compartilhados, Supabase como fonte de verdade. Não criar três backends nem exigir API paga de geração por padrão. Adaptadores/manifestos específicos apenas onde o cliente requer. Não publicar no diretório público da OpenAI; priorizar marketplace privado e configuração MCP individual em clientes elegíveis. ChatGPT Sites apenas alternativa de teste, não dependência principal.

## Homologação por cliente
- ChatGPT: validar instalação privada via marketplace compatível em desktop/Work e Codex; verificar separadamente Plus web e iPhone, inclusive disponibilidade de escrita, confirmação e transferência de arquivos. Não presumir sincronização ou elegibilidade do plano.
- Claude: validar conector MCP remoto via URL, OAuth e permissões em contas elegíveis; testar leitura, rascunhos, confirmações e transferência de anexos. Não presumir geração nativa de imagens.
- Gemini: validar recurso de conexão MCP na conta/região Brasil, plano, idioma e cliente; testar descoberta, OAuth, chamadas, confirmações e transferência de imagens; se indisponível, registrar bloqueio e alternativa oficial, sem contornar restrições.

## Critérios comuns de aceite
Múltiplas contas independentes de cada host, autorização e revogação por conexão, isolamento Teste/Produção, tools/list de capacidades efetivamente operacionais, leitura e escrita de campanhas App/WhatsApp, criativos por transferência suportada ou fallback autorizado, agendamento/publicação com confirmação verificável, auditoria, atualização de catálogo e instruções versionadas de instalação/remoção. Matriz por host, plano, dispositivo e região com evidência de testes; distinguir compatibilidade de protocolo, instalação e homologação ponta a ponta. Não declarar compatibilidade plena sem teste real; limitações externas não bloqueiam desenvolvimento independente dos demais clientes.

Referências oficiais a reconfirmar na homologação: https://developers.openai.com/plugins/build/plugins ; https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt ; https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp ; https://support.google.com/gemini/answer/17209137 .

Preservar continuidade e ponto de corte. Nenhum provisionamento, submissão pública, migração, envio real ou gasto autorizado por este documento.

## Matriz operacional para homologação privada

Use o mesmo servidor MCP por ambiente e os mesmos schemas e escopos. O marketplace versionado distribui os pacotes locais OpenAI. Os conectores remotos usam a URL do ambiente, sem exigir o ZIP. Cada instalação recebe autorização individual, inclusive quando o mesmo administrador usa várias contas do mesmo cliente.

| Cliente | Plano e superfície a testar separadamente | Entrada privada candidata | Evidência atual |
|---|---|---|---|
| ChatGPT | Plus Desktop/Work | Catálogo local do repositório | Formato documentado. Instalação e OAuth pendentes. |
| ChatGPT | Plus Web | Conector remoto se disponível para a conta | Instalação, uso e disponibilidade na conta pendentes. |
| ChatGPT | Plus iPhone | Conector remoto, conforme recurso disponível na conta | Disponibilidade no iPhone, OAuth e continuidade da autorização pendentes. |
| Claude | Conta individual elegível, Web e Desktop em testes separados | Conector personalizado por URL | Caminho documentado. Plano, acesso e execução pendentes. |
| Claude | Celular, no mesmo plano | Verificar disponibilidade do conector | Pendente. |
| Gemini | Conta elegível no Brasil, Web em português | Aplicativo conectado personalizado por URL, quando disponível | Elegibilidade, descoberta, OAuth e execução pendentes. |
| Gemini | Celular, mesma região e plano | Verificar disponibilidade do aplicativo conectado | Pendente. |
| Codex | CLI e integração Desktop | Catálogo local ou configuração MCP do cliente | Cliente adicional. SDK MCP testado em fixture, instalação Codex pendente. |

Para cada linha, registrar versão do cliente, plano, região e dispositivo. Depois de autorização explícita para homologar, conectar duas contas independentes ao mesmo ambiente, conferir `tools/list`, desautorizar uma e provar que a outra mantém acesso. Repetir as mesmas leituras e comparar os schemas observados. No iPhone e no Web, verificar o plugin em cada cliente, mesmo se já estiver instalado no Desktop. Confirmar escrita e criativos somente depois que estiverem habilitados e com dados fictícios. Se a conta não oferecer o mecanismo oficial, registrar o bloqueio e continuar o desenvolvimento no servidor comum.

O teste com o SDK oficial não autentica contas de ChatGPT, Claude ou Gemini. Nenhuma instalação, sincronização entre superfícies ou disponibilidade regional foi comprovada.
