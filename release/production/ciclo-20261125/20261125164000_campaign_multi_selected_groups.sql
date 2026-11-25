-- NeoPep Produção: somente grupos selecionados e sincronizados no Connect.
-- Não ativa envios; liberação operacional separada após validação do worker e do frontend.
-- Origem: definições oficiais existentes em 25/11/2026. Mantém Auth/JWT, idempotência, isolamento e ACL.
alter table neo_private.campaign_wa_official_config drop constraint campaign_wa_official_config_check1;
alter table neo_private.campaign_wa_official_config add constraint campaign_wa_official_config_check1
 check (not enabled or (owner_id is not null and connection_id is not null
   and (group_jid is null or group_jid ~ '^[0-9]+(-[0-9]+)?@g[.]us$')));
alter table neo_private.campaign_wa_rich_messages drop constraint campaign_wa_rich_messages_sequence_check;
alter table neo_private.campaign_wa_rich_messages add constraint campaign_wa_rich_messages_sequence_check
 check (sequence between 1 and 180);

CREATE OR REPLACE FUNCTION neo_private.campaign_wa_official_allowed(actor uuid, connection uuid, jid text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss'
  ='https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1',false)
 and exists(select 1 from neo_private.campaign_wa_official_config t
  join neo_private.connect_wa_connections c on c.id=t.connection_id and c.owner_id=t.owner_id
  join neo_private.connect_wa_selected_groups g on g.connection_id=c.id
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=t.owner_id
  where t.enabled and t.owner_id=actor and t.connection_id=connection
    and (t.group_jid is null or g.group_jid=t.group_jid)
    and (jid is null or g.group_jid=jid)
    and d.state='approved');
$function$;

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
       where c.id=t.connection_id and d.owner_id=actor and d.version='0.2.13' and d.state='approved'),
   'destination',case when t.group_jid is not null then t.connection_id::text||':'||t.group_jid end,
   'destinations',(select coalesce(jsonb_agg(t.connection_id::text||':'||g.group_jid order by g.display_name,g.group_jid),'[]'::jsonb)
     from neo_private.connect_wa_selected_groups g where g.connection_id=t.connection_id),
   'max_blocks',6,'max_image_bytes',1048576);
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
      where c.id=t.connection_id and d.owner_id=actor and d.version='0.2.13' and d.state='approved') then
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
  n:=n+1;kind:=bl->>'type';body:=coalesce(bl->>'text','');image_bucket:=null;image_path:=null;
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
  if image_path is not null then
   select (o.metadata->>'size')::bigint into media_size from storage.objects o
     where o.bucket_id=image_bucket and o.name=image_path and o.metadata->>'mimetype'='image/jpeg';
   if media_size is null or media_size not between 4 and 1048576 then
     raise exception 'rich_media_unavailable' using errcode='22023';
   end if;
  end if;
  if length(body)>2000 then raise exception 'rich_caption_exceeds_limit' using errcode='22023';end if;
  insert into neo_private.campaign_wa_rich_messages(batch_id,owner_id,sequence,connection_id,group_jid,due_at,kind,body,media_bucket,media_path)
  values(req,actor,n,t.connection_id,target_jid,due,kind,body,image_bucket,image_path);
  end loop;
 end loop;
 return jsonb_build_object('batch_id',req,'message_count',n,'scheduled_for',due);
end $function$
;

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
 and state='approved' and version='0.2.13' and last_seen>now()-interval '90 seconds'
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
    and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding
        where preceding.batch_id=job.batch_id and preceding.sequence<job.sequence and preceding.state<>'accepted')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages recent
        where recent.batch_id=job.batch_id and recent.state='accepted' and recent.sent_at>now()-interval '3 seconds')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages active
        where active.owner_id=actor and active.state in ('leased','started'))
   order by job.due_at,b.created_at,job.sequence limit 1 for update of job skip locked;
  if not found then return null;end if;
  update neo_private.campaign_wa_rich_messages set state='leased',attempts=1,
   fence=gen_random_uuid(),lease_until=now()+interval '60 seconds',device_id=p_device where id=m.id returning * into m;
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
  if m.state<>'leased' then raise exception 'rich_lease_not_available' using errcode='42501';end if;
  update neo_private.campaign_wa_rich_messages set state='started' where id=m.id;
  insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id) values(m.id,'started',p_device);
  return jsonb_build_object('id',m.id,'group_jid',m.group_jid,'kind',m.kind,'text',m.body,
   'media_bucket',m.media_bucket,'media_path',m.media_path);
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
end $function$
;

