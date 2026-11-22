# Paridade funcional da candidata

A issue #24 fixa a origem funcional no commit fa8429a. A candidata parte de f123749, retém o commit de identidade oficial e não inclui os heads dos PRs #22 e #23. O frontend vem de homologação com separação explícita de domínio e configuração. A execução do backend e os dados atuais dos serviços continuam sujeitos a auditoria autenticada.

| Módulo | Candidata no Git | Preservação e condição de ativação |
|---|---|---|
| Administração, públicos e coortes | Telas, cliente RPC, SQL de referência e testes | Verificar privilégios efetivos, opt-in e compatibilidade de RPCs. |
| Monitoramento e custos | Painel sobre RPCs; APIs externas de Teste em release/production/staging-api | Sem publicar APIs de Teste. GitHub, Vercel e geolocalização externa precisam de endpoints oficiais revisados. |
| Atendimento e multiagentes | Catálogo, runtime e Edge candidatas | Preservar jobs, contratos de suporte, agente padrão e credenciais. Nenhum deploy Edge ou ativação adicional neste lote de preparação. |
| Campanhas App | Editor homologado e contratos SQL | Ativação e exibição de campanhas fechadas na candidata oficial. Exigir gate de servidor e homologação. |
| Campanhas push e manual WhatsApp | Código da homologação anterior ao PR #22 | Não importar filas e campanhas. Preservar cron existente. Confirmar opt-in, bloqueio de envio automático e fluxo com confirmação humana. |
| NeoPep Connect | Interface, fontes, fixtures e Evidências de release | Canal Windows de Teste desabilitado na candidata oficial e sem binários em dist. Preparar schema em modo inerte. Exigir canal, assinador e homologação próprios. |
| PWA e registros pessoais | Identidade oficial, splash, fotos, peso, histórico, relatórios, manifest e shell | Preservar ID/escopo, rota legada e callbacks. Confirmar atualização em instalação existente e em dispositivos reais. |
| Biblioteca e comunidade | Materiais, acesso privado, moderação e suporte da homologação | Verificar RLS e autorização entre contas. A issue #21 segue no PR #23. |
| Loja e pagamentos | Melhorias web e integração de catálogo | Arquivos auth-settings, delete-account, mercadopago-webhook, mercadopago-create, shop-integrations e platform-integrations idênticos à main. Preservar deploys, webhooks, configurações e dados oficiais. |
| Segurança e infraestrutura | Validador de artefato, catálogo comparável e instruções de recuperação | Revisar ACL/RLS e divergências de rotinas. Capturar backups recuperáveis e comprovar restauração antes de autorizar mudanças. |

## Edge Functions

| Serviço | Tratamento |
|---|---|
| auth-settings, delete-account, mercadopago-create, mercadopago-webhook, shop-integrations | Manter deploys oficiais, credenciais e configuração de JWT. |
| platform-integrations | Preservar fonte oficial atual; conferir metadados implantados nos dois ambientes. |
| ai-reply, agent-integrations | Código candidato em Git. Comparar contratos, autenticação no handler, provider, CORS e compatibilidade com o agente legado antes de aprovar qualquer deploy. |
| push-dispatch | Código candidato em Git. Preservar o job pg_cron oficial ativo a cada minuto. Conferir rotina, filas, credencial e a configuração JWT antes de homologar a atualização. |
| connect-update, connect-release-draft | Manter fora de produção até canal próprio, permissões, chave e homologação Windows. O handler e a configuração de gateway de connect-release-draft foram arquivados em release/production/staging-edge, fora da raiz de deploy. A versão remota de connect-update deve ser auditada separadamente. |

A versão 20261122022149 foi localizada no commit 295e484. O conteúdo é referência para reconciliar o ledger em leitura, sem criar um segundo lançamento da mesma migração. Os IDs 20261122040259, 20261122044929 e 20261122151856 exigem reconciliação com o catálogo e o histórico remoto. As fixtures associadas confirmam contratos em isolamento e não demonstram identidade com os deploys remotos.

[Arquivos e commits](MATRIZ-TESTE-PRODUCAO-20261122.md) · [Catálogo de referência](INVENTARIO-SUPABASE-20261122.md) · [Go/No-go](GO-NOGO-PRODUCAO.md)
