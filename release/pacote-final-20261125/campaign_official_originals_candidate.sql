-- PRODUÇÃO candidate: after campaign_official_app_popup_candidate.sql.
-- Retain 0.2.13 for prior media/text. PDF/MP4 requires 0.2.14 plus explicit capability and a separate disabled gate.
begin;
set local lock_timeout='5s';
do $guard$ begin
 if md5(pg_get_functiondef('public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure)) is distinct from '4c02d9e65ed5b65102c679417ac7f201' or md5(pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure)) is distinct from '5dadc48f1be834334de27ff4cdf55de6' then raise exception 'official_rich_contract_changed';end if;
 if exists(select 1 from neo_private.campaign_wa_rich_control where enabled) then raise exception 'official_rich_gate_must_remain_disabled';end if;
end $guard$;
alter table neo_private.campaign_wa_rich_control add column originals_enabled boolean not null default false;
alter table neo_private.campaign_wa_rich_messages add column original_mime text,add column original_name text;
alter table neo_private.campaign_wa_rich_messages drop constraint campaign_wa_rich_messages_kind_check,add constraint campaign_wa_rich_messages_kind_check check(kind in ('text','image','link','product','document','community','file'));
alter table neo_private.campaign_wa_rich_messages drop constraint campaign_wa_rich_messages_media_bucket_check,add constraint campaign_wa_rich_messages_media_bucket_check check(media_bucket in ('neo-campaign-images','neo-shop-products','neo-campaign-originals'));
alter table neo_private.campaign_wa_rich_messages add constraint campaign_wa_rich_original_metadata check(
 case when kind='file' then media_bucket is not null and media_bucket='neo-campaign-originals' and media_path is not null and original_name is not null and original_mime is not null and original_mime in ('application/pdf','video/mp4')
 else original_mime is null and original_name is null and media_bucket is distinct from 'neo-campaign-originals' end);
CREATE OR REPLACE FUNCTION public.neo_campaign_rich_admin_v1(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 actor uuid:=auth.uid();
 t neo_private.campaign_wa_official_config%rowtype;
 v neo_private.campaign_editor_versions%rowtype;
 batch neo_private.campaign_wa_rich_batches%rowtype;
 req uuid;
 current_revision integer;
 local_time text;
 due timestamptz;
 fingerprint text;
 bl jsonb;
 kind text;
 body text;
 image_path text;
 image_bucket text;
 product_row record;
 source_title text;
 n integer:=0;
 media_size bigint;
 original_mime text;
 original_name text;
 target_key text;
 target_jid text;
begin
 if actor is null or not neo_private.campaign_admin_allowed()
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 then raise exception 'rich_admin_not_allowed' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'rich_payload_invalid' using errcode='22023';end if;
 select * into strict t from neo_private.campaign_wa_official_config where singleton for share;
 if p_action='diagnostics' then
  return jsonb_build_object('enabled',(select enabled from neo_private.campaign_wa_rich_control where singleton),
   'ready',coalesce((select enabled from neo_private.campaign_wa_rich_control where singleton),false)
     and neo_private.campaign_wa_official_ready(actor,t.connection_id,t.group_jid)
     and exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
       where c.id=t.connection_id and d.owner_id=actor and d.version in ('0.2.13','0.2.14','0.2.15') and d.state='approved'),
   'destination',case when t.group_jid is not null then t.connection_id::text||':'||t.group_jid end,
   'destinations',(select coalesce(jsonb_agg(t.connection_id::text||':'||g.group_jid order by g.display_name,g.group_jid),'[]'::jsonb)
     from neo_private.connect_wa_selected_groups g where g.connection_id=t.connection_id),
   'max_blocks',6,'max_image_bytes',1048576,'originals_enabled',
   coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false)
   and exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
    where c.id=t.connection_id and d.owner_id=actor and d.version in ('0.2.14','0.2.15') and d.state='approved'));
 end if;
 if p_action='status' then
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.sequence) from (
   select m.id,m.batch_id,m.sequence,m.kind,m.state as dispatch_state,m.attempts as dispatch_attempts,
     m.due_at as scheduled_at,m.sent_at,m.receipt_id is not null as has_receipt,
     m.created_at,b.created_at as batch_created_at
   from neo_private.campaign_wa_rich_messages m join neo_private.campaign_wa_rich_batches b on b.id=m.batch_id
   where b.owner_id=actor and (p_data->>'editor_id' is null or b.editor_id=(p_data->>'editor_id')::uuid)
   order by b.created_at desc,m.sequence limit 180
  ) s),'[]'::jsonb);
 end if;
 if p_action='cancel' then
  update neo_private.campaign_wa_rich_batches b set cancelled_at=now()
   where b.id=(p_data->>'batch_id')::uuid and b.owner_id=actor and b.cancelled_at is null;
  if not found then raise exception 'rich_batch_not_found' using errcode='42501'; end if;
  update neo_private.campaign_wa_rich_messages m set state='cancelled'
    where m.batch_id=(p_data->>'batch_id')::uuid and m.state='waiting';
  return jsonb_build_object('ok',true);
 end if;
 if p_action<>'publish' or p_data->>'confirmed' is distinct from 'true' then
   raise exception 'rich_publish_requires_confirmation' using errcode='42501';
 end if;
 if not (select enabled from neo_private.campaign_wa_rich_control where singleton)
   or not neo_private.campaign_wa_official_ready(actor,t.connection_id,t.group_jid)
   or not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
      where c.id=t.connection_id and d.owner_id=actor and d.version in ('0.2.13','0.2.14','0.2.15') and d.state='approved') then
  raise exception 'rich_dispatch_not_ready' using errcode='42501';
 end if;
 req:=(p_data->>'request_id')::uuid;
 current_revision:=(p_data->>'revision')::int;
 if req is null or current_revision is null then raise exception 'rich_request_invalid' using errcode='22023';end if;
 select * into strict v from neo_private.campaign_editor_versions ev
 where ev.editor_id=(p_data->>'editor_id')::uuid and ev.revision=current_revision and ev.owner_id=actor and ev.channel='whatsapp'
   and not exists(select 1 from neo_private.campaign_editor_versions newer
       where newer.editor_id=ev.editor_id and newer.revision>ev.revision)
 for share;
 if jsonb_typeof(v.draft->'groups') is distinct from 'array'
 or jsonb_array_length(v.draft->'groups') not between 1 and 30
 or (select count(distinct item.value) from jsonb_array_elements_text(v.draft->'groups') item)<>jsonb_array_length(v.draft->'groups')
 or exists(select 1 from jsonb_array_elements_text(v.draft->'groups') item
    where not exists(select 1 from neo_private.connect_wa_selected_groups g
       where g.connection_id=t.connection_id and t.connection_id::text||':'||g.group_jid=item.value)
      or not neo_private.campaign_wa_official_allowed(actor,t.connection_id,split_part(item.value,':',2)))
 or jsonb_typeof(v.draft->'blocks')<>'array'
 or jsonb_array_length(v.draft->'blocks') not between 1 and 6
 then raise exception 'rich_blocks_or_destination_invalid' using errcode='42501';end if;
 local_time:=nullif(p_data->>'local_time','');
 due:=coalesce(neo_private.campaign_wall_time(local_time,'America/Sao_Paulo'),now());
 if due<now()-interval '1 minute' or due>now()+interval '90 days' then raise exception 'rich_schedule_invalid' using errcode='22023';end if;
 fingerprint:=md5(v.draft::text||coalesce(local_time,'')||current_revision::text);
 perform pg_advisory_xact_lock(hashtextextended('rich-batch:'||req::text,0));
 select * into batch from neo_private.campaign_wa_rich_batches where id=req;
 if found then
  if batch.owner_id<>actor or batch.editor_id<>v.editor_id or batch.revision<>current_revision or batch.fingerprint<>fingerprint then
   raise exception 'rich_idempotency_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('batch_id',batch.id,'reused',true);
 end if;
 insert into neo_private.campaign_wa_rich_batches(id,owner_id,editor_id,revision,due_at,fingerprint)
 values(req,actor,v.editor_id,current_revision,due,fingerprint);
 for target_key in select value from jsonb_array_elements_text(v.draft->'groups') order by value loop
  target_jid:=split_part(target_key,':',2);
  for bl in select value from jsonb_array_elements(v.draft->'blocks') loop
  n:=n+1;kind:=bl->>'type';body:=coalesce(bl->>'text','');image_bucket:=null;image_path:=null;original_mime:=null;original_name:=null;
  if kind='text' then
    if length(trim(body)) not between 1 and 2000 then raise exception 'rich_text_invalid' using errcode='22023';end if;
  elsif kind='link' then
    if length(coalesce(bl->>'url','')) not between 9 and 1800
       or bl->>'url' !~ '^https://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'
       or bl->>'url' ~* '/storage/v1/|[?&](token|signature|apikey|x-amz-[^=]*)='
       or length(body)>160 then raise exception 'rich_public_link_invalid' using errcode='22023';end if;
    body:=concat_ws(E'\n',nullif(body,''),bl->>'url');
  elsif kind='image' then
    if length(body)>1000 or coalesce(bl->>'media_path','') !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
       or split_part(bl->>'media_path','/',1)<>actor::text
       then raise exception 'rich_image_invalid' using errcode='22023';end if;
    image_bucket:='neo-campaign-images';image_path:=bl->>'media_path';
  elsif kind='file' then
    if not coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false)
      or not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
        where c.id=t.connection_id and d.owner_id=actor and d.version in ('0.2.14','0.2.15') and d.state='approved')
      or length(body)>1000 or not neo_private.campaign_original_valid(actor,bl)
    then raise exception 'rich_original_unavailable' using errcode='22023';end if;
    image_bucket:='neo-campaign-originals';image_path:=bl->>'media_path';original_name:=bl->>'name';
    original_mime:=case when image_path like '%.pdf' then 'application/pdf' else 'video/mp4' end;
  elsif kind='product' then
    if coalesce(bl->>'ref','') !~ '^[0-9a-f-]{36}$' then raise exception 'rich_product_invalid' using errcode='22023';end if;
    select p.name,p.price_cents,p.photo_path into product_row
      from neo_private.shop_products p left join neo_private.shop_product_visibility vis on vis.product_id=p.id
     where p.id=(bl->>'ref')::uuid and p.active and p.deleted_at is null and p.stock>0
       and coalesce(vis.mode,'public')='public';
    if not found then raise exception 'rich_product_unavailable' using errcode='42501';end if;
    if length(btrim(body))>1000 then raise exception 'rich_product_caption_too_long' using errcode='22023';end if;
    -- Nome, preco e URL sempre sao derivados da Loja; texto adicional e editavel.
    -- O preco permanece em negrito no WhatsApp.
    body:=left(product_row.name,150)||E'\n*R$ '||
      (product_row.price_cents/100)::text||','||lpad((product_row.price_cents%100)::text,2,'0')||'*'||
      case when length(btrim(body))>0 then E'\n\n'||btrim(body) else '' end||
      E'\n\nhttps://app.neopep.com.br/?produto='||(bl->>'ref')||'#loja';
    if product_row.photo_path is not null and exists(select 1 from storage.objects o
      where o.bucket_id='neo-shop-products' and o.name=product_row.photo_path
      and coalesce((o.metadata->>'size')::bigint,0) between 4 and 1048576
      and o.metadata->>'mimetype'='image/jpeg') then
      image_bucket:='neo-shop-products';image_path:=product_row.photo_path;
    end if;
  elsif kind='document' then
    if coalesce(bl->>'ref','') !~ '^[0-9a-f-]{36}$' or length(btrim(body))>1000
       then raise exception 'rich_library_reference_invalid' using errcode='22023';end if;
    select m.title into source_title from neo_private.community_materials m
      where m.id=(bl->>'ref')::uuid;
    if not found then raise exception 'rich_library_material_unavailable' using errcode='42501';end if;
    -- Link interno: o material continua sujeito ao login e permissões da Biblioteca.
    body:=left(source_title,150)||
      case when length(btrim(body))>0 then E'\n\n'||btrim(body) else '' end||
      E'\n\nhttps://app.neopep.com.br/?material='||(bl->>'ref')||'#comunidade';
  elsif kind='community' then
    if coalesce(bl->>'ref','') !~ '^[0-9a-f-]{36}$' or length(btrim(body))>1000
       then raise exception 'rich_community_reference_invalid' using errcode='22023';end if;
    perform 1 from neo_private.community_posts cp
      where cp.id=(bl->>'ref')::uuid and cp.status='published';
    if not found then raise exception 'rich_community_post_unavailable' using errcode='42501';end if;
    -- O aplicativo nao oferece rota direta para uma publicacao: envia referencia
    -- a Comunidade, sem URL inventada para o post nem exposicao de midia privada.
    body:='Publicação da Comunidade'||
      case when length(btrim(body))>0 then E'\n\n'||btrim(body) else '' end||
      E'\n\nhttps://app.neopep.com.br/#comunidade';
  else
    raise exception 'rich_block_unsupported' using errcode='22023';
  end if;
  if image_path is not null and kind<>'file' then
   select (o.metadata->>'size')::bigint into media_size from storage.objects o
     where o.bucket_id=image_bucket and o.name=image_path and o.metadata->>'mimetype'='image/jpeg';
   if media_size is null or media_size not between 4 and 1048576 then
     raise exception 'rich_media_unavailable' using errcode='22023';
   end if;
  end if;

  -- The document branch above still resolves authorization and the canonical
  -- material URL. Deliver only the owner's JPEG through the image protocol.
  if kind='document' and bl->>'media_path' is not null then
   if not exists(select 1 from jsonb_array_elements(coalesce(
      public.neo_library('get',jsonb_build_object('id',bl->>'ref'))->'material'->'attachments','[]'::jsonb)) a
      where a->>'mime'='application/pdf' or a->>'mime' like 'video/%')
   then raise exception 'rich_reference_source_forbidden' using errcode='42501'; end if;
   image_path:=bl->>'media_path';
   if image_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
      or split_part(image_path,'/',1)<>actor::text
      or not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-images'
       and o.name=image_path and o.metadata->>'mimetype'='image/jpeg'
       and case when coalesce(o.metadata->>'size','') ~ '^[0-9]{1,9}$'
        then (o.metadata->>'size')::integer between 1 and 1048576 else false end)
   then raise exception 'rich_reference_jpeg_invalid' using errcode='22023'; end if;
   image_bucket:='neo-campaign-images';
   kind:='image';
  end if;
  if length(body)>2000 then raise exception 'rich_caption_exceeds_limit' using errcode='22023';end if;
  insert into neo_private.campaign_wa_rich_messages(batch_id,owner_id,sequence,connection_id,group_jid,due_at,kind,body,media_bucket,media_path,original_mime,original_name)
  values(req,actor,n,t.connection_id,target_jid,due,kind,body,image_bucket,image_path,original_mime,original_name);
  end loop;
 end loop;
 return jsonb_build_object('batch_id',req,'message_count',n,'scheduled_for',due);
