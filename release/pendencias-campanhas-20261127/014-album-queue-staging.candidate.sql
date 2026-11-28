-- STAGING ONLY. Native album queue candidate after 011/012; does not activate transport.
begin;
do $$ begin
 if (select md5(prosrc) from pg_proc where oid='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure) is distinct from '505f7c16b8ea7d529e89a38b8101e06f'
 or (select md5(prosrc) from pg_proc where oid='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure) is distinct from '23a28caac43aa3b5c8e49d1f01dfb21f'
 or exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('waiting','leased','started') or album_items is not null)
 then raise exception 'album_queue_contract_mismatch';end if;
end $$;
create table neo_private.campaign_album_gate_v1(singleton boolean primary key default true check(singleton),enabled boolean not null default false,approved_version text check(approved_version is null or approved_version ~ '^0[.]2[.][0-9]{2,3}$'),check(not enabled or approved_version is not null));
insert into neo_private.campaign_album_gate_v1(singleton) values(true);
alter table neo_private.campaign_album_gate_v1 enable row level security;
revoke all on neo_private.campaign_album_gate_v1 from public,anon,authenticated,service_role;
create function neo_private.campaign_album_device_ok_v1(p_version text)
returns boolean language sql stable set search_path=pg_catalog as $$
 select coalesce((select enabled and approved_version=p_version from neo_private.campaign_album_gate_v1 where singleton),false)
$$;
create function neo_private.campaign_album_items_valid_v1(p_owner uuid,p_items jsonb)
returns boolean language plpgsql stable set search_path=pg_catalog as $$
declare item jsonb; n bigint; total bigint:=0; ids text[]:='{}';
begin
 if p_owner is null or jsonb_typeof(p_items) is distinct from 'array' then return false;end if;
 if jsonb_array_length(p_items) not between 2 and 4 then return false;end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['id','media_path','text']<>'{}'::jsonb
   or jsonb_typeof(item->'id') is distinct from 'string'
   or coalesce(item->>'id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or item->>'id'=any(ids) or jsonb_typeof(item->'text') is distinct from 'string'
   or length(item->>'text')>1000 or item->>'media_path' is distinct from p_owner::text||'/'||(item->>'id')||'.jpg'
  then return false;end if;
  ids:=array_append(ids,item->>'id');
  select case when o.metadata->>'size' ~ '^[0-9]{1,8}$' then (o.metadata->>'size')::bigint end into n
   from storage.objects o where o.bucket_id='neo-campaign-images' and o.name=item->>'media_path' and o.owner_id=p_owner::text and o.metadata->>'mimetype'='image/jpeg';
  if n is null or n not between 5 and 1048576 then return false;end if;
  total:=total+n;
 end loop;
 return total<=10485760;
end $$;
revoke all on function neo_private.campaign_album_device_ok_v1(text),neo_private.campaign_album_items_valid_v1(uuid,jsonb) from public,anon,authenticated,service_role;
alter table neo_private.campaign_wa_rich_messages drop constraint campaign_wa_rich_messages_kind_check,
 add constraint campaign_wa_rich_messages_kind_check check(kind in ('text','image','link','product','document','community','file','album')),
 add constraint campaign_wa_rich_album_contract_v1 check((kind='album' and album_items is not null and media_bucket is null and media_path is null and body='') or (kind<>'album' and album_items is null));
create or replace function neo_private.campaign_block_album_dispatch()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.campaign_editor_versions v where v.editor_id=new.editor_id
  and v.revision=new.revision and jsonb_path_exists(v.draft,'$.blocks[*].album_id')) then
  if tg_table_name<>'campaign_wa_rich_batches' or not coalesce((select enabled from neo_private.campaign_album_gate_v1 where singleton),false) then
   raise exception 'campaign_album_dispatch_disabled' using errcode='55000';
  end if;
 end if;
 return new;
end $$;
CREATE OR REPLACE FUNCTION public.neo_campaign_rich_admin_v1(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 actor uuid:=auth.uid();
 t neo_private.campaign_wa_test_config%rowtype;
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
 album jsonb;
 seen_albums text[]:='{}';
 media_size bigint;
 original_mime text;
 original_name text;
begin
 if actor is null or not neo_private.campaign_admin_allowed()
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then raise exception 'rich_admin_not_allowed' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'rich_payload_invalid' using errcode='22023';end if;
 select * into strict t from neo_private.campaign_wa_test_config where singleton for share;
 if p_action='diagnostics' then
  return jsonb_build_object('enabled',(select enabled from neo_private.campaign_wa_rich_control where singleton),
   'ready',coalesce((select enabled from neo_private.campaign_wa_rich_control where singleton),false)
     and neo_private.campaign_wa_test_ready(actor,t.connection_id,t.group_jid)
     and exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
       where c.id=t.connection_id and d.owner_id=actor and (d.version in ('0.2.12','0.2.13','0.2.14','0.2.15','0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') or neo_private.campaign_album_device_ok_v1(d.version)) and d.state='approved'),
   'destination',t.connection_id::text||':'||t.group_jid,'max_blocks',6,'max_image_bytes',1048576,
   'originals_enabled',coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false));
 end if;
 if p_action='status' then
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.sequence) from (
   select m.id,m.batch_id,m.sequence,m.kind,
     case when m.state='accepted' and m.send_error_at is not null and m.delivery_ack_at is null then 'failed' else m.state end as dispatch_state,
     m.state as transport_state,
     case when m.state='refused' and m.blocked_reason='previous_421' then 'paused_previous_421'
     when m.state='refused' and m.blocked_reason='video_conversion' then 'video_conversion_failed'
     when m.state='accepted' then
       case when m.delivery_ack_at is not null then 'delivered'
            when m.send_error_at is not null then 'rejected'
            when m.server_ack_at is not null then 'server_ack'
            else 'awaiting_confirmation' end
       else m.state end as delivery_state,
     m.attempts as dispatch_attempts,
     m.due_at as scheduled_at,m.sent_at,m.receipt_id is not null as has_receipt,
     m.receipt_id is not null as has_local_receipt,
     m.server_ack_at,m.delivery_ack_at,m.send_error_at,m.send_error_code,m.blocked_reason,
     case when m.kind='album' then jsonb_array_length(m.album_items) end as album_image_count,
     m.album_receipt,
     m.created_at,b.created_at as batch_created_at
   from neo_private.campaign_wa_rich_messages m join neo_private.campaign_wa_rich_batches b on b.id=m.batch_id
   where b.owner_id=actor and (p_data->>'editor_id' is null or b.editor_id=(p_data->>'editor_id')::uuid)
   order by b.created_at desc,m.sequence limit 60
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
   or not neo_private.campaign_wa_test_ready(actor,t.connection_id,t.group_jid)
   or not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
      where c.id=t.connection_id and d.owner_id=actor and (d.version in ('0.2.12','0.2.13','0.2.14','0.2.15','0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') or neo_private.campaign_album_device_ok_v1(d.version)) and d.state='approved') then
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
 if v.draft->'groups' is distinct from jsonb_build_array(t.connection_id::text||':'||t.group_jid)
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
 for bl in select value from jsonb_array_elements(v.draft->'blocks') loop
  if bl ? 'album_id' then
   if bl->>'album_id'=any(seen_albums) then continue;end if;
   seen_albums:=array_append(seen_albums,bl->>'album_id');
   if not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices dev on dev.id=c.device_id
    where c.id=t.connection_id and dev.owner_id=actor and dev.state='approved' and dev.last_seen>now()-interval '90 seconds' and neo_private.campaign_album_device_ok_v1(dev.version)) then
    raise exception 'rich_album_unavailable' using errcode='42501';end if;
   select jsonb_agg(jsonb_build_object('id',x->>'id','media_path',x->>'media_path','text',coalesce(x->>'text','')) order by ord) into album
    from jsonb_array_elements(v.draft->'blocks') with ordinality as b(x,ord) where x->>'album_id'=bl->>'album_id';
   if not neo_private.campaign_album_items_valid_v1(actor,album) then raise exception 'rich_album_invalid' using errcode='22023';end if;
   n:=n+1;
   insert into neo_private.campaign_wa_rich_messages(batch_id,owner_id,sequence,connection_id,group_jid,due_at,kind,body,album_items)
    values(req,actor,n,t.connection_id,t.group_jid,due,'album','',album);
   continue;
  end if;
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
      or length(body)>1000 or not neo_private.campaign_original_valid(actor,bl)
      or (exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=bl->>'media_path'
          and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then (o.metadata->>'size')::bigint>(case when bl->>'media_path' like '%.pdf' then 5242880 else 26214400 end) else true end)
        and not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
          where c.id=t.connection_id and d.owner_id=actor and d.state='approved' and d.version in ('0.2.28','0.2.29') and d.last_seen>now()-interval '90 seconds'))
      or (exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=bl->>'media_path'
           and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then ((o.metadata->>'size')::int>5242880 or bl->>'media_path' like '%.mov') else true end)
       and not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
         where c.id=t.connection_id and d.owner_id=actor and d.state='approved' and d.version in ('0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and (bl->>'media_path' not like '%.mov' or d.version in ('0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29')) and d.last_seen>now()-interval '90 seconds'))

    then raise exception 'rich_original_unavailable' using errcode='22023';end if;
    image_bucket:='neo-campaign-originals';image_path:=bl->>'media_path';original_name:=bl->>'name';
    original_mime:=case when image_path like '%.pdf' then 'application/pdf' when image_path like '%.mov' then 'video/quicktime' else 'video/mp4' end;
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
      E'\n\nhttps://teste.app.neopep.com.br/?produto='||(bl->>'ref')||'#loja';
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
      E'\n\nhttps://teste.app.neopep.com.br/?material='||(bl->>'ref')||'#comunidade';
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
      E'\n\nhttps://teste.app.neopep.com.br/#comunidade';
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
  values(req,actor,n,t.connection_id,t.group_jid,due,kind,body,image_bucket,image_path,original_mime,original_name);
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
 t neo_private.campaign_wa_test_config%rowtype;
 m neo_private.campaign_wa_rich_messages%rowtype;
 v_fence uuid;
 outcome text;
 receipt text;
begin
 if actor is null or p_device is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then raise exception 'rich_device_unauthorized' using errcode='42501';end if;
 select * into d from neo_private.connect_devices where id=p_device and owner_id=actor
 and state='approved' and version>='0.2.12' and last_seen>now()-interval '90 seconds'
 and secret_hash=sha256(convert_to(p_secret,'UTF8'));
 if not found then raise exception 'rich_device_unauthorized' using errcode='42501';end if;
 select * into strict t from neo_private.campaign_wa_test_config where singleton;
 if not (select enabled from neo_private.campaign_wa_rich_control where singleton)
 or not neo_private.campaign_wa_test_ready(actor,t.connection_id,t.group_jid)
 or not exists(select 1 from neo_private.connect_wa_connections c where c.id=t.connection_id and c.device_id=p_device)
 then return null;end if;
 if p_action='delivery_receipt' then
  -- No recipient IDs, content or phone numbers persisted. Match only the authenticated device's own dispatch.
  if d.version not in ('0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') or coalesce(p_data->>'status','') not in ('server_ack','delivery_ack','send_error')
    or coalesce(length(p_data->>'message_id'),0) not between 1 and 160
    or coalesce(p_data->>'group_jid','') !~ '^[0-9-]{1,64}@g[.]us$' then
    raise exception 'campaign_delivery_receipt_invalid' using errcode='22023';end if;
  update neo_private.campaign_wa_rich_messages as receipt_row set
    server_ack_at=case when p_data->>'status' in ('server_ack','delivery_ack') then coalesce(receipt_row.server_ack_at,now()) else receipt_row.server_ack_at end,
    delivery_ack_at=case when p_data->>'status'='delivery_ack' then coalesce(receipt_row.delivery_ack_at,now()) else receipt_row.delivery_ack_at end,
    send_error_at=case when p_data->>'status'='send_error' then coalesce(receipt_row.send_error_at,now()) else receipt_row.send_error_at end,
    send_error_code=case when p_data->>'status'='send_error' then case when coalesce(p_data->>'error_code','') ~ '^[0-9]{1,5}$' then p_data->>'error_code' else 'unknown' end else receipt_row.send_error_code end
   where receipt_row.owner_id=actor and receipt_row.device_id=p_device and receipt_row.connection_id=t.connection_id
    and receipt_row.state='accepted' and receipt_row.receipt_id=p_data->>'message_id' and receipt_row.group_jid=p_data->>'group_jid'
    and receipt_row.sent_at>now()-interval '7 days';
  return jsonb_build_object('ok',found);
 end if;
  if p_action='claim' then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));
  perform pg_advisory_xact_lock(hashtextextended('campaign-rich-owner:'||actor::text,0));
  -- Não reexecutar entregas com desfecho incerto. Timeout vira estado terminal.
  update neo_private.campaign_wa_rich_messages set state='uncertain'
   where owner_id=actor and state in ('leased','started') and lease_until<now();
  select job.* into m from neo_private.campaign_wa_rich_messages job
   join neo_private.campaign_wa_rich_batches b on b.id=job.batch_id
   where job.owner_id=actor and job.connection_id=t.connection_id and job.group_jid=t.group_jid
    and b.cancelled_at is null and job.state='waiting' and job.due_at<=now()
    and neo_private.campaign_parent_enabled(b.editor_id,'whatsapp') and neo_private.campaign_wa_review_allows(job.batch_id)
    and (job.kind<>'file' or (d.version in ('0.2.14','0.2.15','0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'originals_v1'='true'::jsonb and coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false)))
    
    and (job.kind<>'file' or job.original_mime not in ('video/mp4','video/quicktime') or (d.version in ('0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'native_video_v1'='true'::jsonb))
    and (job.kind<>'file' or exists(select 1 from storage.objects o
      where o.bucket_id='neo-campaign-originals' and o.name=job.media_path
      and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then
         ((o.metadata->>'size')::int between 8 and 5242880 and job.original_mime in ('application/pdf','video/mp4'))
         or (d.version in ('0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'originals_25mb'='true'::jsonb and (job.original_mime='video/mp4' or (job.original_mime='video/quicktime' and d.version in ('0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'originals_mov'='true'::jsonb))
             and (o.metadata->>'size')::int between 8 and 26214400) or (d.version in ('0.2.28','0.2.29') and p_data->'originals_50mb'='true'::jsonb and job.original_mime in ('application/pdf','video/mp4','video/quicktime') and (o.metadata->>'size')::int between 8 and 52428800)
         else false end))
    and (job.kind<>'album' or (neo_private.campaign_album_device_ok_v1(d.version) and p_data->'album_v1'='true'::jsonb and neo_private.campaign_album_items_valid_v1(actor,job.album_items)))
    and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding
        where preceding.batch_id=job.batch_id and preceding.sequence<job.sequence and preceding.state<>'accepted')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages recent
        where recent.batch_id=job.batch_id and recent.state='accepted' and recent.sent_at>now()-interval '3 seconds')
    and not exists(select 1 from neo_private.campaign_wa_rich_messages active
        where active.owner_id=actor and active.state in ('leased','started'))
   order by job.due_at,b.created_at,job.sequence limit 1 for update of job skip locked;
  if not found then return null;end if;
  update neo_private.campaign_wa_rich_messages set state='leased',attempts=1,
   fence=gen_random_uuid(),lease_until=now()+case when m.kind='album' then interval '240 seconds' when m.kind='file' then interval '180 seconds' else interval '60 seconds' end,device_id=p_device where id=m.id returning * into m;
  insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id) values(m.id,'leased',p_device);
  return jsonb_build_object('id',m.id,'fence',m.fence,'connection_id',m.connection_id);
 end if;
 if p_action not in ('start','finish') then raise exception 'rich_action_invalid' using errcode='22023';end if;
 v_fence:=(p_data->>'fence')::uuid;
 select * into m from neo_private.campaign_wa_rich_messages
  where id=(p_data->>'id')::uuid and device_id=p_device and owner_id=actor
   and connection_id=t.connection_id and group_jid=t.group_jid and fence=v_fence and lease_until>now()
  for update;
 if not found then raise exception 'rich_lease_invalid' using errcode='42501';end if;
 if p_action='start' then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.id=m.batch_id and not neo_private.campaign_parent_enabled(b.editor_id,'whatsapp')) then return null;end if;
  if not neo_private.campaign_wa_review_allows(m.batch_id) then raise exception 'review_required' using errcode='42501';end if;
  
 if m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and (d.version not in ('0.2.26','0.2.27','0.2.28','0.2.29') or p_data->'native_video_v1' is distinct from 'true'::jsonb) then raise exception 'native_video_required' using errcode='42501';end if;
 if m.kind='file' and not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=m.media_path
    and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then
      ((o.metadata->>'size')::int between 8 and 5242880 and m.original_mime in ('application/pdf','video/mp4'))
      or (d.version in ('0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'originals_25mb'='true'::jsonb and (m.original_mime='video/mp4' or (m.original_mime='video/quicktime' and d.version in ('0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->'originals_mov'='true'::jsonb))
          and (o.metadata->>'size')::int between 8 and 26214400) or (d.version in ('0.2.28','0.2.29') and p_data->'originals_50mb'='true'::jsonb and m.original_mime in ('application/pdf','video/mp4','video/quicktime') and (o.metadata->>'size')::int between 8 and 52428800)
      else false end) then raise exception 'rich_original_capacity' using errcode='42501';end if;
 if m.state<>'leased' or (m.kind='file' and (d.version not in ('0.2.14','0.2.15','0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') or p_data->'originals_v1' is distinct from 'true'::jsonb or not coalesce((select originals_enabled from neo_private.campaign_wa_rich_control where singleton),false))) then raise exception 'rich_lease_not_available' using errcode='42501';end if;
  if m.kind='album' and (not neo_private.campaign_album_device_ok_v1(d.version) or p_data->'album_v1' is distinct from 'true'::jsonb or not neo_private.campaign_album_items_valid_v1(actor,m.album_items)) then raise exception 'rich_album_capacity' using errcode='42501';end if;
  update neo_private.campaign_wa_rich_messages set state='started' where id=m.id;
  insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id) values(m.id,'started',p_device);
  return jsonb_build_object('id',m.id,'group_jid',m.group_jid,'kind',m.kind,'text',m.body,
   'media_bucket',m.media_bucket,'media_path',m.media_path,'original_mime',m.original_mime,'original_name',m.original_name,'album_items',m.album_items);
 end if;
 outcome:=p_data->>'outcome';receipt:=nullif(p_data->>'receipt_id','');
 if m.state<>'started' or outcome not in ('accepted','refused','uncertain')
 or (outcome='accepted' and (receipt is null or length(receipt)>200))
 then raise exception 'rich_receipt_invalid' using errcode='22023';end if;
 update neo_private.campaign_wa_rich_messages set state=outcome,receipt_id=case when outcome='accepted' then receipt end,
   album_receipt=case when m.album_items is not null and jsonb_typeof(p_data->'album_receipt')='object'
    then jsonb_build_object('message_id',p_data->'album_receipt'->'message_id',
      'media',coalesce(p_data->'album_receipt'->'media','[]'::jsonb)) end,
   sent_at=now(),lease_until=null,
   blocked_reason=case when outcome='refused' and receipt is null and ((d.version in ('0.2.25','0.2.26','0.2.27','0.2.28','0.2.29') and p_data->>'blocked_reason'='previous_421') or (d.version in ('0.2.26','0.2.27','0.2.28','0.2.29') and m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and p_data->>'blocked_reason'='video_conversion')) then p_data->>'blocked_reason' else null end
   where id=m.id;
 insert into neo_private.campaign_wa_rich_audit(message_id,event,device_id,receipt_present)
   values(m.id,outcome,p_device,receipt is not null and outcome='accepted');
 if outcome<>'accepted' then
  update neo_private.campaign_wa_rich_messages set state='cancelled' where batch_id=m.batch_id and state='waiting';
 end if;
 return jsonb_build_object('ok',true);
