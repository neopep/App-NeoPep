# NeoPep Connect AI — alternativa híbrida com executor Windows

Proposta em avaliação, sem implementação ou provisionamento. Manter o servidor MCP acessível na nuvem (Cloudflare Workers como primeira candidata; Vercel como alternativa) e o Supabase como fonte de verdade. Aproveitar o NeoPep Connect Windows existente para processamento local opcional e preservar seu fluxo atual de WhatsApp. Não transformar o computador em requisito para listar, editar ou salvar campanhas App, nem substituir o mecanismo nativo de agenda.

## Responsabilidades
- MCP: autenticação de contas externas, catálogo, autorização, contratos, consultas, criação/edição e comandos de agenda via operações nativas; retornar status real e não aguardar tarefa local longa na requisição.
- Supabase: persistir mídia privada, fila dedicada de processamento opcional, estados, idempotência, leases, auditoria e associação entre campanha/publicação/bloco. Reutilizar estruturas existentes se adequadas; sem misturar fila de mídia e fila de envio WA.
- Windows: capacidade opcional para redimensionar/reencodar imagens, conversão de mídia e importações em lote. Receber tarefa por conexão de saída autenticada, validar tipo, tamanho, ambiente, escopo e ownership; não executar comandos arbitrários recebidos de IA. Identidade de dispositivo com credencial revogável e limitada. Não enviar chaves service_role ao Windows.
- App: menu separado de integrações, status online/offline, pendências e capacidade do executor; operações de App independentes do Windows quando não exigem processamento local.

## Disponibilidade e segurança
Computador desligado, suspenso, sem internet ou app encerrado: tarefas locais permanecem pendentes até reconexão, se ainda válidas; nunca marcar como concluídas nem disparar campanha vencida sem política explícita de revalidação. Não presumir garantia de envio WhatsApp offline; preservar e auditar regras atuais de reconexão e entrega. Lease com expiração, retries limitados, recibo idempotente e proteção contra reprocessar/criar duplicatas, cancelamento e limpeza segura de temporários. Validar mídias, descompactação limitada contra zip bombs e path traversal; nenhuma execução de scripts ou acesso a arquivos locais arbitrários. Produção e Teste rigorosamente separados; sem acesso a arquivos pessoais.

## Alternativa local integral
Cloudflare Tunnel (https://developers.cloudflare.com/tunnel/concepts/) pode publicar endpoint MCP em computador usando conexão de saída, sem encaminhar porta do roteador ou IP público. Exige processo local, internet e Windows ligados para toda operação. Ainda exige OAuth e autorização MCP, não expor rede ou desktop. Não é a opção padrão. No híbrido com Windows buscando tarefas no Supabase por HTTPS, Tunnel não é necessário.

## Próxima avaliação Codex
Inspecionar código efetivamente publicado do Connect Windows, protocolo de conexão, autenticação, atualização, persistência e isolamento dos dois ambientes antes de propor extensão. Medir CPU/memória, largura de banda, custo, desconexão, retomada, filas e impacto no envio existente. Primeiro provar leitura e criação de rascunho MCP independente de Windows; depois PoC de uma tarefa de mídia sintética com executor local e recuperação offline. Não instalar serviços, provisionar DNS/Tunnel/Worker, migrar banco, publicar, ou mudar WhatsApp sem aprovação. Esta proposta complementa os documentos de hospedagem, contrato e ponto de corte; não altera a pendência de Teste anterior.
