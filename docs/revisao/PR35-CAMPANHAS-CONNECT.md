# Homologação da Central de Campanhas e NeoPep Connect

## Auditoria

O head recebido `d6e465a` acumulava seis commits sobre a `main` em `1cadd8b`. As alterações anteriores estavam em `admin.js` e `admin-connect.js`. A quebra no literal de estilos impedia o painel inteiro de carregar. O Connect também inicializava duas navegações, movia seções depois de montar o DOM e mantinha a área de status em Ajuda. A página agora usa uma navegação de oito abas com controles por teclado, foco e painéis independentes. A Visão geral diferencia as conexões do WhatsApp e as contas fictícias da fila de simulação.

A Central preserva os parâmetros `admin`, `channel`, `campaignView`, `campaign` e `campaignTab`. O editor é um diálogo nativo dentro da página, ajustado ao viewport, com status visível, foco restaurado e confirmação de descarte. O cadastro guarda rascunho e o menu da lista conserva as ações de ativação, pausa, duplicação e arquivo. Anexos da divulgação manual continuam na publicação, com os MIME types, tamanhos e permissões de Biblioteca já verificados pelo backend.

## Contrato de destinatários

- `connect_wa_connections` e `connect_wa_selected_groups` descrevem a seleção sincronizada no Windows, com proprietário, computador, estado, horário da sincronização e contagem disponível de participantes. O rótulo da conexão permite identificá-la. O contrato não coleta número de WhatsApp.
- `campaign_wa_sync_targets` vincula proprietário, conexão e JID a uma referência de grupo para a fila manual já existente. A referência dura quando um grupo é removido da sincronização. `campaign_wa_recipients` guarda destinatários preferidos da campanha por titular. A RPC valida a conexão e grava a campanha e seus destinatários numa única transação.
- O agendamento manual usa `campaign_wa_publications` e mantém anexos, lembretes, confirmações, recorrência e histórico. As publicações sincronizadas são acessíveis apenas a seu titular. O banco rejeita seleção repetida por JID e publicação pendente com o mesmo JID, campanha e instante, inclusive quando escolhida por outra conexão. A migração preserva os grupos legados existentes. Registros legados sem JID não podem ser conciliados automaticamente com a sincronização.
- `connect_group_accounts` e `connect_tasks` servem às contas e tarefas fictícias. O banco impede associar um destinatário sincronizado a uma conta simulada. Este fluxo prepara a divulgação manual e não agenda envio real pelo Connect.

## Ordem do ensaio no Supabase de Teste

1. Confirmar o projeto `qnuluspqfazdppciermw`, as dependências de Campanhas e o [contrato de sincronização](../conhecimento/NEOPEP-CONNECT-CONTRATO-GRUPOS.md), além do ponto de recuperação e dos agregados das tabelas históricas. Rodar [pré-verificação somente leitura](20261123100000-campaign-sync-preflight.sql). A RPC nova deve estar ausente e os contratos anteriores devem estar presentes.
2. Conferir o corpo instalado de `neo_campaign_wa` com `20261121231451_campaign_whatsapp.sql`. A [migração incremental](20261123100000-campaign-sync-recipients.sql) está fora do diretório de aplicação automática porque depende do contrato de sincronização gerenciado separadamente. Rodar com parada em erro e acesso administrativo. O script exige o SHA-256 da implementação revisada da RPC legada e aborta se a definição instalada divergir. Em caso de falha, descartar a transação e investigar a divergência.
3. Repetir o pré-voo. Conferir grants, RLS, ausência de mudanças nos totais legados imediatamente após DDL e navegação com duas contas de administração, incluindo tentativa de acessar destinatário de outra conexão. Testar sincronização, reabertura, heartbeat desatualizado, horário, anexos autorizados, cancelamento e confirmação manual em ambiente controlado. Não disparar mensagens no ensaio.
4. Em falha operacional após commit, usar [suspensão da RPC nova](20261123100000-campaign-sync-suspend.sql) e voltar à versão web anterior quando necessário. Manter tabelas, histórico, escopo por titular e proteção da fila simulada. Depois de corrigir a causa, restaurar explicitamente o EXECUTE apenas para `authenticated`. Qualquer reversão estrutural exige avaliação dos registros criados desde a migração.

Produção depende da homologação integrada no Teste, da confirmação do catálogo oficial e de aprovação separada para banco e publicação web. O PR #25 tem trilha própria.

## Evidências locais

- `node --test tests/campaigns.test.cjs` valida seleção, reabertura, gravação atômica, conta alheia, duplicidade por JID, conexão desconectada, compatibilidade histórica e proteção da fila fictícia em PGlite.
- `node tests/campaign-admin-browser.cjs` usa Playwright/Chromium e RPCs simuladas da página para validar os dois canais, as oito abas, criação e edição, tentativa de fechar com alterações, escolha de grupo, agendamento manual e ausência de exceções JavaScript em 390×844 e 1440×900. O ensaio não cobre Safari em um iPhone físico.
- A tentativa de alcançar o Supabase de Teste encontrou HTTP 403 no túnel da rede deste workspace. O banco remoto e o pareamento de um Windows real ainda exigem ensaio integrado.

Build e check passaram. Os 32 testes focados de Campanhas, painel administrativo e Connect passaram. A suíte completa da candidata teve 347 aprovações e 55 falhas. A `main` em `1cadd8b` teve 346 aprovações e as mesmas 55 falhas por nome. A regressão adicional cobre o contrato SQL de destinatários sincronizados.
