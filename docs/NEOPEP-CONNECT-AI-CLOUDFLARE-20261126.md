# NeoPep Connect AI — auditoria Cloudflare e hipótese de hospedagem
Data: 26/11/2026. Acesso Cloudflare autorizado e confirmado mediante API, somente GET. Nenhuma alteração DNS, Worker, Pages, TLS, billing ou deploy.
## Inventário confirmado
- Zona neopep.com.br ativa, tipo full, plano Free Website. Nove registros DNS; dois projetos Pages (neopep e neopep-analytics, branch main). Nenhum script Worker ou domínio Worker listado.
- neopep.com.br -> neopep.pages.dev, proxy ativo.
- analytics.neopep.com.br -> neopep-analytics.pages.dev, proxy ativo.
- app.neopep.com.br -> Vercel, DNS only.
- teste.app.neopep.com.br -> Vercel, DNS only.
- Registros de envio de e-mail e verificação existentes preservados. Não expor valores TXT.
- Não há registros DNS para connect.neopep.com.br ou connect-teste.neopep.com.br, nem wildcard listado. Propostas de hostname livres no inventário atual, revalidar antes de provisionar.
- Configurações globais lidas: SSL Full, min TLS 1.0, Always Use HTTPS off, security level medium. Revisar segurança do novo endpoint separadamente; não alterar configurações globais sem avaliar impacto nos serviços existentes. App/Teste DNS-only não passam pelo proxy Cloudflare.
- Consulta de faturamento/subscriptions negada (403, escopo Billing Read ausente). Plano da zona não comprova plano Workers; limites/custo efetivos precisam ser validados antes do provisionamento. Listagem Pages funcionou com paginação 10.
## Hipótese técnica prioritária
Avaliar Cloudflare Workers como host do MCP remoto Streamable HTTP, separado dos deploys Vercel. Documentação oficial: https://developers.cloudflare.com/agents/model-context-protocol/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/workers/pricing/ ; https://developers.cloudflare.com/workers/configuration/routing/custom-domains/ .
- Dois Workers/ambientes isolados, produção connect.neopep.com.br/mcp e teste connect-teste.neopep.com.br/mcp; nomes propostos, ainda não provisionados.
- Supabase permanece fonte de verdade para campanhas, autenticação, permissões, revisões, auditoria e armazenamento privado. Nenhuma duplicação de dados em D1/R2/KV por padrão. Se SDK MCP/OAuth exigir armazenamento de sessão/estado adicional, justificar e medir antes de adotar.
- Usar OAuth compatível com MCP, validar audience, emissor, escopos, conexão e revogação. A identidade de sessão real deve chegar às operações nativas de Campanhas sem burlar auth.uid/issuer. Confirmar Supabase OAuth e SDK no PoC. Não publicar credenciais. Atribuir somente domínio autorizado; HTTPS obrigatório no endpoint, sem cache para respostas autenticadas, CORS restrito conforme clientes, no-store, limitação de requisições e logs saneados.
- Prova inicial: serviço local/sintético, handshake, tools/list, consulta autenticada, isolamento, timeout, CPU, transferência de mídia e comparação Vercel/Supabase. Validar plano Workers e compatibilidade do host antes de selecionar definitivamente. Não ativar novos serviços pagos. Não confundir capacidade do servidor MCP com elegibilidade do cliente ChatGPT/Gemini.
- Utilizar Cloudflare CLI apropriado ao projeto e documentação atual, dependências fixadas, sem instalar duas CLIs por padrão. Manter landing e analytics em Pages intactos. Nenhuma mudança nos registros app/teste/e-mail/validação, nameservers, regras globais ou DNS até autorização específica. Ao vincular custom domain, usar procedimento oficial e confirmar TLS/rollback.
## Instrução Codex
Acrescentar este inventário à etapa 001 e comparar alternativas na 002/003. Primeira candidata Workers, decisão final condicionada ao PoC e verificação de plano. Não provisionar, não publicar e não alterar infra pelo prompt anterior. Preservar ponto de corte.
