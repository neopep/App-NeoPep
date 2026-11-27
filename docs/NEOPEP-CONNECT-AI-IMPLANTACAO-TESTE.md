# NeoPep Connect AI — primeira implantação privada de Teste

A configuração versionada em `integrations/campaign-mcp/wrangler.staging.jsonc` desativa o serviço e a leitura App por padrão. O domínio candidato do MCP é `connect-teste.neopep.com.br`. O consentimento abre exclusivamente em `teste.app.neopep.com.br/admin/`. O primeiro ensaio oferece consulta de campanhas WhatsApp. A leitura App é um ensaio separado após conferir os RPCs, incluindo recorrência. Nenhum destes passos foi executado remotamente neste lote.

## Recursos que precisam de autorização

| Recurso | Configuração para Teste |
|---|---|
| Supabase `qnuluspqfazdppciermw` | Conferir projeto, backup recuperável, funções e ACL de Campanhas. Revisar e aplicar em ordem `release/connect-ai/001-connections.candidate.sql`, `002-oauth-grants.candidate.sql`, `003-session-broker.candidate.sql`. Criar um login dedicado com herança exclusivamente do papel `neo_connect_ai_broker`. Validar os privilégios efetivos, inclusive os herdados de PUBLIC. |
| Cloudflare | Worker `neopep-connect-ai-teste`, Hyperdrive dedicado com credencial do login acima, cache de consultas desativado e binding `NEO_CONNECT_AI_DB`. Associar apenas o domínio Teste, com DNS e TLS válidos. Conferir plano, cotas e cobrança antes de provisionar. Desativar Workers.dev, URLs de preview e captura de corpos/cabeçalhos em logs. |
| Secrets do Worker | `NEO_CONNECT_AI_SIGNING_JWK` (privada ES256 P-256), `NEO_CONNECT_AI_CSRF_KEY` (32 bytes aleatórios em hex), `NEO_CONNECT_AI_SESSION_KEY` (outros 32 bytes, para AES-GCM). Gerar e armazenar fora do Git usando o gestor de secrets da conta, sem imprimir os valores. |
| Configuração do Worker | `NEO_CONNECT_AI_PUBLIC_JWK` (correspondente, sem `d`), `NEO_CONNECT_AI_KEY_ID`, `NEO_CONNECT_AI_CLIENTS` (JSON de IDs registrados e callbacks HTTPS exatos), `NEO_CONNECT_AI_SUPABASE_PUBLISHABLE_KEY` (chave pública do projeto Teste). |
| Frontend Teste | Integrar e publicar somente após autorização da revisão. O build de Teste ajusta a CSP para o domínio MCP e a política de referrer no painel. Já estar autenticado no NeoPep Teste antes de iniciar a autorização do cliente. |
| Cliente privado | Instalar somente o pacote Teste em uma conta elegível. Obter o ID e callback reais do cliente pelo fluxo oficialmente suportado, conferir titularidade e registrar o par. A versão atual não oferece registro dinâmico nem configuração de redirect de loopback. |

O broker é interno ao Worker. Ele grava a prova de consentimento como digest, usa AES-GCM com IV aleatório e vincula o criptograma ao ID da conexão e ao proprietário. Guarda apenas o token de acesso NeoPep até sua expiração. **Depois que esse token expira, iniciar um novo consentimento com uma sessão NeoPep válida.** A rotação dos tokens MCP exige sessão NeoPep vigente e usa a transação da migração 002. O desenho não transfere refresh tokens permanentes do NeoPep. Os registros expirados de sessões e provas são removidos durante novos consentimentos. Na homologação, avaliar janela de retenção para grants expirados e frequência de limpeza antes de ampliar acesso.

## Ensaio e diagnóstico

1. Verificar localmente build, testes do pacote, SQL e bundle do Worker. Após autorização, executar o SQL em Teste e verificar que `anon` e `authenticated` carecem de acesso às tabelas privadas. Conferir que o login do Hyperdrive não possa alterar contas, conexões diretamente ou tabelas de campanhas.
2. Instalar o Worker com `NEO_CONNECT_AI_ENABLED=0`. Confirmar que MCP sem credencial retorna 401 e que o OAuth fica indisponível. Conferir a configuração do frontend sem ativar o serviço.
3. Com autorização para o ensaio, definir `NEO_CONNECT_AI_ENABLED=1`. Validar descoberta OAuth, recurso e JWKS públicos. Registrar somente status, horário, revisão e cliente, sem cabeçalhos, parâmetros do callback ou dados vindos de campanhas.
4. No cliente escolhido, fazer login via botão explícito de consentimento e listar campanhas fictícias. Confirmar rejeição para conta comum, outro ambiente, callback divergente, código repetido e sessão expirada. Com duas conexões, revogar uma no painel e confirmar que só ela perde acesso.
5. Conferir que a lista de ferramentas exclui escrita, criação de mídia, operações em massa, agendamentos, despachos e envio. Ativar `NEO_CONNECT_AI_READ_APP=1` somente em ensaio autorizado de leitura App após confirmar o contrato nativo.

