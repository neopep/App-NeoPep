# NeoPep — pacote de campanhas 2026-11-26-01

Candidata a partir do marco oficial de 26/11/2026, branch fix/gps-cidade-estado-teste-20261125, base 7912b77705d302a7a65e4c4276b1d84e5f4bac3c. Não publicar, não mesclar, não executar envio nem migração remota sem nova autorização. Produção permanece intacta.

## Escopo
- Interruptor acessível nos cards das campanhas estruturadas App/WhatsApp; pausa das pendências, preservação de rascunhos, agendamentos e histórico. Campanha manual WhatsApp somente quando propriedade já verificada pelo servidor. Sem controle novo para legados não vinculados.
- Filtro de data em popover ao lado de Adicionar publicação, com limpeza e persistência por campanha.
- Cards de rascunhos locais isolados por conta, canal e campanha; descarte exclusivamente local e proteção da publicação bloqueada.
- Alertas de pendências compactos, acionáveis e diferenciados por gravidade; bloqueios do servidor permanecem explícitos.
- Fundos suaves distintos dos destaques e compatíveis com os dois temas.
- Prévia de PDF via bytes locais, com fallback explicativo sem ampliar CSP; preservação da validação de anexos.
- Preparação de arquivos e prévias autorizados da Biblioteca em rascunho, separada da autorização de envio. Arquivos sem download permitido continuam somente capa + link. Não alterar permissões individuais implicitamente.
- Cache da candidata atualizado.

## Contratos SQL candidatos (não aplicados)
1. campaign_pause_test_candidate.sql: pausa estruturada, auditoria privada, propriedade, serialização e verificação no worker.
2. campaign_pause_manual_test_candidate.sql: depende do primeiro; pausa manual com propriedade verificada, respeito a reservas ativas e estado na fila.

A reativação de campanha estruturada com mensagens pendentes vencidas exige revisão/reprogramação; nenhuma entrega aceita deve ser refeita. Pausa não revoga mensagens já iniciadas, nem confirmações externas. Os patches têm âncoras de definição e exigem preflight, ensaio da migração completa e homologação de concorrência. O teste descartável exercita os helpers centrais; não substitui teste dos RPCs/worker integrados.

## Envio de arquivos — pendência de habilitação
Leitura do controle confirmou originals_enabled=false nos dois ambientes, sem alteração de configuração. Uma verificação complementar do contrato remoto foi bloqueada pela ferramenta de segurança; não repetir por outro caminho para contornar. A candidata permite preparar anexos elegíveis sem enviar e explica o bloqueio. A liberação de envio efetivo depende de revisão autorizada do contrato, compatibilidade Connect, homologação e autorização de publicação. Download de material desautorizado permanece desautorizado; revisar GHK-Cu individualmente, se for a intenção do responsável.

## Validação
Rodar npm test e npm run check/build conforme workflow; testes adicionais em tests/campaign-ux-pause.test.cjs e library-share-modes.test.cjs. Conferir no iPhone os filtros, abertura dos rascunhos, prévia PDF, legibilidade, pausa/reativação e permissões; não realizar envio real neste pacote. Conferir em ambiente isolado a aplicação integral dos SQLs antes de ativar os controles. Não reexecutar migrações anteriores. Não alterar Mercado Pago, IA ou proteção de ambientes.
