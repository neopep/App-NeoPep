-- Teste only. Apply after campaign_app_settings_candidate.sql. No push, no audience expansion.
begin;
set local lock_timeout='5s';
alter table neo_private.campaign_test_batches add column rich_blocks jsonb;
create function neo_private.campaign_popup_blocks(p_owner uuid,p_blocks jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $blocks$
declare b jsonb; k text; t text; path text; result jsonb:='[]'::jsonb; ref text; label text;
begin
 if jsonb_typeof(p_blocks) is distinct from 'array' then raise exception 'popup_blocks_invalid' using errcode='22023';end if;
 if jsonb_array_length(p_blocks) not between 1 and 12 then raise exception 'popup_blocks_limit' using errcode='22023';end if;
 for b in select value from jsonb_array_elements(p_blocks) loop
  k:=b->>'type';t:=coalesce(b->>'text','');path:=b->>'media_path';ref:=b->>'ref';
  if length(t)>2000 or t~*'(https?://|www[.]|/storage/v1/|[?&](token|signature|apikey)=)' then raise exception 'popup_text_invalid' using errcode='22023';end if;
  if k='text' then
   if length(btrim(t))=0 then raise exception 'popup_text_empty' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t));
  elsif k='image' then
   if path is null or split_part(path,'/',1)<>p_owner::text or path!~'^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
    or not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-images' and o.name=path
       and o.metadata->>'mimetype'='image/jpeg' and case when o.metadata->>'size'~'^[0-9]{1,9}$' then (o.metadata->>'size')::int between 4 and 1048576 else false end)
   then raise exception 'popup_image_unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'media_path',path));
  elsif k='file' then
   if not neo_private.campaign_original_valid(p_owner,b) then raise exception 'popup_file_unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'media_path',path,'name',b->>'name','mime',case when path like '%.pdf' then 'application/pdf' else 'video/mp4' end));
  elsif k='link' then
   if coalesce(b->>'url','')!~'^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$' or length(b->>'url')>1800
    or b->>'url'~*'/storage/v1/|[?&](token|signature|apikey|x-amz-[^=]*)=' then raise exception 'popup_link_invalid' using errcode='22023';end if;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'url',b->>'url','label','Abrir link'));
  elsif k in ('product','document','community') then
   -- The destination applies its existing access rules; never reveal a private preview to a new audience.
   if coalesce(ref,'')!~'^[a-f0-9-]{36}$' then raise exception 'popup_reference_invalid' using errcode='22023';end if;
   if k='product' and not exists(select 1 from neo_private.shop_products p left join neo_private.shop_product_visibility v on v.product_id=p.id where p.id=ref::uuid and p.active and p.deleted_at is null and p.stock>0 and coalesce(v.mode,'public')='public') then raise exception 'popup_product_unavailable' using errcode='22023';end if;
   if k='document' and not exists(select 1 from neo_private.community_materials m where m.id=ref::uuid) then raise exception 'popup_document_unavailable' using errcode='22023';end if;
   if k='community' and not exists(select 1 from neo_private.community_posts p where p.id=ref::uuid and p.status='published') then raise exception 'popup_community_unavailable' using errcode='22023';end if;
   label:=case k when 'product' then 'Abrir produto' when 'document' then 'Abrir material na Biblioteca' else 'Abrir Comunidade' end;
   result:=result||jsonb_build_array(jsonb_build_object('type',k,'text',t,'ref',ref,'label',label));
  else raise exception 'popup_block_unsupported' using errcode='22023';end if;
 end loop;
 return result;
end;$blocks$;
revoke all on function neo_private.campaign_popup_blocks(uuid,jsonb) from public,anon,authenticated;
create function neo_private.campaign_test_media_allowed(p_path text,p_kind text) returns boolean
language sql stable security invoker set search_path='' as $media$
 select coalesce(neo_private.campaign_test_session() and public.neo_has_consent('terms')
 and exists(select 1 from neo_private.campaign_test_config where enabled)
 and exists(select 1 from neo_private.campaign_test_accounts where user_id=auth.uid() and enabled)
 and exists(select 1 from neo_private.campaign_test_batches b join neo_private.campaign_test_recipients r on r.batch_id=b.id
  cross join lateral jsonb_array_elements(b.rich_blocks) x
  where r.user_id=auth.uid() and r.offered_at>now()-interval '5 minutes'
  and neo_private.campaign_test_popup_eligible(b,now()) and x->>'type'=p_kind and x->>'media_path'=p_path),false)
