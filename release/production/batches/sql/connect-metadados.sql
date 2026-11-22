-- Dependência de datas e auditoria. Não registrar versões ou instaladores de Teste.
alter table neo_private.connect_releases add column created_at timestamptz default now(),
 alter column approved_at drop default, alter column approved_at drop not null;
alter table neo_private.connect_audit add column release_version text, add column release_result text;
