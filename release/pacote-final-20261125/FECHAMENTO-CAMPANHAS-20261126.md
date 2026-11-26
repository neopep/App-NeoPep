# Continuação do fechamento — 26/11/2026

Candidata de referência: c28a517ec45414924a68101873b7abdf28078659. Migrações registradas no banco: 45.

## Aplicadas nesta rodada
- 20261126133144 campaign_app_series_production_20261126
- 20261126133248 campaign_wa_independent_review_production_20261126
- 20261126133308 campaign_manual_claim_production_20261126

As migrações compostas de séries foram executadas em uma transação. Revisão independente e reserva manual receberam lock_timeout de 5s, lock transacional nas respectivas tabelas e preflight que aborta se houver estados de despacho pendentes/em andamento/incertos. Scripts de cada ambiente preservados.

## Evidências
- Recorrência: chamada somente leitura com regra fictícia de 27–29/11, 09:00/17:00, limite 4, retornou 27/11 09:00, 27/11 17:00, 28/11 09:00, 28/11 17:00. Helpers privados sem EXECUTE para anon/authenticated.
- Revisão: guard campaign_wa_review_allows presente na RPC do dispositivo; sem EXECUTE para anon; fila ociosa antes da migração. Revisão continua restrita a texto e links. Não homologada com dois administradores reais.
- Reserva manual: tabela e rota verificadas, zero reservas criadas; 0 publicações pendentes preexistentes preservadas. O frontend ativo contém detecção claim_status e envio de token; atualizar tela antes de operar. Não houve preparo, confirmação, cancelamento ou compartilhamento real.
- Sem envio de mensagens ou push, sem alterações em Mercado Pago, IA ou prioridades adiadas.

## Bloqueios de publicação
- Diário online continua pendente; respeitar bloqueio anterior de ensaio SQL, não contornar. Ainda falta homologar isolamento, consentimento, concorrência e compatibilidade com clientes antigos.
- CI completa: consulta disponível (filtrada para runs de PR) não retornou execução nem status para o SHA de referência. Os workflows por push existem, mas precisam de verificação de resultado no GitHub Actions.
- Revisão de anexos privados e envio de PDF/MP4/push em dispositivos reais não homologados; manter gates atuais.
- Sem deploy Vercel nesta rodada. Publicação Produção → Teste apenas depois da validação integral.
