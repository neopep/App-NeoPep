# Biblioteca, administração e atendimento com IA

> Atualização: a nova configuração do agente e múltiplas integrações está em [AGENTE-DE-ATENDIMENTO.md](AGENTE-DE-ATENDIMENTO.md). As seções de IA abaixo documentam o fluxo anterior, mantido por compatibilidade até a ativação da nova estrutura.

## Implementado na interface
- Cabeçalho da Comunidade alinhado em uma linha, com espaço adicional após a área segura, seta e menu no mesmo eixo.
- Biblioteca: até seis anexos de foto, PDF ou TXT por material, máximo 10 MB cada. Fotos usam a sanitização existente para JPEG. Visualização e download usam URLs assinadas de 60 segundos em bucket privado. Pré-carregamento é limitado e links são reutilizados em memória por 40 segundos; anexos restantes carregam por ação do leitor.
- Administração: abas Visão geral e Configurações. Indicadores preservados. Configurações gerais de contato/URL de referência/aprovação do Grupo, modelo/instruções/limite e ativação da IA, estado das integrações e condições de entrega da loja.
- Chaves de API/pagamento NÃO são colocadas em inputs, localStorage ou config.js. Os formulários persistem somente configuração não secreta em tabela privada, com autorização administrativa no servidor.
- Gestos: puxar no topo para atualizar dados, respeitando campos, diálogos e rolagem; voltar pela borda nos navegadores compatíveis. No iPhone usa navegação nativa do Safari com histórico das rotas. Não confundir atualização de dados com ativação automática de um service worker pendente. Safari/iPhone real ainda precisa de QA.

## 1. Ativar a estrutura no Supabase
Executar `supabase/setup/platform-media-ai.sql` inteiro, até `commit;`, no SQL Editor. É uma transação com migrações 019/020/021: inclui os destaques anteriores da Biblioteca para não depender de sua instalação manual. A galeria da loja (018) é independente e continua com seu próprio arquivo.

A execução não exclui registros de saúde, pedidos ou materiais. Acrescenta `neo-library` privado, metadados de anexos, configurações sem segredos, consentimentos específicos e fila privada da IA. RLS e privilégios são definidos. A IA começa DESATIVADA; reexecução preserva configurações existentes, inclusive uma ativação já autorizada anteriormente. Não tomar ausência de erro SQL como prova de integração externa funcionando.

Depois, atualizar a aba Biblioteca/Administração. Sem esse SQL, a interface informa a ativação pendente, mantém os fluxos anteriores e não anuncia anexos/configurações remotas como concluídos. Materiais excluídos perdem o vínculo dos anexos; arquivos órfãos de uploads/materiais não são apagados fisicamente por essa atualização, e links assinados já emitidos podem durar até expirar. Planejar limpeza/backup de Storage separadamente.

## 2. Publicar as funções
Em computador autorizado, usando Supabase CLI conectado ao projeto:

```sh
supabase functions deploy platform-integrations --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
supabase functions deploy ai-reply --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
```

Alternativa sem CLI: no Supabase → Edge Functions → Deploy a new function → editor, criar os nomes exatos `platform-integrations` e `ai-reply` com os arquivos autocontidos preparados por `node scripts/package-edge-functions.cjs`. Desativar a verificação JWT do gateway dessas duas funções para permitir a autenticação própria descrita abaixo; não remover a verificação no código.

As duas funções verificam a sessão explicitamente via Auth. A função de IA também aceita a credencial exclusiva da rotina de recuperação. `--no-verify-jwt` permite essa autenticação própria e o cron; não aplicar a outras funções por analogia. Não há execução local de deploy sem credenciais do responsável.

No Supabase → Edge Functions → Secrets, configurar diretamente:
- `OPENAI_API_KEY`: chave de uma conta API com faturamento/cota disponíveis. Nunca enviá-la no chat. A integração não usa a assinatura ChatGPT como credencial de API.
- `ALLOWED_ORIGINS`: `https://elo-minha-evolucao.supplemast3.chatgpt.site`. Para mais de uma origem verificada, separar por vírgulas; sem caminhos e sem wildcard.
- `NEO_AI_CRON_SECRET`: segredo aleatório de pelo menos 32 caracteres, se for usar a recuperação por agendamento.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: somente ambiente do servidor; conferir os valores disponibilizados pela plataforma.

O endpoint `platform-integrations` exige administrador real. A leitura só informa presença das chaves, nunca seus valores. “Chave presente” não significa validação de faturamento, modelo, entrega ou webhook.

