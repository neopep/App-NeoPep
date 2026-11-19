# Seu agente de atendimento — ativação

## O que esta versão entrega

Administração → Configurações → Seu agente. O comportamento é independente do serviço de IA. Há uma conexão inicial ChatGPT · OpenAI, ainda sem chave ou modelo, e cadastro de até 12 integrações OpenAI, Gemini e Claude. Cada uma pode ter nome, modelo, chave própria e workspace da Anthropic quando exigido. É possível testar, selecionar, alterar a chave e excluir uma conexão não selecionada.

O agente tem nome, tom de voz, instruções, apresentação da empresa, políticas, orientações comerciais, informações que pode solicitar, horário/dias/fuso e limite diário de tentativas. Conhecimento: até 40 itens, 6 mil caracteres por item e 24 mil caracteres ativos no total. PDF/TXT até 5 MB são extraídos no navegador para revisão; no máximo 30 páginas e 6 mil caracteres são importados por vez. PDF escaneado precisa de transcrição. Somente o texto revisado é salvo; o arquivo original não é enviado ao modelo. Links são referências, não navegação nem sincronização automática.

Nas conversas administrativas há Minha resposta, Sugestões, Agente automático e Usar configuração geral. Minha resposta pausa a automação e atribui a conversa ao administrador. Sugestões ficam em uma área privada e podem ser editadas, enviadas ou descartadas. Participantes não recebem modos de edição ou rascunhos. O atendimento é apresentado discretamente como virtual e equipe; as respostas automáticas usam o nome do atendimento, sem repetir aviso de IA em cada mensagem e sem fingir ser uma pessoa humana.

Alterar instruções/conhecimento, trocar a integração ou assumir/mudar o modo descarta respostas antigas. Cada nova mensagem invalida uma sugestão anterior. Nenhuma função consulta registros de saúde ou anexos da conversa para montar contexto; até 12 textos recentes são utilizados. Assuntos clínicos são encaminhados à equipe. Ferramentas para estoque, pagamento, agendamento e Google Drive não estão conectadas e não são anunciadas como executadas.

## Estado de entrega

Interface e código de servidor preparados e testados localmente. Publicar a interface NÃO aplica SQL, implanta Edge Functions nem configura chaves no Supabase. O painel mostra ativação pendente até o banco ser atualizado. O agente continua desligado por padrão. As integrações reais e o custo das APIs precisam de teste após a configuração pelo responsável.

## 1. Banco

No projeto cpslafpzjtbpmoxxysaa → SQL Editor → New query, execute o arquivo `NeoPeptideos-agente-atendimento.sql` completo, até `commit;`. É a migração `202611140026_agent_workspace.sql`, aplicada depois da estrutura existente de atendimento/Biblioteca. Não substitua por uma migração antiga. Não exclui registros ou conversas. Reexecutar preserva as configurações e credenciais criptografadas existentes.

## 2. Proteção das chaves

Abra o arquivo local `NeoPeptideos-gerar-chave-protecao.html`. Clique em Gerar e copie a chave para Supabase → Edge Functions → Secrets, nome `NEO_AI_ENCRYPTION_KEY`. O arquivo não tem acesso à rede. É uma chave AES de 32 bytes em Base64 gerada no seu navegador, diferente das chaves OpenAI/Google/Anthropic. Guarde uma cópia no seu gerenciador de senhas. Não envie a chave no chat. Trocar ou perder essa chave exige cadastrar novamente as chaves de todas as integrações.

As chaves dos serviços são criptografadas com AES-GCM, vinculadas ao ID da integração e guardadas em uma tabela privada com RLS, sem permissões para usuários comuns ou leitura por administradores no navegador. Só funções do servidor autorizadas podem recuperá-las. O formulário envia a chave por HTTPS, limpa o campo e nunca a persiste em localStorage, sessionStorage ou config.js. A chave mestra permanece nos Secrets das Edge Functions. Metadados retornam apenas “chave presente”, nunca o valor.

