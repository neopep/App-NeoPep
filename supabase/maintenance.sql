-- Operações técnicas sob revisão do responsável. NÃO executar na preparação local.
-- Agendar pelo mecanismo oficial do projeto após configurar a retenção.
-- Não remove dados corporais, fotos, contas ou comprovantes de consentimento.
begin;
delete from neo_private.rate_limits where window_start < now() - interval '2 days';
delete from neo_private.app_errors where day < current_date - 30;
commit;
