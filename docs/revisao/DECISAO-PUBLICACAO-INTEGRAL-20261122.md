# Decisão de publicação integral NeoPep — 22/11/2026

## Autorização e alcance

O proprietário solicitou **publicação automática e integral das melhorias homologadas no Teste**, incluindo campanhas, IA/multiagentes e integração web Connect, **sem reconstruir o aplicativo**. Ele explicitamente aceita continuar verificando aspectos das novas capacidades diretamente na Produção. Essa autorização é para o **único ambiente NeoPep oficial**: o ambiente de Teste permanece separado; não são autorizadas cópias de dados, credenciais, pedidos, sessões ou conteúdo de Teste para Produção.

O proprietário afirmou que as funções de pagamentos, Auth e notificações **já funcionavam na Produção original** e não foram homologadas novamente no Teste por serem pré-existentes. Assim, deve-se **preservar esses contratos oficiais**, não importar versões de Teste nesses módulos. O novo runtime de IA foi construído com fallback nas funções oficiais de atendimento padrão.

**A execução não equivale à verificação das 12 evidências externas do release-check.** A configuração `cloudValidated=false` e os itens de readiness **permanecem pendentes**, sem falsificar status. A aceitação de risco pela pessoa responsável fica explícita; testes pendentes devem ocorrer após publicação com rollback rápido da camada web.

## Supabase Produção — mudanças já aplicadas

Project ref: `cpslafpzjtbpmoxxysaa`. Banco de Teste: `qnuluspqfazdppciermw`.

Dez migrações **próprias de Produção**, já registradas no ledger; **não reaplicar**:
1. `20261122230935` — avisos de cadastros.
2. `20261122230954` — audiência.
3. `20261122231007` — engajamento.
4. `20261122231047` — multiagentes fundação.
5. `20261122231117` — métricas, custos e operações.
6. `20261122231143` — campanhas App, push e WhatsApp.
7. `20261122231242` — Connect, atualizações e grupos.
8. `20261122232405` — runtime multiagentes com funções anteriores encapsuladas e `neo_agent` original preservado.
9. `20261122232514` — remoção das travas temporárias, autorizações de campanhas/Connect, canal Connect despausado.
10. `20261122232914` — restaurado `EXECUTE` de `service_role` sobre o wrapper oficial `neo_support`.

Verificação agregada depois dessas mudanças: **190 funções**, 90 tabelas (`public` + `neo_private`), 9 buckets privados, **8 usuários Auth**, **18 pedidos**, **34 arquivos Storage** e **17 jobs IA** em contagem. O cron `neo-push-dispatch` está **active=true** a cada minuto. **Nenhum agente adicional nem campanha ativa foi criado**, e ainda não há tarefas no Connect. Ativação da capacidade não dispara automaticamente campanhas sem dados/consentimentos. Nenhum dado do Teste foi importado.

### Edge oficiais

- `push-dispatch` passou de v3 para **v4** (adicionada fila `neo_campaign_push_claim/finish`; demais filas e autenticação por segredo originais mantidas). Backup para rollback do código v3 em `release/production/rollback/push-dispatch-v3.ts`.
- `agent-integrations` passou de v8 para **v9** (adicionada ação `preview_agent` e confirmação `neo_multiagent_tested`; autenticação e rotinas antigas mantidas). Backup para rollback do código v8 em `release/production/rollback/agent-integrations-v8.ts`.
- **Preservados sem reimplantação**: `mercadopago-create` v16, `mercadopago-webhook` v11, `shop-integrations` v9, `auth-settings` v12, `delete-account` v8, `ai-reply` v9, `platform-integrations` v7.

## Código web

O PR #25 inclui os módulos de Teste, os PRs #22/#23, leitores PDF e melhorias visuais. A configuração compilável `dist/config.js` usa **exclusivamente Supabase oficial** e tem cadastro público `publicRegistration=true`, `campaignActivationEnabled=true`, `connectEnabled=true`. `src/cloud.js` preserva o endpoint de importação de release exclusivo do Teste e separa a disponibilidade das funções comuns de Connect. A branch `staging/permanente` e o projeto `app-neopep-staging` não serão mesclados/destruídos.

O Vercel `app-neopep` gerou PREVIEW `success` do PR. O job técnico `Candidata sem deploy` do GitHub também passou; o job independente `Gate de evidencias` continua falhando por falta de comprovação externa. **Para publicar pela primeira e única vez no Production Vercel, mesclar o PR #25 em `main` após conferir SHA e condição da branch**. Não chamar o preview de Produção.

## Rollback e verificações em Produção

- Guardar SHA antigo de `main` **`f1237493ecaeef4b99e5679ea31685cfdde3b792`**; se houver regressão de frontend, promover deployment anterior ou reverter somente o merge, **sem fazer replay nem drop das novas tabelas** (usuários poderão criar dados novos).
- Conferir URL HTTPS do domínio oficial e HEAD da publicação; login de usuário existente, signup de teste descartável, SMTP/OTP, CAPTCHA, consentimentos, duas contas isoladas, fotos, painel administrativo, Biblioteca e PWA.
- Verificar checkout com processo controlado/sem pagamento real indevido, retorno e webhook, sem implantar alterações financeiras opcionais.
- Conferir o fluxo antigo de notificações e a fila opcional de campanha; testar consentimento explícito antes de qualquer campanha real.
- Verificar o agente padrão antigo com configuração existente e testar um agente novo com atendimento/consentimento em conta controlada. Não criar agente ativo por conta própria.
- Verificar o Connect novo: interface e RPCs de Produção devem estar disponíveis, mas o **cliente Windows com Teste e Produção simultâneos ainda precisa da atualização feita pelo Codex**, descrita em `docs/revisao/CODEX-NEOPEP-CONNECT-DOIS-AMBIENTES.md`. Sem cliente novo, servidor habilitado não prova operação do Windows.
- O backup e Storage foram exportados anteriormente, porém restauração integral real **não foi ensaiada**. Avisos do advisor de segurança e limitações operacionais continuam existindo; não descrever como corrigidos por este lançamento.

**Não marcar como validados requisitos que dependem de verificação externa. Registre cada teste após publicação com resultado efetivo.**
