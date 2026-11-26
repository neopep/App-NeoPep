# NeoPep — IA integrada à Central de Campanhas
## Marco de 26/11/2026 — primeira candidata, sem publicação

Base: revisão a315404729c284475e1f0b1f1d917609e4f2ed11, pacote da loja preparado. Não fazer merge, deploy ou migração em Produção sem revisar o pacote consolidado.

### Diagnóstico confirmado
- Produção: Gemini gemini-3.1-flash-lite possui credencial cadastrada e revisão validada; OpenAI gpt-6-astra possui credencial cadastrada mas não validada. Teste: nenhuma integração validada.
- agent-integrations e ai-reply atendem conversas. Não alterar seus fluxos, instruções, credenciais, limites ou endpoints.
- neo_agent_credentials é acessível ao service_role e não aos clientes anon/authenticated nos dois ambientes.
- campaign_admin_allowed exige sessão e membro administrativo. Central já mantém publicações editáveis, versões e agendamento em lote.
- system_ai_calls existe nos dois ambientes; o registrador legado rotula chamadas de suporte. A candidata registra campaign_generation separadamente e preserva o ambiente.

### Entrega inicial
- `supabase/functions/_shared/campaign-ai-plan.mjs`: contrato de briefing, canal, datas (São Paulo), até cinco publicações por chamada, saída estrita e validação de contagem, duplicidade, URLs e datas. A IA não controla destinatários, caminhos, IDs nem ações.
- `supabase/functions/campaign-ai/index.ts`: candidata a Edge Function administrativa. Reutiliza a credencial Gemini validada pelo servidor, sem enviá-la ao navegador. Só retorna conteúdo para revisão, não cria nem agenda campanhas. Sem chamadas pagas nesta etapa.
- `release/campanhas-ia-20261126/access_candidate.sql`: candidato de autorização, reserva única por ID de requisição e limites próprios (3 chamadas/minuto, 20/dia), registro de tokens por funcionalidade. Não aplicado.
- `tests/campaign-ai-plan.test.cjs`: testes locais de contrato; validada por execução equivalente em memória. Ainda precisa rodar no CI e testar a Edge Function com respostas simuladas e reais em ambiente autorizado.

### Próximos marcos
1. Assistente na Central de Campanhas (novo botão Criar com IA): briefing, tom, canal, quantidade até 60, distribuição de datas/horários, estilo visual, fonte de texto e imagem. Seleção apenas de integrações validadas. Capacidade e preço devem ser verificados antes de chamar o provedor.
2. Coordenador de geração: dividir em lotes de até 5, respeitar limite e cancelamento, persistir planejamento e progresso, reaproveitar resultado anterior; não repetir chamadas pagas em falha de rede sem confirmação. Não afirmar que o primeiro módulo já faz esta orquestração.
3. Imagens em etapa independente: prompt visual e identidade NeoPep, seleção de modelo de imagem habilitado na mesma chave, aprovação e limite por quantidade/custo, compressão para JPEG e upload privado pelo fluxo de campanha. Nunca acessar fotos pessoais ou usar referências de membros sem autorização. Não gerar depoimentos ou comparações falsas.
4. Revisão: calendário com publicação, texto, imagem, regeneração individual, editar/deselecionar, aplicar horários e público em massa.
5. Persistência: criar/publicar somente via APIs existentes de Central; primeiro salvar rascunhos com IDs e request_ids estáveis. Revisar e escolher destinatários autorizados no app; agendamento coletivo permanece separado e sujeito aos gates/confirmations já existentes.
6. Integrações externas e importador podem usar o mesmo contrato posteriormente. MCP não é necessário para a IA dentro do aplicativo.
7. Teste: preparar credencial própria de ambiente; validar permissões, ausência de vazamento de chaves, quota, interrupções e reconciliação, JSON inválido, falhas de mídia, monitoramento e agendamento sem envio automático. Validar UI iPhone/Windows. Só depois consolidar e publicar na ordem Produção → Teste conforme orientação anterior, com bases isoladas.

### Limites atuais
Não houve deploy, migração, alteração nas integrações existentes nem geração por API real. A candidata ainda não está disponível na interface. O modelo de imagem e as opções de OpenAI/Claude exigem validação independente. O orçamento monetário automático de imagens e a precificação Gemini precisam ser implementados e validados; a limitação inicial de chamadas/tokens não é teto monetário garantido.
