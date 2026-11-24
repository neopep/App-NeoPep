# Auditoria da documentação PR #40 — Revisão crítica V2
Data: 24/11/2026 | Tipo: revisão de qualidade da documentação, auditoria de código e metadados de infraestrutura em leitura | Escopo: sem mudanças funcionais.

## 1. Por que foi necessário refazer
A documentação V1 reunia decisões corretamente em linhas gerais, mas permanecia curta para orientar outro agente em etapas longas. Ao revisá-la, foram detectadas ambiguidades de status, ausência de modelos e fluxos detalhados, referências a funções existentes sem prova de funcionamento em Produção, sequência de release muito genérica e risco de o Codex reconstruir módulos já feitos.

## 2. Correções efetuadas e motivo
| Achado V1 | Correção na V2 |
|---|---|
| Título dizia 13 ajustes, usuário citou 13/14 | Manter 13 pacotes funcionais e nomear #014 claramente como governança e preservação, não novo recurso de usuário final |
| Projeto parecia ainda sem controle de tema | Confirmar light/dark/system já codificados em src/app.js; #003 é refinamento visual, posição do switch e padrão do sistema |
| #001 poderia duplicar permissão já existente | Confirmar permissões iniciais e requestDeviceLocation no código; especificar delta de UX em cima do que existe |
| #002 misturava personalização com analytics/push | Distinguir opções atuais statistics/usage/campaigns/location da finalidade adicional proposta, consentimento e revogação |
| #006 propunha thumbnail sem citar mecanismo atual | Identificar cover() em dist/library.js com canvas e fallback PDF; exigir reprodução antes de trocar pipeline |
| #007 sem confirmação do texto atual | Confirmar literalmente Escolhas para sua jornada. em dist/shop.js:home(); alteração limitada à apresentação |
| #010/011 tinham risco de segundo estoque | Confirmar por metadata de banco Teste/Produção neo_private.shop_products.stock (integer) e price_cents; detalhar concorrência, custos, snapshots, fórmulas, prévia e transação |
| #012 podia confundir segmentação com plano pago | Confirmar campaign_plans é vínculo de público de campanha, não assinatura; separar finance subscription / grants / entitlements / quota |
| #013 não explicitava limitação da implementação | Documentar status manual, 30 grupos no seletor atual, estados eligible/stale/disconnected/unavailable, Windows 0.2.6 com lembrete; desenhar capabilities e estados reais sem inventar envio |
| Cross-post muito genérico | Especificar App→WhatsApp e WhatsApp→App, formato por canal, independência de agenda/público/estado, link entre versões e consentimento push |
| Sem subetapas | Criar decomposição operacional numerada e critérios de aceite por módulo |
| Tracker não permitia retomar entregas parciais | Acrescentar controle de subetapas, evidências por ambiente, estados e protocolo de atualização |
| Sem indexação transversal | Adicionar README de planejamento e referência em AGENTS.md na branch documental |
| «Não houve deploy» era incompleto | Constatado que commits documentais acionam previews Vercel; distinguir preview builds de publicação em domínio de produção e criar risco/mitigação |
| Evidência GitHub não era suficiente para ambiente | Consultar metadata real de Supabase e Vercel; ainda falta teste de funções, Windows, pagamentos e aliases de domínio |

