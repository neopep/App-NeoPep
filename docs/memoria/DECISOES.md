# Decisões

| ID | Estado | Decisão e motivo | Fonte |
| --- | --- | --- | --- |
| D-001 | Histórico | Preservar o Elo e oferecer importação assistida com backup e confirmação para proteger registros legados. | [Auditoria](../AUDITORIA.md) |
| D-002 | Implementado | Consolidar NeoPeptídeos num único pacote e manter `/neo/` para compatibilidade de links, PKCE e instalações existentes. | [Consolidação](../CONSOLIDACAO.md) · [Empacotador](../../scripts/stage-preview.cjs) |
| D-003 | Implementado | Usar SDK oficial, dados isolados por conta, RLS e mídia privada para limitar acesso e manter o modelo multiusuário. | [Ativação](../ETAPA-2-ATIVACAO.md) |
| D-004 | Implementado | Reunir privilégios em uma função administrativa validada pelo servidor. | [Administradores](../ADMINISTRADORES.md) · [Migrações](../../supabase/migrations/) |
| D-005 | Implementado | Manter sugestão privada, entrega automática governada e atendimento humano como modos da mesma operação. | [Agente](../AGENTE-DE-ATENDIMENTO.md) |
| D-006 | Planejado | Reaproveitar web e Supabase em pacotes Capacitor com assets locais e integrações nativas de sessão, callbacks e notificações. | [Mobile](../../mobile/README.md) |
| D-007 | Implementado | Versionar uma central única. Os arquivos de entrada dos assistentes levam ao mesmo contexto, e relatórios anteriores permanecem íntegros. | [MEM-20261120-001](HISTORICO-DE-ALTERACOES.md#mem-20261120-001) |
| D-008 | Implementado | Conferir autoria e committer antes de cada commit e aplicar somente a identidade autorizada no checkout local. A associação remota exige verificação própria. | [MEM-20261120-003](HISTORICO-DE-ALTERACOES.md#mem-20261120-003) |
| D-009 | Implementado | Projetar o agente padrão sobre o singleton atual em tempo real. Separar cadastro e planejamento de ativação e processamento para manter compatibilidade e evitar dupla escrita. | [MEM-20261120-009](HISTORICO-DE-ALTERACOES.md#mem-20261120-009) |
| D-010 | Planejado | Separar as permissões de administradores da plataforma, moderadores da comunidade, operadores de atendimento e gestores de agentes. O ensaio atual preserva o contrato histórico confirmado pelo responsável. | [MEM-20261120-015](HISTORICO-DE-ALTERACOES.md#mem-20261120-015) |
