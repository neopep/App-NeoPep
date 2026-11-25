insert into auth.users(id)
values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
       ('00000000-0000-0000-0000-000000000003');
insert into neo_private.admin_members(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.community_moderators(user_id) values ('00000000-0000-0000-0000-000000000003');
insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active)
values ('00000000-0000-0000-0000-000000000010','Produto aberto','','Teste',1000,2,true),
       ('00000000-0000-0000-0000-000000000011','Produto restrito','','Teste',1000,2,true);
insert into neo_private.shop_product_visibility values ('00000000-0000-0000-0000-000000000011','allowlist');

do $$
declare
  actor constant text:='00000000-0000-0000-0000-000000000001';
  other text;
  original uuid;
  row_saved jsonb;
  first_id uuid;
  params jsonb;
  version jsonb:='{"title":"Origem WhatsApp","blocks":[{"type":"text","text":"Olá *mundo*"},{"type":"product","ref":"00000000-0000-0000-0000-000000000010"}],
    "groups":["connection:group"],"timezone":"America/Sao_Paulo","planned_local":"2027-01-01T12:00","audience":"all"}';
begin
 assert not has_function_privilege('anon','public.neo_campaign_editor_v1(text,jsonb)','EXECUTE');
 assert not has_table_privilege('authenticated','neo_private.campaign_editor_versions','SELECT,INSERT,UPDATE');
 set local role authenticated;
 foreach other in array array['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',''] loop
   perform set_config('request.jwt.claim.sub',other,true);
   begin
     perform public.neo_campaign_editor_v1('review','{}');
     raise exception 'unauthorized review accepted';
   exception when insufficient_privilege then null;
   end;
 end loop;
 perform set_config('request.jwt.claim.sub',actor,true);
 original:=(public.neo_campaign_admin('save',null,'{"title":"Campanha App anterior","body":"Original"}')->>'id')::uuid;
 assert jsonb_array_length(public.neo_campaign_editor_v1('catalog','{"kind":"product","search":"Produto"}'))=1;
 params:=jsonb_build_object('editor_id',gen_random_uuid(),'request_id',gen_random_uuid(),'source_id',original,
  'channel','whatsapp','revision',0,'draft',version);
 row_saved:=public.neo_campaign_editor_v1('save',params);
 assert row_saved=public.neo_campaign_editor_v1('save',params);
 first_id:=(row_saved->>'campaign_id')::uuid;
 assert (row_saved->>'revision')::int=1 and row_saved->>'source_id'=original::text;
 begin
   perform public.neo_campaign_admin('activate',first_id,'{}');
   raise exception 'review draft escaped quarantine';
 exception when check_violation then null;
 end;
 begin
   perform public.neo_campaign_editor_v1('schedule','{}');
   raise exception 'schedule action accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.neo_campaign_editor_v1('save',params||jsonb_build_object('request_id',gen_random_uuid()));
   raise exception 'stale revision accepted';
 exception when serialization_failure then null;
 end;
 row_saved:=public.neo_campaign_editor_v1('save',params||jsonb_build_object('request_id',gen_random_uuid(),'revision',1,
  'draft',version||'{"title":"Versão WhatsApp 2"}'));
 assert row_saved->>'revision'='2' and row_saved->>'campaign_id'=first_id::text;
 assert public.neo_campaign_editor_v1('load',jsonb_build_object('campaign_id',first_id))=row_saved;

 row_saved:=public.neo_campaign_editor_v1('save',jsonb_build_object('editor_id',gen_random_uuid(),'request_id',gen_random_uuid(),
  'source_id',first_id,'channel','app','revision',0,'draft',version||'{"title":"Versão App","groups":[],"audience":"premium"}'));
 assert row_saved->>'source_id'=first_id::text and row_saved->'draft'->>'audience'='premium';
 assert jsonb_array_length(public.neo_campaign_editor_v1('review','{}'))=2;
 reset role;
 assert (select count(*) from neo_private.campaigns where structured_review_only)=2;
 assert (select count(*) from neo_private.campaigns where id=original and title='Campanha App anterior' and popup_enabled)=1;
end $$;
\echo OK: autorização, catálogo protegido, histórico, repetição, revisão desatualizada, cross-post e quarentena
