-- Executar separadamente em cada projeto, após confirmar o project ref pela conexão.
-- Nenhuma linha de usuário, consentimento ou conteúdo é consultada.
begin read only;
select current_database(), current_setting('server_version');
select name, to_regprocedure(name) is not null as installed
from (values
 ('public.neo_personalization_consent(boolean)'),
 ('public.neo_has_consent(text)'),
 ('neo_private.take_limit(text,integer,integer)'),
 ('public.neo_library_v25(text,jsonb)'),
 ('public.neo_admin_access()'),
 ('neo_private.library_pins(text,jsonb)')
) as functions(name);
select table_schema, table_name, column_name
from information_schema.columns
where (table_schema, table_name, column_name) in (
 ('public','neo_consent_events','purpose'),
 ('neo_private','community_materials','pin_position'),
 ('neo_private','operations_audit','actor')
);
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (
 ('public','neo_consent_events'),
 ('neo_private','community_materials'),
 ('neo_private','operations_audit')
);
select n.nspname, p.proname,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,
 p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname,p.proname) in (
 ('public','neo_personalization_consent'),
 ('neo_private','library_pins'),
 ('public','neo_library_v25')
);
select position('order by p.pin_position nulls last' in d)>0 as pins_installed,
 position('order by case when v_sort=''popular'' then m.view_count' in d)>0
  and position('order by case when v_sort=''popular'' then p.view_count' in d)>0
  and position(' if p_action=''view'' then' in d)>0 as legacy_anchors_present
from (select pg_get_functiondef(to_regprocedure('public.neo_library_v25(text,jsonb)')) as d) as library;
rollback;