Verifique também `ALLOWED_ORIGINS` (preserve as duas origens):

```
https://app.neopep.com.br,https://elo-minha-evolucao.supplemast3.chatgpt.site
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizados pelo Supabase no servidor. Nunca copiá-los para a configuração pública.

## 3. Funções

No Supabase → Edge Functions, publique/atualize:

- Nome exato `agent-integrations`: conteúdo integral de `NeoPeptideos-agent-integrations.ts`.
- Nome exato `ai-reply`: conteúdo integral de `NeoPeptideos-ai-reply.ts`.

Os arquivos são autocontidos. Em Settings dessas duas funções, desative **Verify JWT with legacy secret** e salve: o código verifica a sessão pelo Auth, o administrador pelo banco e a origem. `ai-reply` também aceita o segredo específico da rotina agendada. Desativar o gateway não dispensa essas verificações no código. Não teste com uma mensagem real de participante até configurar e validar o agente.

O endpoint anterior `platform-integrations` pode permanecer para seu status antigo; o novo gerenciador usa `agent-integrations`.

## 4. Integrações no painel

1. Administração → Configurações → Seu agente → Integrações.
2. Configurar a conexão ChatGPT · OpenAI, informar o identificador exato de um modelo disponível na conta API e colar a chave. Ou Adicionar integração e escolher Gemini/Claude.
3. Salvar integração. A chave não retorna ao formulário. Para substituí-la, cole outra; campo vazio mantém a atual. Alterar de serviço exige nova chave.
4. Testar conexão: envia uma mensagem sintética, usa a cota da API e conta no limite diário. Só um teste bem-sucedido marca a revisão atual como validada.
5. Selecionar “Usar no agente” na conexão desejada ou escolher no seletor de comportamento. Trocar seleciona com o agente desligado, para revisão. Não existe fallback automático para outro provedor.
6. Preencher comportamento e conhecimento; testar uma resposta com uma pergunta inventada. Testes não publicam mensagens na conversa.
7. Escolher modo Sugestões para o primeiro teste com conta de teste. Habilitar o agente e salvar.
8. Conferir que a sugestão só aparece para o administrador. Revisar e enviar. Depois testar o modo automático e a pausa por Minha resposta.

Assinaturas ChatGPT, Gemini e Claude não fornecem necessariamente saldo de API. Use a conta API de cada serviço. O limite diário (1–500, padrão 50) conta tentativas, testes e retentativas, não é um teto financeiro garantido. Configure também limites e alertas no provedor.

## 5. Rotina para recuperar respostas pendentes

O aplicativo chama a geração após a mensagem aceita. Para recuperar jobs quando a página fecha/falha, use `supabase/setup/ai-cron.example.sql`: requer pg_cron, pg_net, segredo aleatório `NEO_AI_CRON_SECRET` de pelo menos 32 caracteres nos Secrets e o mesmo valor no Vault como `neo_ai_cron_secret`. A rotina processa até 3 jobs por execução, com até 2 tentativas por job, e não retoma mensagens com mais de 10 minutos. Não foi criada automaticamente. Fora dos horários definidos, mensagens ficam para a equipe; não são respondidas retroativamente no próximo turno.

## Verificação

Testes cobrem permissões e isolamento no PostgreSQL local, metadados sem chaves, autenticação das funções, criptografia e vínculo por integração, protocolos dos três serviços com transporte simulado, modos, rascunhos privados, envio idempotente, descarte de respostas antigas e horários. Não substituem login administrativo e teste real do modelo no projeto Supabase nem conferência visual nos aparelhos.

Referências: https://platform.openai.com/docs/api-reference/responses/create ; https://ai.google.dev/api/generate-content ; https://platform.claude.com/docs/en/api/messages/create ; https://supabase.com/docs/guides/functions/secrets
