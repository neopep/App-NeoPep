do $$
declare
 admin constant uuid:='00000000-0000-0000-0000-000000000001';
 member constant uuid:='00000000-0000-0000-0000-000000000002';
 outsider constant uuid:='00000000-0000-0000-0000-000000000003';
 editor constant uuid:='00000000-0000-0000-0000-000000000101';
 later constant uuid:='00000000-0000-0000-0000-000000000102';
 expiring constant uuid:='00000000-0000-0000-0000-000000000103';
 now_batch uuid:=gen_random_uuid();
 future_batch uuid:=gen_random_uuid();
 revocation_batch uuid:=gen_random_uuid();
 offered uuid;
 draft jsonb:='{"title":"Homologação","blocks":[{"type":"text","text":"Somente no aplicativo"}],"groups":[],"timezone":"America/Sao_Paulo","audience":"all"}';
 intent jsonb;
 baseline int;
begin
 insert into auth.users(id) values(outsider);
 insert into neo_private.campaign_test_accounts(user_id) values(member);
 select count(*) into baseline from neo_private.campaign_dispatch_batch;
 assert not has_function_privilege('anon','public.neo_campaign_test_visit_v1(text,uuid)','execute');
 assert not has_table_privilege('authenticated','neo_private.campaign_test_recipients','select');
 perform set_config('request.jwt.claims','{"iss":"https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1"}',true);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 begin
  perform public.neo_campaign_test_admin_v1('diagnostics');
  raise exception 'production issuer accepted';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims','{"iss":"https://qnuluspqfazdppciermw.supabase.co/auth/v1"}',true);
 perform set_config('role','authenticated',true);
 assert public.neo_campaign_test_admin_v1('diagnostics') @> '{"enabled":false,"destinations":1}';
 intent:=jsonb_build_object('editor_id',editor,'revision',1,'request_id',now_batch,'confirmed',true,
   'destination_count',1,'audience_key',md5(member::text),'local_time',null);
 begin
  perform public.neo_campaign_test_admin_v1('publish',intent);
  raise exception 'enabled by default';
 exception when insufficient_privilege then null;
 end;
 for i in 1..3 loop
  perform public.neo_campaign_editor_v1('save',jsonb_build_object(
   'editor_id',(array[editor,later,expiring])[i],'revision',0,'request_id',gen_random_uuid(),'channel','app','draft',draft));
 end loop;
 perform set_config('role','none',true);
 update neo_private.campaign_test_config set enabled=true;
 update neo_private.campaign_test_accounts set enabled=false where user_id=member;
 insert into neo_private.campaign_test_accounts(user_id) values(outsider);
 perform set_config('role','authenticated',true);
 begin
  perform public.neo_campaign_test_admin_v1('publish',intent);
  raise exception 'same-count replacement accepted';
 exception when serialization_failure then null;
 end;
 perform set_config('role','none',true);
 update neo_private.campaign_test_accounts set enabled=user_id=member;
 perform set_config('role','authenticated',true);
 begin
  perform public.neo_campaign_test_admin_v1('publish',intent-'confirmed');
  raise exception 'missing confirmation accepted';
 exception when invalid_parameter_value then null;
 end;
 assert public.neo_campaign_test_admin_v1('publish',intent)=jsonb_build_object('batch_id',now_batch);
 assert public.neo_campaign_test_admin_v1('publish',intent)=jsonb_build_object('batch_id',now_batch);
 begin
  perform public.neo_campaign_test_admin_v1('publish',intent||jsonb_build_object('request_id',gen_random_uuid()));
  raise exception 'duplicate revision accepted';
 exception when unique_violation then null;
 end;
 perform public.neo_campaign_test_admin_v1('publish',intent||jsonb_build_object('editor_id',later,'request_id',future_batch,
  'local_time',to_char((now()+interval '1 day') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')));
 assert public.neo_campaign_test_admin_v1('status',jsonb_build_object('editor_id',later))->0->'recipients'->0->>'status'='scheduled';
 perform public.neo_campaign_test_admin_v1('publish',intent||jsonb_build_object('editor_id',expiring,'request_id',revocation_batch,
  'local_time',to_char((now()+interval '1 day') at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')));
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 assert public.neo_campaign_test_visit_v1('next') is null;
 assert public.neo_campaign_test_visit_v1('displayed',now_batch)='false'::jsonb
  or public.neo_campaign_test_visit_v1('displayed',now_batch) is null;
 begin
  perform public.neo_campaign_test_admin_v1('cancel',jsonb_build_object('batch_id',future_batch));
  raise exception 'outsider cancelled';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',member::text,true);
 assert public.neo_campaign_test_visit_v1('displayed',now_batch)='false'::jsonb;
 offered:=(public.neo_campaign_test_visit_v1('next')->>'id')::uuid;
 assert offered=now_batch;
 assert public.neo_campaign_test_visit_v1('next') is null;
 assert public.neo_campaign_test_visit_v1('displayed',now_batch)='true'::jsonb;
 perform set_config('role','none',true);
 assert (select count(*) from neo_private.campaign_test_recipients where displayed_at is not null)=1;
 update neo_private.campaign_test_batches set starts_at=now()-interval '1 minute' where id=revocation_batch;
 assert public.neo_campaign_test_visit_v1('next')->>'id'=revocation_batch::text;
 update neo_private.campaign_test_accounts set enabled=false where user_id=member;
 assert public.neo_campaign_test_visit_v1('displayed',revocation_batch) is null;
 assert public.neo_campaign_test_visit_v1('next') is null;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform set_config('role','authenticated',true);
 assert public.neo_campaign_test_admin_v1('cancel',jsonb_build_object('batch_id',future_batch))='{"ok":true}';
 assert public.neo_campaign_test_admin_v1('cancel',jsonb_build_object('batch_id',future_batch))='{"ok":true}';
 assert public.neo_campaign_test_admin_v1('status',jsonb_build_object('editor_id',later))->0->'recipients'->0->>'status'='cancelled';
 perform set_config('role','none',true);
 update neo_private.campaign_test_accounts set enabled=true where user_id=member;
 update neo_private.campaign_test_batches set starts_at=now()-interval '1 minute' where id=future_batch;
 assert not exists(select from neo_private.campaign_test_recipients where batch_id=future_batch and offered_at is not null);
 assert (select count(*) from neo_private.campaign_dispatch_batch)=baseline;
 assert not exists(select from neo_private.campaigns where title='Homologação' and not structured_review_only);
end $$;