end $function$;

CREATE OR REPLACE FUNCTION public.neo_campaign_rich_device_v1(p_action text, p_device uuid, p_secret text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 actor uuid:=auth.uid();
 d neo_private.connect_devices%rowtype;
 t neo_private.campaign_wa_official_config%rowtype;
 m neo_private.campaign_wa_rich_messages%rowtype;
 v_fence uuid;
 outcome text;
 receipt text;
begin
 if actor is null or p_device is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 then raise exception 'rich_device_unauthorized' using errcode='42501';end if;
 select * into d from neo_private.connect_devices where id=p_device and owner_id=actor
 and state='approved' and version in ('0.2.13','0.2.14','0.2.15') and last_seen>now()-interval '90 seconds'
 and secret_hash=sha256(convert_to(p_secret,'UTF8'));
 if not found then raise exception 'rich_device_unauthorized' using errcode='42501';end if;
 select * into strict t from neo_private.campaign_wa_official_config where singleton;
 if not (select enabled from neo_private.campaign_wa_rich_control where singleton)
 or not neo_private.campaign_wa_official_ready(actor,t.connection_id,t.group_jid)
 or not exists(select 1 from neo_private.connect_wa_connections c where c.id=t.connection_id and c.device_id=p_device)
 then return null;end if;
 if p_action='claim' then
  perform pg_advisory_xact_lock(hashtextextended('campaign-rich-owner:'||actor::text,0));
  -- Não reexecutar entregas com desfecho incerto. Timeout vira estado terminal.
  update neo_private.campaign_wa_rich_messages set state='uncertain'
   where owner_id=actor and state in ('leased','started') and lease_until<now();
  select job.* into m from neo_private.campaign_wa_rich_messages job
   join neo_private.campaign_wa_rich_batches b on b.id=job.batch_id
   where job.owner_id=actor and job.connection_id=t.connection_id
    and neo_private.campaign_wa_official_allowed(actor,t.connection_id,job.group_jid)
    and b.cancelled_at is null and job.state='waiting' and job.due_at<=now()
    and (job.kind<>'file' or (d.version in ('0.2.14','0.2.15') and p_data->'originals_v1'='true'::jsonb and coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false)))
    and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding
        where preceding.batch_id=job.batch_id and preceding.sequence<job.sequence and preceding.state<>'accepted')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages recent
        where recent.batch_id=job.batch_id and recent.state='accepted' and recent.sent_at>now()-interval '3 seconds')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages active
        where active.owner_id=actor and active.state in ('leased','started'))
   order by job.due_at,b.created_at,job.sequence limit 1 for update of job skip locked;
  if not found then return null;end if;
  update neo_private.campaign_wa_rich_messages set state='leased',attempts=1,
   fence=gen_random_uuid(),lease_until=now()+case when m.kind='file' then interval '120 seconds' else interval '60 seconds' end,device_id=p_device where id=m.id returning * into m;
  insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id) values(m.id,'leased',p_device);
  return jsonb_build_object('id',m.id,'fence',m.fence,'connection_id',m.connection_id);
 end if;
 if p_action not in ('start','finish') then raise exception 'rich_action_invalid' using errcode='22023';end if;
 v_fence:=(p_data->>'fence')::uuid;
 select * into m from neo_private.campaign_wa_rich_messages
  where id=(p_data->>'id')::uuid and device_id=p_device and owner_id=actor
   and connection_id=t.connection_id and fence=v_fence and lease_until>now()
  for update;
 if not found then raise exception 'rich_lease_invalid' using errcode='42501';end if;
 if p_action='start' then
  if not neo_private.campaign_wa_official_allowed(actor,t.connection_id,m.group_jid)
     then raise exception 'rich_destination_revoked' using errcode='42501';end if;
  if m.state<>'leased' or (m.kind='file' and (d.version not in ('0.2.14','0.2.15') or p_data->'originals_v1' is distinct from 'true'::jsonb or not coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false))) then raise exception 'rich_lease_not_available' using errcode='42501';end if;
  update neo_private.campaign_wa_rich_messages set state='started' where id=m.id;
  insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id) values(m.id,'started',p_device);
  return jsonb_build_object('id',m.id,'group_jid',m.group_jid,'kind',m.kind,'text',m.body,
   'media_bucket',m.media_bucket,'media_path',m.media_path,'original_mime',m.original_mime,'original_name',m.original_name);
 end if;
 outcome:=p_data->>'outcome';receipt:=nullif(p_data->>'receipt_id','');
 if m.state<>'started' or outcome not in ('accepted','refused','uncertain')
 or (outcome='accepted' and (receipt is null or length(receipt)>200))
 then raise exception 'rich_receipt_invalid' using errcode='22023';end if;
 update neo_private.campaign_wa_rich_messages set state=outcome,receipt_id=case when outcome='accepted' then receipt end,
   sent_at=now(),lease_until=null where id=m.id;
 insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id,receipt_present)
   values(m.id,outcome,p_device,receipt is not null and outcome='accepted');
 if outcome<>'accepted' then
  update neo_private.campaign_wa_rich_messages set state='cancelled' where batch_id=m.batch_id and state='waiting';
 end if;
 return jsonb_build_object('ok',true);
end $function$;
commit;