| Cliente | Ensaio privado e condição |
|---|---|
| ChatGPT Plus Desktop | Importar o catálogo local se a conta e versão oferecerem essa opção. Verificar se a instalação permite OAuth remoto com cliente pré-registrável e leitura MCP. [Catálogo local](https://developers.openai.com/plugins/build/plugins). |
| ChatGPT Plus Web e iPhone | Verificar separadamente a disponibilidade do conector e sua elegibilidade na mesma conta. A instalação Desktop por si só não estabelece suporte nas outras superfícies. |
| ChatGPT Sites | A criação do plugin hospedado requer publicação do Site pelo proprietário e instalação individual. Contas pessoais não podem convidar outros usuários ao plugin. Avaliar como ensaio individual: adaptar as chamadas ao MCP Cloudflare com OAuth de cada usuário, testar uso por chat no Web e iPhone e conferir que nenhuma operação dependa de um PC ligado. O ensaio para várias contas exige um caminho de instalação autorizado para cada uma. [Documentação OpenAI](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites). |
| Claude | Usar o fluxo de conector remoto personalizado em conta elegível. Conferir callback e teste separado em cada superfície. [Conectores MCP Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). |
| Gemini | Testar o aplicativo conectado personalizado quando a conta atender os requisitos oficiais de elegibilidade, dispositivo, idioma e região. Se indisponível, registrar o bloqueio. [Apps personalizados Gemini](https://support.google.com/gemini/answer/17209137). |
| Codex | Instalar o catálogo Teste ou configurar o MCP, em cliente oficialmente compatível. Confirmar OAuth e ferramentas, incluindo se o cliente permite callback HTTPS pré-registrado. |

Consultar [gate de clientes](NEOPEP-CONNECT-AI-GATE-PLUS-E-CLIENTES.md) e [instalação privada](NEOPEP-CONNECT-AI-INSTALACAO.md). Os resultados de clientes comerciais e do runtime Cloudflare devem ser preenchidos no ensaio autorizado.

## Reversão

1. Desativar o Worker com `NEO_CONNECT_AI_ENABLED=0` e remover o domínio Teste se necessário. Conferir a recusa de chamadas e revogar as conexões de ensaio pelo painel.
2. Desabilitar o login do broker e remover o binding Hyperdrive se houver incidente. Em caso de comprometimento de chave, invalidar o material e exigir novo consentimento após rotação. Preservar o histórico para auditoria.
3. Se preciso, voltar o frontend Teste para o deployment anterior verificado. Preservar tabelas de campanha e dados existentes. Qualquer remoção de tabelas, papéis ou registros deve ser revisada separadamente.

## Contratos nativos para a próxima etapa

| Etapa | Reuso e teste de aceite |
|---|---|
| Criativos | Reutilizar o upload autenticado de `src/cloud.js` ao bucket privado `neo-campaign-images` (JPEG até 1 MiB) e o fluxo nativo de PDF/MP4 até 5 MiB. Conferir tipo, proprietário e revisão no backend antes de anexar. Validar idempotência e rejeição de caminhos de outra conta. Adotar fallback por seleção manual no painel até o cliente comprovar transferência suportada. |
| Operações em massa | Preparar revisão por campanha e revisão do rascunho, com lista de itens elegíveis e recusados. Cada aplicação precisa de chave idempotente por item, revalidação da versão e resultado individual. Preservar criativos e destinatários em alterações de texto. |
| Agenda | Reusar a interpretação do horário local e a confirmação da revisão do RPC nativo. Separar simulação de ocorrências da ação que cria lotes. Validar fuso, hora inválida, revisão desatualizada e repetição. |
| Diagnóstico | Usar `initialize`, `ping` e uma leitura de fixture autenticada. Medir disponibilidade, duração e classe de erro separadamente para OAuth, Hyperdrive, RPC e MCP. Agregar métricas sem usuário, destinatários, caminhos de criativos, sessões ou conteúdo. |

## Base publicada e ordem de promoção

Produção é promovida e verificada primeiro. O Teste continua no mesmo ciclo após a verificação oficial e a autorização específica. Os projetos, bancos, callbacks e segredos são separados.

A reconciliação do frontend sobre o commit publicado `fe8ecb2fff8b9fb97eff8b0eb529db84a1f3b430` está em `release/connect-ai/frontend-teste-fe8ecb2.patch`. Antes de autorizar publicação, confirmar se essa ainda é a base ativa. Em checkout descartável dessa revisão, executar `git apply --check --binary CAMINHO_DO_PATCH`, aplicar o patch e rodar `npm run build`, `npm run check` e verificações focadas. O bundle `dist/cloud.js` deve ser reconstruído a partir do fonte reconciliado. O patch mantém os fluxos de Teste e aplica a CSP do MCP exclusivamente ao painel. O Worker e os SQL candidatos vêm da branch Connect AI.