CREATE OR REPLACE FUNCTION public.neo_campaign_central_v1(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<rename>>
declare
 actor uuid:=auth.uid();
 parent neo_private.campaign_central_groups;
 publication neo_private.campaign_central_publications;
 latest neo_private.campaign_editor_versions;
 campaign_key uuid;
 publication_key uuid;
 request_key uuid;
 title text;
 args jsonb;
 result jsonb;
 event_name text;
 due text;
 previous_batch uuid;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
    or coalesce(auth.jwt()->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1' then
  raise exception 'campaign_central_admin_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' then
  raise exception 'campaign_central_invalid_payload' using errcode='22023';
 end if;

 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc,c.campaign_id)
   from (select g.campaign_id,g.created_at,g.archived_at,c.title,
    (select count(*) from neo_private.campaign_central_publications pub where pub.campaign_id=g.campaign_id) as publications,
    (select min(b.due_at) from neo_private.campaign_central_publications pub
      join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
      where pub.campaign_id=g.campaign_id and b.cancelled_at is null and b.due_at>now()) as next_at,
    (select count(distinct pub.id) from neo_private.campaign_central_publications pub
     join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
     join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
     where pub.campaign_id=g.campaign_id and m.state in ('waiting','leased','started')) as pending,
    (select count(distinct pub.id) from neo_private.campaign_central_publications pub
     join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id and b.owner_id=actor
     join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
     where pub.campaign_id=g.campaign_id and m.state in ('uncertain','refused')) as problems,
    (select count(*) from neo_private.campaign_central_publications pub
      where pub.campaign_id=g.campaign_id and not exists
        (select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=pub.editor_id and b.owner_id=actor)) as drafts
    from neo_private.campaign_central_groups g join neo_private.campaigns c on c.id=g.campaign_id
    where g.owner_id=actor order by g.created_at desc,g.campaign_id
    limit 50 offset greatest(coalesce((p_data->>'offset')::integer,0),0)) c),'[]'::jsonb);
 end if;

 campaign_key:=(p_data->>'campaign_id')::uuid;
 request_key:=(p_data->>'request_id')::uuid;
 if p_action='adopt' then
  select * into latest from neo_private.campaign_editor_versions v where v.campaign_id=campaign_key
   and v.owner_id=actor and v.channel='whatsapp' order by v.revision desc limit 1;
  if not found or not exists(select 1 from neo_private.campaigns where id=campaign_key and structured_review_only) then
   raise exception 'campaign_central_adoption_unavailable' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign-central-adopt:'||latest.editor_id::text,0));
  select pub.campaign_id into campaign_key from neo_private.campaign_central_publications pub
   where pub.editor_id=latest.editor_id;
  if found then return jsonb_build_object('campaign_id',campaign_key); end if;
  campaign_key:=latest.campaign_id;
  insert into neo_private.campaign_central_groups(campaign_id,owner_id,request_id) values(campaign_key,actor,campaign_key);
  insert into neo_private.campaign_central_publications(id,campaign_id,editor_id,source_id)
   values(latest.editor_id,campaign_key,latest.editor_id,latest.source_id);
  return jsonb_build_object('campaign_id',campaign_key);
 end if;
 if p_action='create' then
  title:=btrim(p_data->>'title');
  if request_key is null or title is null or length(title) not between 1 and 120 then
   raise exception 'campaign_central_invalid_title' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('campaign-central:'||actor::text||':'||request_key::text,0));
  select * into parent from neo_private.campaign_central_groups where owner_id=actor and request_id=request_key;
  if found then return jsonb_build_object('campaign_id',parent.campaign_id); end if;
  due:=nullif(p_data->>'destination','');
  if due is not null and not exists(select 1 from neo_private.campaign_wa_official_config t
   join neo_private.connect_wa_selected_groups g on g.connection_id=t.connection_id
    where t.owner_id=actor and t.enabled and due=t.connection_id::text||':'||g.group_jid
      and (t.group_jid is null or t.group_jid=g.group_jid)) then
   raise exception 'campaign_central_destination_unavailable' using errcode='42501';
  end if;
  result:=public.neo_campaign_admin('save',null,jsonb_build_object('title',title,'body','',
    'structured_review_only',true,'whatsapp_enabled',false,'popup_enabled',false,'push_requested',false));
  campaign_key:=(result->>'id')::uuid;
  insert into neo_private.campaign_central_groups(campaign_id,owner_id,request_id,default_destination) values(campaign_key,actor,request_key,due);
  insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'created');
  return jsonb_build_object('campaign_id',campaign_key);
 end if;

 select * into parent from neo_private.campaign_central_groups
 where campaign_id=campaign_key and owner_id=actor for update;
 if not found then raise exception 'campaign_central_owner_required' using errcode='42501'; end if;

 if p_action='get' then
  return jsonb_build_object('campaign_id',campaign_key,'title',(select c.title from neo_private.campaigns c where id=campaign_key),
   'archived_at',parent.archived_at,'default_destination',parent.default_destination,
   'publications',coalesce((select jsonb_agg(jsonb_build_object('id',pub.id,'editor_id',pub.editor_id,
     'revision',v.revision,'title',v.draft->>'title','planned_local',v.draft->>'planned_local',
     'legacy_dispatch',exists(select 1 from neo_private.campaign_dispatch_batch l where l.editor_id=pub.editor_id and l.owner_id=actor),
     'kinds', (select jsonb_agg(item->>'type') from jsonb_array_elements(v.draft->'blocks') item),
     'batches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'revision',b.revision,'due_at',b.due_at,
       'cancelled_at',b.cancelled_at,'states',(select jsonb_agg(m.state order by m.sequence)
       from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id)) order by b.created_at desc)
       from neo_private.campaign_wa_rich_batches b where b.editor_id=pub.editor_id and b.owner_id=actor),'[]'::jsonb))
     order by pub.created_at,pub.id)
     from neo_private.campaign_central_publications pub join lateral (
       select ev.revision,ev.draft from neo_private.campaign_editor_versions ev where ev.editor_id=pub.editor_id
       and ev.owner_id=actor order by ev.revision desc limit 1
     ) v on true where pub.campaign_id=campaign_key),'[]'::jsonb),
   'events',coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from
     (select id,publication_id,event,revision,recorded_at from neo_private.campaign_central_events
      where campaign_id=campaign_key order by id desc limit 100) a),'[]'::jsonb));
 end if;

 if p_action='rename' then
  title:=btrim(p_data->>'title');
  if parent.archived_at is not null or title is null or length(title) not between 1 and 120 then
   raise exception 'campaign_central_invalid_title' using errcode='22023';
  end if;
  update neo_private.campaigns set title=rename.title,updated_at=now()
   where id=campaign_key and neo_private.campaigns.title is distinct from rename.title;
  if found then insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'renamed'); end if;
  return '{}'::jsonb;
 end if;
 if p_action='archive' then
  perform 1 from neo_private.campaign_central_publications where campaign_id=campaign_key for update;
  if exists(select 1 from neo_private.campaign_central_publications pub
   join neo_private.campaign_wa_rich_batches b on b.editor_id=pub.editor_id
   join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
   where pub.campaign_id=campaign_key and m.state in ('waiting','leased','started')) then
   raise exception 'campaign_central_dispatch_pending' using errcode='55000';
  end if;
  if parent.archived_at is null then
   update neo_private.campaign_central_groups set archived_at=now() where campaign_id=campaign_key;
   insert into neo_private.campaign_central_events(campaign_id,actor_id,event) values(campaign_key,actor,'archived');
  end if;
  return '{}'::jsonb;
 end if;

 publication_key:=(p_data->>'publication_id')::uuid;
 select * into publication from neo_private.campaign_central_publications
 where id=publication_key and campaign_id=campaign_key for update;
 if found then
  select * into latest from neo_private.campaign_editor_versions where editor_id=publication.editor_id and owner_id=actor
   order by revision desc limit 1;
 end if;
 if p_action='load' then
  return case when latest.editor_id is not null then to_jsonb(latest)-'owner_id'-'request_id' end;
 end if;
 if parent.archived_at is not null then raise exception 'campaign_central_archived' using errcode='55000'; end if;

 if p_action='save' or p_action='duplicate' then
  if request_key is null or publication_key is null then raise exception 'campaign_central_invalid_request' using errcode='22023'; end if;
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.editor_id=publication.editor_id
   and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m
    where m.batch_id=b.id and m.state<>'cancelled'))) and p_action='save' then
   raise exception 'campaign_central_revision_locked' using errcode='55000';
  end if;
  if p_action='duplicate' then
   if latest.editor_id is null then raise exception 'campaign_central_publication_unavailable' using errcode='42501'; end if;
   args:=jsonb_build_object('revision',0,'draft',latest.draft||jsonb_build_object(
     'title',left(latest.draft->>'title',111)||' (Cópia)','planned_local',coalesce(p_data->>'planned_local','')));
   publication_key:=request_key;
   select * into publication from neo_private.campaign_central_publications where id=publication_key and campaign_id=campaign_key;
  else
   args:=p_data;
  end if;
  if publication.id is null then
   insert into neo_private.campaign_central_publications(id,campaign_id,editor_id,source_id)
    values(publication_key,campaign_key,publication_key,campaign_key) returning * into publication;
  end if;
  due:=nullif(args->'draft'->>'planned_local','');
  if due is not null then perform neo_private.campaign_wall_time(due,'America/Sao_Paulo'); end if;
  select to_jsonb(v)-'owner_id'-'request_id' into result from neo_private.campaign_editor_versions v
   where v.editor_id=publication.editor_id and v.owner_id=actor and v.request_id=request_key;
  if found and p_action='duplicate' then return result; end if;
  if latest.campaign_id=campaign_key then select c.title into title from neo_private.campaigns c where c.id=campaign_key for update; end if;
  result:=public.neo_campaign_editor_v1('save',jsonb_build_object('channel','whatsapp',
   'editor_id',publication.editor_id,'request_id',request_key,'revision',args->'revision',
   'source_id',publication.source_id,'draft',args->'draft'));
  if title is not null then update neo_private.campaigns set title=rename.title where id=campaign_key; end if;
  if not exists(select 1 from neo_private.campaign_central_events e where e.publication_id=publication.id
     and e.revision=(result->>'revision')::integer and e.event in ('save','duplicate')) then
   insert into neo_private.campaign_central_events(campaign_id,publication_id,actor_id,event,revision)
    values(campaign_key,publication.id,actor,p_action,(result->>'revision')::integer);
  end if;
  return result;
 end if;

 if latest.editor_id is null then raise exception 'campaign_central_publication_unavailable' using errcode='42501'; end if;
 if p_action in ('schedule','publish') then
  if p_data->'confirmed' is distinct from 'true'::jsonb or request_key is null
     or latest.revision is distinct from (p_data->>'revision')::integer then
   raise exception 'campaign_central_confirmation_required' using errcode='22023';
  end if;
  if exists(select 1 from neo_private.campaign_dispatch_batch b where b.editor_id=publication.editor_id) then
   raise exception 'campaign_central_legacy_occurrence' using errcode='55000';
  end if;
  due:=nullif(p_data->>'local_time','');
  if p_action='schedule' and (due is null or due is distinct from nullif(latest.draft->>'planned_local','')) then
   raise exception 'campaign_central_time_changed' using errcode='22023';
  end if;
  select b.id into previous_batch from neo_private.campaign_wa_rich_batches b
   where b.editor_id=publication.editor_id and b.owner_id=actor
    and (b.cancelled_at is null or exists(select 1 from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.state<>'cancelled'))
   order by b.created_at desc limit 1;
  if previous_batch is not null then
   if previous_batch=request_key then return jsonb_build_object('batch_id',previous_batch,'reused',true); end if;
   raise exception 'campaign_central_already_dispatched' using errcode='55000';
  end if;
  result:=public.neo_campaign_rich_admin_v1('publish',jsonb_build_object('editor_id',publication.editor_id,
   'request_id',request_key,'revision',latest.revision,'confirmed',true,'local_time',case when p_action='schedule' then due end));
  event_name:=p_action;
 elsif p_action='cancel' then
  select b.id into previous_batch from neo_private.campaign_wa_rich_batches b
   where b.id=(p_data->>'batch_id')::uuid and b.editor_id=publication.editor_id and b.owner_id=actor for update;
  if not found then raise exception 'campaign_central_batch_unavailable' using errcode='42501'; end if;
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.id=previous_batch and b.cancelled_at is not null)
   then return '{}'::jsonb; end if;
  perform 1 from neo_private.campaign_wa_rich_messages where batch_id=previous_batch and state='waiting' for update;
  result:=public.neo_campaign_rich_admin_v1('cancel',jsonb_build_object('batch_id',previous_batch));
  event_name:='cancel';
 else
  raise exception 'campaign_central_unknown_action' using errcode='22023';
 end if;

 insert into neo_private.campaign_central_events(campaign_id,publication_id,actor_id,event,revision)
 values(campaign_key,publication.id,actor,event_name,latest.revision);
 return result;
end;
$function$
;