end $function$;
do $$ begin if (select md5(prosrc) from pg_proc where oid='neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid)'::regprocedure) is distinct from '9d2eaf995715a9905853439d06ae4f7f' then raise exception 'rebind_contract_mismatch';end if;end $$;
CREATE OR REPLACE FUNCTION neo_private.campaign_wa_auto_rebind(p_actor uuid, p_device uuid, p_connection uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare cfg neo_private.campaign_wa_test_config%rowtype;
begin
 if p_actor is null or auth.uid() is distinct from p_actor
 or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iss','') <> 'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then return false;end if;
 -- Fast path for ordinary heartbeat: no write or lock when the binding has not changed.
 if not exists(select 1 from neo_private.campaign_wa_test_config f where singleton and enabled and owner_id=p_actor and connection_id<>p_connection) then return false;end if;
 select * into cfg from neo_private.campaign_wa_test_config where singleton and enabled and owner_id=p_actor and connection_id<>p_connection for update skip locked;
 if not found or coalesce((select paused from neo_private.connect_config where singleton),true) then return false;end if;
 -- Explicit revocation only. A transient outage is not authority to change the sender.
 if not exists(select 1 from neo_private.connect_wa_connections old
  join neo_private.connect_wa_connections fresh on fresh.id=p_connection and fresh.created_at>old.created_at
  where old.id=cfg.connection_id and old.owner_id=p_actor and old.device_id=p_device and old.status='revoked'
   and fresh.owner_id=p_actor and fresh.device_id=p_device and fresh.status='connected') then return false;end if;
 if (select count(*) from neo_private.connect_wa_connections where owner_id=p_actor and status='connected')<>1 then return false;end if;
 if not exists(select 1 from neo_private.connect_wa_connections c
  join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
  join neo_private.campaign_dispatch_presence h on h.device_id=d.id and h.connection_id=c.id
  where c.id=p_connection and c.owner_id=p_actor and c.device_id=p_device and c.status='connected'
   and c.last_seen_at>now()-interval '90 seconds' and c.last_synced_at>now()-interval '24 hours'
   and c.revision>0 and d.state='approved' and d.version in ('0.2.13','0.2.14','0.2.15','0.2.16','0.2.17','0.2.18','0.2.19','0.2.20','0.2.21','0.2.22','0.2.23','0.2.24','0.2.25','0.2.26','0.2.27','0.2.28','0.2.29')
   and d.last_seen>now()-interval '90 seconds' and h.session_ready and h.bridge_version='wa-text-v1'
   and h.seen_at>now()-interval '90 seconds'
   and exists(select 1 from neo_private.connect_wa_selected_groups g where g.connection_id=c.id
    and g.group_jid=cfg.group_jid)) then return false;end if;
 -- No reassignment of destinations, reservations or batches. Fail closed while work is unresolved.
 if exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('waiting','leased','started','uncertain'))
 or exists(select 1 from neo_private.campaign_wa_publications where dispatch_state in ('waiting','leased','started','uncertain'))
 or exists(select 1 from neo_private.campaign_manual_claims where state='reserved') then return false;end if;
 update neo_private.campaign_wa_test_config set connection_id=p_connection
 where singleton and enabled and owner_id=p_actor and connection_id=cfg.connection_id;
 if found then raise log 'NeoPep WhatsApp binding automatically updated (test)';return true;end if;
 return false;
end;$function$;
commit;