$media$;
revoke all on function neo_private.campaign_test_media_allowed(text,text) from public,anon,authenticated;
do $patch$
declare d text:=pg_get_functiondef('public.neo_campaign_image_allowed(text,boolean)'::regprocedure);
 a constant text:=$a$ else neo_private.campaign_admin_allowed() or ($a$;
begin
 if cardinality(string_to_array(d,a))<>2 then raise exception 'popup_image_policy_changed';end if;
 execute replace(d,a,$a$ else neo_private.campaign_admin_allowed() or neo_private.campaign_test_media_allowed(p_path,'image') or ($a$);
end;$patch$;
-- Separate SELECT policy: owner/admin upload remains unchanged.
create function public.neo_campaign_test_original_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $read$
 select neo_private.campaign_test_media_allowed(p_path,'file')
$read$;
revoke all on function public.neo_campaign_test_original_read(text) from public,anon;
grant execute on function public.neo_campaign_test_original_read(text) to authenticated;
create policy campaign_test_original_read on storage.objects for select to authenticated using(bucket_id='neo-campaign-originals' and (select public.neo_campaign_test_original_read(name)));

do $patch$
declare d text:=pg_get_functiondef('public.neo_campaign_test_admin_v1(text,jsonb)'::regprocedure);
 a constant text:=$a$ body_text text;$a$;
 b constant text:=$b$ if exists(select 1 from jsonb_array_elements(version.draft->'blocks') b where b->>'type'<>'text') then
  raise exception 'campaign_test_requires_text' using errcode='22023';
 end if;
 select btrim(string_agg(b->>'text',E'\n\n' order by position)) into body_text
  from jsonb_array_elements(version.draft->'blocks') with ordinality blocks(b,position);
 if coalesce(length(body_text),0) not between 1 and 2000 or body_text ~* '(https?://|www[.]|/storage/v1/|[?&](token|signature|apikey)=)' then
  raise exception 'campaign_test_requires_plain_text' using errcode='22023';
 end if;$b$;
 c constant text:=$c$ insert into neo_private.campaign_test_batches(id,owner_id,editor_id,revision,intent,title,body,starts_at,app_settings,ends_at)
 values(request_key,actor,editor,revision_number,p_data,version.draft->>'title',body_text,start_time,settings,end_time);$c$;
begin
 if cardinality(string_to_array(d,a))<>2 or cardinality(string_to_array(d,b))<>2 or cardinality(string_to_array(d,c))<>2 then raise exception 'popup_admin_contract_changed';end if;
 d:=replace(d,a,a||$a$
 rendered_blocks jsonb;$a$);
 d:=replace(d,b,$b$ rendered_blocks:=neo_private.campaign_popup_blocks(actor,version.draft->'blocks');
 select left(coalesce(string_agg(x->>'text',E'\n\n'),''),2000) into body_text from jsonb_array_elements(rendered_blocks) x;
 if btrim(body_text)='' then body_text:='Conteúdo da campanha';end if;$b$);
 d:=replace(d,c,$c$ insert into neo_private.campaign_test_batches(id,owner_id,editor_id,revision,intent,title,body,starts_at,app_settings,ends_at,rich_blocks)
 values(request_key,actor,editor,revision_number,p_data,version.draft->>'title',body_text,start_time,settings,end_time,rendered_blocks);$c$);
 d:=replace(d,$a$'audience_key',(select md5$a$,$a$'rich_popup',true,'audience_key',(select md5$a$);
 execute d;
end;$patch$;
do $patch$
declare d text:=pg_get_functiondef('public.neo_campaign_test_visit_v1(text,uuid)'::regprocedure);
 a constant text:=$a$ if not neo_private.campaign_test_session() then return null;end if;$a$;
 b constant text:=$b$return jsonb_build_object('id',batch.id,'title',batch.title,'body',batch.body);$b$;
begin
 if cardinality(string_to_array(d,a))<>2 or cardinality(string_to_array(d,b))<>2 then raise exception 'popup_visit_contract_changed';end if;
 d:=replace(d,a,$a$ if not neo_private.campaign_test_session() or not public.neo_has_consent('terms') then return null;end if;$a$);
 d:=replace(d,b,$b$return jsonb_build_object('id',batch.id,'title',batch.title,'body',batch.body,'blocks',batch.rich_blocks);$b$);
 d:=replace(d,'order by b.starts_at,b.id limit 1','order by coalesce((b.app_settings->>''priority'')::int,0) desc,b.starts_at,b.id limit 1');
 execute d;
end;$patch$;
commit;
