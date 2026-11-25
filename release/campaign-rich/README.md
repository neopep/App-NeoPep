# NeoPep TESTE — campanhas ricas WhatsApp

Implementação isolada no Supabase **Teste** e Connect Windows **0.2.12**. Não altera o endpoint, tabelas ou deploy de Produção.

## Capacidades preparadas

- Um único grupo permitido pela homologação `campaign_wa_test_config`.
- Até seis blocos ordenados: texto, imagem JPEG com legenda, link HTTPS público ou produto ativo e público.
- Imagens privadas armazenadas no bucket `neo-campaign-images` em `<owner UUID>/<block UUID>.jpg`, até 1 MiB no envio, com verificação de existência e metadados.
- Produto envia nome e preço registrados. Envia a foto JPEG se o arquivo original tiver até 1 MiB; caso contrário, apenas o texto do produto.
- Confirmação explícita no editor, hora local America/Sao_Paulo, idempotência por `request_id`, status por bloco e cancelamento de blocos ainda em espera.
- Envio sequencial; 3 segundos de intervalo após aceite e **sem reenvio automático** após incerteza. Aceito pelo WhatsApp não equivale a entrega/lido.
- A pipeline homologada de texto curto permanece independente e intacta.

## Gates de lançamento

1. Aplicar as três migrações `20261125042000`, `20261125042100` e `20261125042200` em Teste, mantendo `campaign_wa_rich_control.enabled=false`.
2. Conferir CI Web e Windows, publicar somente no projeto Vercel **app-neopep-staging**.
3. Gerar Connect Windows 0.2.12 no repositório privado, conferir SHA-256, manifesto RSA e assinatura; disponibilizar como atualização **opcional** no Supabase Teste.
4. Confirmar instalação e heartbeat da versão 0.2.12 no mesmo dispositivo, sessão WhatsApp conectada, grupo único sincronizado e worker opt-in ativo.
5. Ativar `campaign_wa_rich_control.enabled=true` só após os gates de segurança; não enviar durante migração/deploy.
6. Homologar manualmente uma sequência de dois blocos no grupo autorizado (texto e imagem), depois produto, link e agendamento. Verificar a mensagem fisicamente no WhatsApp e recibos no banco.
7. Se uma imagem falhar ou o resultado for incerto, **não repetir automaticamente**. Consultar estado, grupo e logs sanitizados antes de decidir por novo disparo com confirmação.

## Interrupção segura

Desabilitar `neo_private.campaign_wa_rich_control.enabled` e cancelar no editor os blocos não iniciados. Não apagar/reescrever recibos ou restaurar automaticamente leases incertas. A pipeline antiga de texto continua disponível. Nunca ligar a flag global de Produção para compensar falhas em Teste.
