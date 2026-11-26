# NeoPep — pacote campanhas 01 — candidata Produção

Base documental 540be2f1565ea725f8ca6dda14682dc3e57ba501 (versão publicada 3769d2d50924ca8be9b2c260a729aba7514c3f20). Não publicar nem aplicar migrações antes de autorização e homologação. Teste possui implementação equivalente, com contrato de App próprio. Nenhuma alteração em Mercado Pago, IA, configurações de acesso ou gates de envio.

## Mudanças
- Portados seletivamente central, editor, fila WhatsApp, prévia PDF, CSS e cache. Mantidas as diferenças de Produção (destinos, identificação de publicação, regras de agendamento e gate).
- Testes de Connect passaram em 3520e7d4d6571b79acb4fbf4f076fb38d2085b2d, execução 45851113453; CI de campanhas passou 45851113490. Teste web anterior: 523 aprovados, 1 ignorado, zero falhas. Essas evidências não certificam os commits posteriores.
- Os scripts campaign_pause_production_candidate.sql e campaign_pause_manual_production_candidate.sql foram preparados; **não aplicados**. Conferidas âncoras de contrato via catálogo somente leitura. A produção tem campaign_app_official_batches e push; a elegibilidade do popup e push depende de campaign_matches. Pausa recusa lease ativo e reativação com resultado de push indefinido ainda elegível. Os testes em banco descartável exercitam helpers, não são homologação do worker real. Deve-se validar a aplicação integral do SQL, concorrência, rotina de push e o comportamento de dispositivos antes de liberar.
- Manter originals_enabled=false até homologação explícita, sem alterar permissões de download dos materiais. A verificação de contrato de envio que foi bloqueada anteriormente não deve ser contornada.
- A pausa não recolhe mensagens ou notificações já entregues. Não reenviar entregas aceitas. Reativação de WhatsApp com horário vencido exige revisão. Campanhas manuais exigem vínculo de propriedade verificado; legado não vinculado não apresenta controle.

## Ordem de fechamento
1. Confirmar CI das duas candidatas exatas e ensaio integral de Teste.
2. Confirmar migrações de Produção em banco descartável, incluindo push e rotas manuais. Nenhuma execução de envio real.
3. Homologar interface (PDF, filtro, rascunhos, avisos e cores) e conexões em dispositivo.
4. Confirmar tratamento da autorização de envio dos originais com os controles existentes.
5. Só com nova autorização: aplicar SQL em ordem Teste/Produção, validar sem disparar; deploy na ordem acordada Produção → Teste e confirmar aliases/cache. Não aplicar scripts de um ambiente no outro.

O marco de 26/11 continua sendo a versão publicada. Esta pasta representa o pacote 01 em preparação, não uma release final.
