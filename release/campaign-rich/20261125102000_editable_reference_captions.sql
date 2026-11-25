-- NeoPep Teste only: add editable same-message captions to product, library, community references.
-- Official product price (bold), name and link remain authoritative. No historical message resend.
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
 media_size bigint;
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
       where c.id=t.connection_id and d.owner_id=actor and d.version='0.2.12' and d.state='approved'),
   'destination',t.connection_id::text||':'||t.group_jid,'max_blocks',6,'max_image_bytes',1048576);
 end if;
 if p_action='status' then
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.sequence) from (
   select m.id,m.batch_id,m.sequence,m.kind,m.state as dispatch_state,m.attempts as dispatch_attempts,
     m.due_at as scheduled_at,m.sent_at,m.receipt_id is not null as has_receipt,
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
      where c.id=t.connection_id and d.owner_id=actor and d.version='0.2.12' and d.state='approved') then
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
  if image_path is not null then
   select (o.metadata->>'size')::bigint into media_size from storage.objects o
     where o.bucket_id=image_bucket and o.name=image_path and o.metadata->>'mimetype'='image/jpeg';
   if media_size is null or media_size not between 4 and 1048576 then
     raise exception 'rich_media_unavailable' using errcode='22023';
   end if;
  end if;
  if length(body)>2000 then raise exception 'rich_caption_exceeds_limit' using errcode='22023';end if;
  insert into neo_private.campaign_wa_rich_messages(batch_id,owner_id,sequence,connection_id,group_jid,due_at,kind,body,media_bucket,media_path)
  values(req,actor,n,t.connection_id,t.group_jid,due,kind,body,image_bucket,image_path);
 end loop;
 return jsonb_build_object('batch_id',req,'message_count',n,'scheduled_for',due);
end $function$
;
