# Troca automática WhatsApp — Produção — 26/11/2026

Instalada e verificada a migração 20261126203649 campaign_wa_auto_rebind_production_20261126, blob 3fadb9c583b1cfc66cc4727e428cfb5666adf078. CI https://github.com/neopep/App-NeoPep/actions/runs/45892055659: 541 web + 11 Connect aprovados, zero falhas, um ignorado na suíte web. O ensaio sintético de revogação, propriedade, dispositivo, presença, grupo e fila passou. Teste recebeu a migração primeiro como validação de backend; não houve deploy web ou Windows.

A RPC de heartbeat chama o helper privado; permissões diretas anon/authenticated negativas, heartbeat anônimo bloqueado; advisor sem alerta específico do novo helper. Conexão atual conectada, online, dois grupos sincronizados, zero mensagens pendentes. Envio e agendamento continuam habilitados.

Nenhuma mensagem enviada ou transferida entre conexões, nenhum grupo ou agendamento alterado. Mantidos Mercado Pago, IA, permissões de Biblioteca, configurações de envio e ambientes separados. A troca real seguinte ainda é a homologação final: desconectar explicitamente o WhatsApp antigo, conectar e sincronizar o novo no mesmo dispositivo autorizado. Bloqueia troca automática enquanto existirem envios ou reservas não resolvidos, com múltiplas conexões ativas ou sem grupo elegível; não altera o grupo fixo de Teste. Não requer reiniciar o Connect nem publicar a aplicação.
