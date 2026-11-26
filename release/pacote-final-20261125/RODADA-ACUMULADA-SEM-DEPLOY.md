# Rodada acumulada de ajustes — NeoPep Teste e Produção

**Data:** 25/11/2026  
**Decisão do responsável:** interromper novas tentativas de deploy na Vercel até concluir os ajustes acumulados. Preparar uma única rodada de publicação por ambiente quando houver cota, após aprovação do pacote; não acionar deploy automaticamente só por haver código novo.

## Situação e escopo aceito

- **Teste:** já contém o pacote final (PR #75) no deployment `caa7ddd`. O código do ramo `homologacao/ciclo-completo-2026-11-24` também recebeu as PRs #76 (frasco visual e capa extraída do vídeo), #79–#80 (criação de contas para testar onboarding e cache) e agora a paleta de contadores numéricos do tema claro. Esses incrementos **não devem ser declarados publicados ou validados visualmente no iPhone** antes do próximo deploy de Teste.
- **Produção:** o deployment no domínio oficial está no commit `e5bbb72`; o pacote posterior da PR #74 está integrado ao `main` (commit `d7f9ffd`), com migrações de banco já aplicadas, mas ainda não entregue no site. A paleta nova deverá ser promovida por mudança isolada ao `main` após homologação de Teste, sem merge indiscriminado de outros segredos, ambientes e funcionalidades experimentais.
- O usuário informou que a nova logo no aplicativo e a correção da cor do player foram aprovadas em Teste; links e prévias de PDF e vídeo já foram vistos, mas a capa automática de vídeo precisa revalidação.
- Não criar contas fictícias, desabilitar verificação de e-mail, disparar campanhas reais ou alterar Mercado Pago, Premium, Loja e IA neste ajuste visual.

## Nova correção aprovada para a próxima publicação

**Contadores com números no tema claro:** usar azul-marinho interno `#142743`, aro/borda `#223F63` e número branco `#FFFFFF`. Afeta a contagem da Comunidade, as abas de mensagens, os atendimentos não lidos, a Loja, as notificações do sino, a contagem na notificação que desce, e a bolinha de novos cadastros. O estado de notícia nova deve usar a mesma paleta. O tema escuro fica intocado. Selos promocionais, estados e alertas não são badges numéricos e ficam fora do ajuste.

## Pendências funcionais a acumular antes do release conjunto

- **Exclusão de campanhas antigas e publicações individuais:** issue #77. Não remover recibos ou auditoria.
- **Recorrência diária com vários horários:** issue #78. Exige controle de idempotência e backend, não só interface.
- **Anexo real PDF/MP4 no WhatsApp:** issue #70. O pacote atual envia capa JPEG e link, não os arquivos originais.
- **Cadastro de novos usuários e onboarding:** PRs #79–#80 permitem cadastro de teste no código; o envio real de confirmação por e-mail, retorno OAuth e sequência inicial precisam validação após deploy. Não abrir cadastro público na Produção.
- **Calculadora:** a PR #76 muda a posição do card, reusa SVG do frasco e carrega a última dosagem; validar em temas claro/escuro, inclusive saldo após aplicação vinculada.

## Checklist para publicar futuramente (dependente de nova autorização)

1. Encerrar o conjunto de ajustes, analisar diffs e rodar CI/testes sem usar Vercel.
2. Gerar **uma candidata de Teste** com branch/SHA corretos, sem envios automáticos. Confirmar que `teste.app.neopep.com.br` aponta para a candidata.
3. Validar no iPhone todos os indicadores numéricos em tema claro e escuro, cadastro de conta nova, frasco e campanhas sem envio real.
4. Levar a versão aprovada à Produção em um único lote próprio, sem transportar configuração ou credenciais de Teste. Verificar hash e alias `app.neopep.com.br`.
5. Preservar constraints e flags financeiras, filas e recibos; somente operar envios após verificação específica de destinos e autorização.

**Status:** escopo visual registrado e aprovado para incluir na rodada; deploys suspensos por decisão do usuário; validação end-to-end pendente.


## Auditoria complementar — contadores numéricos

Após a PR #81, foi feita varredura cruzada do CSS e das telas de Comunidade (incluindo Grupos e Conversas), Atendimento, Loja, notificações e Administração. Identificou-se **um item faltante:** `.nav-community-count`, bolinha com número no menu inferior da Comunidade. A classe foi adicionada à mesma regra de azul-marinho do tema claro, preservando posição, contagem, exibição e tema escuro.

| Local | Seletor identificado | Tratamento |
| --- | --- | --- |
| Comunidade, menu inferior | `.nav-community-count` | Correção complementar incluída |
| Comunidade, atalho/cabeçalho | `.community-badge`, `.has-news` | Já coberto |
| Comunidade → Grupos | `.tab-unread` | Já coberto |
| Comunidade → Conversas | `.tab-unread` | Já coberto |
| Aba selecionada de Grupos/Conversas | `.primary .tab-unread` | Já coberto |
| Atendimento, conversa não lida | `.support-thread-meta b` | Já coberto |
| Loja, menu inferior | `.nav-shop-count` | Já coberto |
| Sino de notificações | `.notification-count` | Já coberto |
| Notificação que desce na tela | `.notification-toast-main > b` | Já coberto |
| Novo cadastro (admin) | `.admin-signup-badge` | Já coberto |

Paleta: fundo `#142743`, aro/borda `#223F63`, número `#FFFFFF`, exclusivamente em `[data-theme=light]`. Não incluir `.status-pill` ou selos promocionais, que não são contadores de mensagens. Testes agora verificam tanto os seletores CSS quanto as classes presentes nas telas reais. **A correção está apenas no código; nenhuma publicação na Vercel ou em Produção foi efetuada.**

## Continuação — ajustes após bloqueio do GPS
- GPS cidade/estado: manter candidata atual, sem publicar enquanto o limite da Vercel estiver ativo.
- Ajuste 01: aviso de novo cadastro no Admin acompanha tema claro, preservando tema escuro.
- Ajuste 02: novo card Meu frasco no Diário de aplicações, antes do histórico. Adicionar frasco abre tela dedicada reaproveitando campos, SVG e resultado da calculadora. Salvar retorna ao diário. Um frasco ativo; saldo por registros efetivamente vinculados, histórico preservado, aviso ao esvaziar, novo cadastro obrigatório antes de novo registro. Edições mantêm vínculo original; exclusões recalculam saldo. Calculadora principal mantém apenas previsão e dosagens salvas.
- Limitação da candidata: frascos e vínculos continuam no armazenamento local, isolado por conta, como no recurso anterior. Não há sincronização entre aparelhos nem garantia de concorrência entre dispositivos; não apresentar como saldo físico confirmado. Planejar persistência transacional em nuvem antes de liberar o recurso como acompanhamento sincronizado.
- Testes focados do arquivo vial-cover-regression: seis casos conferidos em execução isolada. Suíte Node completa e validação no iPhone pendentes.
- Prioridades 2 e 3 da lista anterior: deliberadamente adiadas; fora do pacote atual.
- Deploy automático da branch GPS desativado. Nenhum deploy solicitado nesta rodada. Ordem de publicação mais recente solicitada pelo usuário: Produção e depois Teste, com candidatas específicas e preservação das configurações de cada ambiente; não publicar enquanto houver bloqueio ou sem nova instrução.
