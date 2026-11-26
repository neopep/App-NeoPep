# Fechamento de publicação — 26/11/2026

- Candidata verificada: 18882ab6f8b601f596d5290741a93b684b8a6e6b. Mantida a branch existente e o autodeploy desabilitado.
- Acrescentado tests/legacy-photo-delete.test.cjs: quatro cenários por ambiente passaram em harness isolado com Storage simulado (404, isolamento de conta, autorização negada e troca de conta). Não equivale à CI completa nem à homologação em aparelho.
- Migração campaign_official_shared_queue_20261126 aplicada e verificada no catálogo: central com ação shared_queue, helper privado SECURITY INVOKER sem EXECUTE para anon/authenticated; central sem EXECUTE para anon. Nenhum envio, alteração de gate ou registro de campanha criado. Não reaplicar.
- Catálogo antes da rodada confirmou ausência das tabelas/funções do diário online, reservas manuais, séries App e revisão independente. Scripts candidatos não equivalem a migração aplicada.
- Teste: não localizada neo_private.campaign_app_central(text,jsonb); reconciliar a dependência antes de aplicar séries App. Produção possui a função. Não aplicar patch de Produção em Teste.
- Diário online: documentação anterior registra ensaio bloqueado e relato de rollback posterior sem logs recuperados; não contornar bloqueios. Validar compatibilidade dos clientes antigos e consentimento/isolamento antes de ativar o contrato.
- Reservas e revisão de campanhas dependem de verificação das definições, compatibilidade do frontend ativo, testes integrados e manutenção dos gates de envio. Não ativar anexos originais automaticamente.
- CI: consulta disponível retorna somente workflows de PR e não confirmou o push final. Conferir workflows das branches; não declarar CI aprovada sem evidência do SHA.
- Sem deploy nesta rodada. Ordem de publicação Produção → Teste, preservando Mercado Pago, IA e prioridades adiadas.
