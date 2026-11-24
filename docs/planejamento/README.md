# NeoPep — Centro de Planejamento e Execução
**Ciclo:** Ajustes #001–#013 + preservação #014  
**Atualização:** 24/11/2026 · **Situação:** planejamento revisto; nenhuma nova funcionalidade implementada por esta PR  
**Repositório:** neopep/App-NeoPep · **PR de documentação:** https://github.com/neopep/App-NeoPep/pull/40

## Por onde começar
Este é o ponto inicial para qualquer conversa, agente ou Codex que trabalhe na evolução aprovada do NeoPep. Primeiro leia [AGENTS.md](../../AGENTS.md), depois [INICIO-PARA-AGENTES.md](INICIO-PARA-AGENTES.md). Não confundir estas propostas com o estado do aplicativo publicado.

## Documentos oficiais deste ciclo
| Documento | Conteúdo |
|---|---|
| [Plano Mestre](PLANO-MESTRE-NEOPEP-2026-11-24.md) | Decisões funcionais aprovadas dos 13 pacotes; regras de preservação; ordem geral |
| [Melhorias #001–#009](ESPECIFICACAO-MELHORIAS-001-009.md) | Tela a tela, regras, dados, UX, falhas, testes e critérios de aceite |
| [Loja #010–#011](ESPECIFICACAO-LOJA-010-011.md) | Estoque, custos, snapshots, rentabilidade e gerenciamento em massa |
| [Assinaturas #012](ESPECIFICACAO-ASSINATURAS-012.md) | Planos, recursos, entitlements, cortesias, recorrência e futuro Apple/Google |
| [Campanhas #013](ESPECIFICACAO-CAMPANHAS-013.md) | Editor WhatsApp full-screen, status Connect, grupos, mídias, conteúdo Loja/Biblioteca/Comunidade, esteira e cross-post |
| [Governança #014](GOVERNANCA-014.md) | Não regressão, evidência, release gates, segurança e atualizações por agente |
| [Levantamento Técnico](LEVANTAMENTO-TECNICO-2026-11-24.md) | Inventário do código e riscos frente a Teste e Produção |
| [Auditoria da Revisão V2](AUDITORIA-REVISAO-2026-11-24.md) | O que foi corrigido da V1, evidências e limites da verificação |
| [Controle de Execução](CONTROLE-DE-EXECUCAO.md) | Evidência técnica e resultado por subetapa, append-only |
| [Quadro de prioridades](QUADRO-DE-PRIORIDADES.md) | Foco escolhido pelo proprietário, ordem dinâmica e aceite separado da publicação |
| [Protocolo de prioridades/aceite/publicação](PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO.md) | Como executar em qualquer ordem, aprovar e publicar isolado ou em lote |
| [Marco Zero](MARCO-ZERO-2026-11-24.md) | Sha e deploys de partida de Teste e Produção, sem reabrir todo o legado |
| [Registro de publicações](REGISTRO-DE-PUBLICACOES.md) | Releases seletivos, mudanças em produção, rollback e novos marcos |
| [Início para Agentes](INICIO-PARA-AGENTES.md) | Checklist de handoff e retomada segura |

## Regra do proprietário (prioridade máxima)
O responsável poderá escolher qualquer ID/sub-ID para desenvolver agora; a ordem do backlog é **alterável**. Somente a confirmação dele marca um ajuste funcional como **aprovado/concluído**. A publicação é decisão independente: pode sair isolada, aguardar ou ser agrupada a outras etapas aprovadas. Todo o processo atualiza este GitHub com evidências e preserva a linha de base. Ler [protocolo de prioridade/aceite/publicação](PROTOCOLO-DE-PRIORIDADES-ACEITE-E-PUBLICACAO.md).

## Como retomar em outra conversa
Pedido recomendado: «No repositório neopep/App-NeoPep, abra a PR #40 e leia docs/planejamento/README.md, QUADRO-DE-PRIORIDADES.md, MARCO-ZERO-2026-11-24.md e CONTROLE-DE-EXECUCAO.md. Quero fazer o ID/sub-ID que eu escolher agora, mesmo fora da ordem sugerida. Preserve o legado, revise só o delta e contratos afetados, atualize o GitHub e aguarde minha decisão de aceite/publicação. Não faça merge nem deploy de itens não autorizados.»

## Ordem de execução sugerida — pode ser substituída pelo proprietário a qualquer momento
0. #014: baseline de Git, Supabase, Vercel, Windows, histórico de decisões e PR #37; fechar o que está implementado e não publicado.
1. Melhorias de menor risco: #007, #006, #005, #001, #002.
2. Biblioteca/seringa/tema: #008, #009, #003.
3. Loja: #010 antes de #011.
4. Campanhas e Connect: #013 subdividido, com gates para envio real.
5. Assinaturas e Alimentação: #012 infraestrutura/planos/recorrência e #004 sem IA; ordem fina depende dos entitlements.
6. Validação geral e publicação controlada por ambiente/ID.

## Decisão importante de segurança
Sem autorização específica, não alterar checkout/webhook Mercado Pago da Loja, não ligar envio WhatsApp automático, não fazer merge PR #37, não mudar variáveis/segredos, não aplicar migrações em Produção, não disparar campanhas reais e não prometer plano Premium ativo. A PR #40 contém documentação, não código funcional.