## 3. Evidências verificadas nesta revisão
### GitHub
Repo neopep/App-NeoPep e arquivos reais da main consultados: AGENTS.md; src/app.js; dist/admin/admin-connect.js; dist/admin/admin-whatsapp.js; dist/admin/whatsapp-navigation.js; dist/shop.js; dist/library.js; docs/conhecimento/CAMPANHAS.md; CAMPANHAS-NAVEGACAO-V2.md; NEOPEP-CONNECT-CAMPANHAS-026.md; docs/revisao/PR36-PRESERVACAO-E-LIBERACAO.md e GO-NOGO-PRODUCAO.md. PR #25 e #36 merged; #35 e #37 open/draft; #40 rascunho de documentação. Não foi efetuada inspeção linha a linha de todos os 777 itens da árvore; «levantamento» é intencionalmente parcial e direcionado.
### Banco (somente leitura)
Conector Supabase confirmou Teste e Produção ACTIVE_HEALTHY. Listagens do ledger revelaram 22 versões no Teste e 15 na Produção com nomes/IDs diferentes. Consulta information_schema confirmou neo_private.shop_products.stock, price_cents, e tabelas de campanha e Connect em ambos; não se consultou pedidos, dados pessoais ou conteúdos de mensagens.
### Deploys (somente leitura)
Vercel app-neopep production READY SHA fc0ae22 em 24/11 09:37 UTC. Vercel app-neopep-staging, target production **do projeto Teste**, READY SHA 0970ae6 em 24/11 01:15 UTC. Não confirmar DNS/alias, funcionalidade ou saúde do webhook só com READY.
A branch documental disparou previews nos dois projetos, em geral cancelados, ao menos um READY. Isto não equivale a uma mudança do domínio oficial, mas pode usar cota de build e aumenta a necessidade de consolidar commits documentais.
### WhatsApp Connect
Código web consulta grupo sincronizado, até 30 alvos distintos e elegíveis no seletor atual, mas painel mostra publicação confirmada manualmente. Documentação Windows 0.2.6 registra confirmação humana e lembrete local, não despacho agendado automático. A sessão Windows/WhatsApp real continua sem inspeção.

## 4. Matriz de confiança e alcance
- **Alta, com alcance limitado:** arquivos e textos de UI inspecionados no SHA Git main; tabelas/colunas retornadas por metadata; SHA/estado de deploy retornados pela Vercel.
- **Média/histórica:** documentação PR36 e Connect 0.2.6, testes automatizados declarados por PR, diferenças de branches relatadas no PR #37.
- **Não verificado:** fluxo de pagamento real, baixa de estoque transacional, autenticação e RLS das RPCs com contas distintas, agendamento automático no Windows, entrega no WhatsApp, funcionamento do tema claro no iPhone, miniatura PDF no aparelho, apontamento de DNS/alias, migracões logicamente equivalentes.
- **Proposto:** nomes de novas tabelas de plano/nutrição/campanha, estados futuros de envio, políticas de quota e estoque, mitigação do custo de builds de documentação.

## 5. Verificações ainda obrigatórias
1. Confirmar branch e commit realmente servidos nos domínios oficiais e no PWA instalado.
2. Reconciliar a PR #37 sem perder arquivos exclusivos de main/staging, nem aplicar staging config em produção.
3. Comparar schemas e contratos dos dois Supabase além de nomes do ledger; revisar RLS, grants e Edge sem mutação.
4. Testar fluxos reais em Teste com usuários fictícios e dispositivos, incluindo persistência, mídia e permissoes.
5. Inspecionar a instalação Windows, versão, heartbeat, conta pareada e WhatsApp elegível com consentimento; não usar grupo pessoal em ensaios.
6. Validar o que existe em Premium, catálogo de recursos e quotas para reusar antes de propor migrations de assinaturas.
7. Reproduzir problema exato do PDF e validar visual/iOS.
8. Registrar critérios de aprovação por lote e confirmação expressa antes de release, envio real, migração destrutiva ou pagamento.
9. Definir estratégia de reduzir previews gerados por mudança exclusivamente documental, preservando CI e builds legítimos.
10. Verificar compliance/licenças e consentimento para divulgar produtos/conteúdo comunitário para grupos externos.

## 6. Resultado da revisão
A documentação está mais operacional e rastreável, mas a engenharia não está pronta para ser considerada homologada. Status dos 13 ajustes funcionais permanece PLANEJADO (sujeito à descoberta de partes já existentes); status do #014 é AUDITANDO, agora com evidências remotas parciais. Não marcar como Implementado/Concluído por ter produzido especificação, nem lançar em Produção por existir READY.

## 7. Registro de segurança
Não foram realizadas migrations, DDL/DML, deploy, merge, modificações de credenciais, operações Mercado Pago, envios WhatsApp, nem leituras de dados privados de usuários. Apenas leitura de arquivos, metadados e criação de documentos em branch não-main.