## 3. Configurar e testar a IA
1. Administração → Configurações → IA e API. Escolher OpenAI, informar um modelo realmente disponível na conta e salvar com a IA desligada.
2. Configurar o segredo no servidor e publicar as funções.
3. Usar Conferir configuração do servidor. Depois, Testar conexão com IA: envia apenas uma mensagem sintética e consome uma requisição de API, sem conversas reais.
4. Só após sucesso o banco registra o modelo validado e permite ativar respostas automáticas. Alterar provedor/modelo invalida a validação. Outro provedor pode ser preparado no formulário, mas exige implementar seu adaptador antes da ativação; não há promessa de suporte já funcional.
5. Fazer teste com conta descartável e atendimento sem administrador atribuído. O participante escolhe Autorizar atendimento com IA, com informação de que textos posteriores são enviados à OpenAI. O consentimento fica registrado separadamente, versão `2026-11-ai-v1`, e é incluído na exportação das conversas do próprio usuário.
6. Testar pergunta operacional, resposta identificada, desativação pelo participante e um administrador assumindo durante uma geração. O resultado atrasado deve ser descartado.

O fluxo envia no máximo 12 textos posteriores à autorização, cada um limitado a 1000 caracteres. Não busca peso, medidas, histórico de saúde, fotografias, áudios, arquivos ou pedidos no banco para formar contexto. Não possui ferramentas de cobrança, alteração de registros ou prescrição. Regras fixas limitam o agente ao suporte operacional; filtros conservadores encaminham temas clínicos e doses à equipe. Isso não é um sistema de diagnóstico nem garantia de que um modelo nunca erre. Avaliar as respostas reais antes de ativar para usuários.

Usa Responses API com `store:false`, que não deve ser confundido com garantia de retenção zero em todos os sistemas do provedor. Revisar contrato, políticas de dados e operação de suporte. Desativar a IA impede novos envios, mas não desfaz processamento já iniciado no provedor.

## 4. Respostas e recuperação
Mensagens novas de participantes autorizados geram jobs idempotentes. O cliente chama `ai-reply` automaticamente após o envio aceito. O endpoint usa o usuário validado, não um user_id do corpo. Jobs/respostas são protegidos no servidor por thread, consentimento, sequência e posse do atendimento. Um administrador que assumir cancela a IA; uma resposta que terminar depois não é publicada.

O limite diário conta tentativas, inclusive retentativas (até duas por job), não somente respostas bem-sucedidas. O valor inicial é 50 e o máximo configurável 500. Limites são por dia do servidor e não representam teto monetário garantido. Configure também limites e alertas na conta API.

Para recuperar pedidos quando o cliente fecha a página/falha, usar uma rotina HTTP protegida por segredo, com exemplo em `supabase/setup/ai-cron.example.sql`. É OPCIONAL e não faz parte do instalador. Configurar Vault/pg_cron/pg_net e publicar a função antes de agendar. O exemplo processa até três jobs por execução. Nenhum agendamento foi criado pelo agente. Jobs antigos, sem consentimento ou assumidos por humanos não geram respostas.

Endpoint de cliente: `https://cpslafpzjtbpmoxxysaa.supabase.co/functions/v1/ai-reply`, POST com sessão Bearer do próprio usuário e JSON `{ "message_id": "UUID-da-mensagem" }`. Não enviar texto, chaves de provedor nem service_role nesse corpo. Não é uma API pública sem autenticação para enviar mensagens arbitrárias a qualquer usuário.

## 5. Pagamentos
O painel centraliza condições de entrega e informa o estado da loja. Mercado Pago mantém as funções verificadas por assinatura/API já preparadas. Chaves `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID`, `MP_WEBHOOK_SECRET`, `MP_MODE` e `SHOP_APP_URL` continuam no servidor. Nenhum controle do painel permite marcar um pedido como pago ou ativar produção sem homologação.

Conferir o guia LOJA-E-MERCADO-PAGO.md e testar Checkout Pro completo com contas de teste e webhook. Presença de chave não confirma uma compra. O provedor IA não recebe dados de cartão, pedidos ou permissões para cobrar.

## Estado de validação
Testes automatizados locais cobrem SQL, permissões, uploads, UI, gestos, consentimento, resposta descartada após atendimento humano, idempotência, endpoints e requisições com transporte simulado. Não foram feitos deploy de Edge Functions, configuração de segredos, criação de contas externas, cobranças reais ou testes com OpenAI/Mercado Pago reais pelo agente. Esses passos ficam pendentes de intervenção do responsável.

Referências oficiais: https://platform.openai.com/docs/api-reference/responses/create ; https://platform.openai.com/docs/guides/your-data ; https://supabase.com/docs/guides/functions/secrets
