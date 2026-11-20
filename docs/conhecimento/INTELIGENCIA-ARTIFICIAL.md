# Inteligência artificial no atendimento

O painel administrativo versionado permite configurar comportamento, horários, conhecimento revisado e seleção de integração OpenAI, Gemini ou Claude. `agent-integrations` administra conexões e `ai-reply` processa respostas. O fluxo preserva atendimento humano, sugestões privadas e automação configurável. Mudança de mensagem, configuração ou modo invalida trabalho antigo. [Guia do agente](../AGENTE-DE-ATENDIMENTO.md) · [Administração e IA](../ADMINISTRACAO-INTEGRACOES-E-IA.md)

As credenciais ficam criptografadas no servidor. Somente o texto aprovado de material de conhecimento é salvo para contexto do agente. O agente usa texto recente do atendimento e encaminha temas clínicos à equipe. Estoque, pagamento, agenda e Google Drive permanecem fora do conjunto de ferramentas conectado. A memória técnica deste repositório orienta agentes de desenvolvimento e fica fora do conteúdo publicado e do contexto do atendente.

A ativação efetiva está não verificada nesta revisão. Configure em ambiente autorizado, preserve limites de tentativas e valide permissões, privacidade de sugestões, custeio, transição para atendimento humano e recuperação de jobs. [Funções do agente](../../supabase/functions/) · [Exemplo de cron](../../supabase/setup/ai-cron.example.sql)
