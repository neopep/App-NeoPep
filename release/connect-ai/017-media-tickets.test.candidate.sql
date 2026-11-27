-- Isolated Teste candidate after 014. No object writes, no public routes.
begin;
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw' and not drafts_enabled) then raise exception 'wrong_environment_or_gate_enabled';end if;
end $guard$;
create table neo_private.connect_ai_media_tickets(
 id uuid primary key,connection_id uuid not null references neo_private.connect_ai_connections(id) on delete cascade,
 owner_id uuid not null,channel text not null check(channel in ('app','whatsapp')),campaign_id uuid not null,
 publication_id uuid not null,block_id uuid not null,revision integer not null check(revision>=0),
 mime text not null check(mime in ('image/jpeg','application/pdf','video/mp4')),size_bytes integer not null check(size_bytes between 1 and 5242880),
 filename text not null check(length(filename) between 1 and 160),
 state text not null default 'issued' check(state in ('issued','uploading','stored','uncertain')),
 lease_id uuid,lease_until timestamptz,sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now(),
 check(mime<>'image/jpeg' or size_bytes<=1048576),
 check(channel='whatsapp' or mime='image/jpeg')
);
alter table neo_private.connect_ai_media_tickets enable row level security;
revoke all on neo_private.connect_ai_media_tickets from public,anon,authenticated,neo_connect_ai_broker;
create function neo_private.connect_ai_media_ticket(p_connection uuid,p_owner uuid,p_ticket uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare t neo_private.connect_ai_media_tickets; ch text; cid uuid; pid uuid; bid uuid; rev integer; mt text; sz integer; fn text; bucket text; path text; digest text;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 if p_action not in ('issue','inspect','claim','finish') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'invalid_ticket' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('connect-ai-media:'||p_ticket::text,0));
 if p_action='issue' then
  ch:=p_data->>'channel';cid:=(p_data->>'campaignId')::uuid;pid:=(p_data->>'publicationId')::uuid;bid:=(p_data->>'blockId')::uuid;rev:=(p_data->>'revision')::integer;mt:=p_data->>'mime';sz:=(p_data->>'size')::integer;fn:=p_data->>'name';
  if ch is null or ch not in ('app','whatsapp') or cid is null or pid is null or bid is null or rev is null or rev<0 or mt is null or mt not in ('image/jpeg','application/pdf','video/mp4') or sz is null or sz not between 1 and 5242880 or (mt='image/jpeg' and sz>1048576) or (ch='app' and mt<>'image/jpeg') or fn is null or length(btrim(fn)) not between 1 and 160 or fn ~ '[/\\]' or fn ~ '[[:cntrl:]]' then raise exception 'invalid_ticket' using errcode='22023';end if;
  if not (case when ch='app' then exists(select 1 from neo_private.campaign_app_groups where campaign_id=cid and owner_id=p_owner and deleted_at is null and archived_at is null) else exists(select 1 from neo_private.campaign_central_groups where campaign_id=cid and owner_id=p_owner and deleted_at is null and archived_at is null) end) then raise exception 'forbidden' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended('connect-ai-media-owner:'||p_connection::text,0));
  select * into t from neo_private.connect_ai_media_tickets where id=p_ticket;
  if found then
   if row(t.connection_id,t.owner_id,t.channel,t.campaign_id,t.publication_id,t.block_id,t.revision,t.mime,t.size_bytes,t.filename) is distinct from row(p_connection,p_owner,ch,cid,pid,bid,rev,mt,sz,fn) then raise exception 'ticket_conflict' using errcode='23505';end if;
  else
   if (select count(*) from neo_private.connect_ai_media_tickets where connection_id=p_connection and expires_at>clock_timestamp())>=120 then raise exception 'ticket_limit' using errcode='55000';end if;
   insert into neo_private.connect_ai_media_tickets(id,connection_id,owner_id,channel,campaign_id,publication_id,block_id,revision,mime,size_bytes,filename) values(p_ticket,p_connection,p_owner,ch,cid,pid,bid,rev,mt,sz,fn) returning * into t;
  end if;
 else
  select * into t from neo_private.connect_ai_media_tickets where id=p_ticket and connection_id=p_connection and owner_id=p_owner;
  if not found then raise exception 'forbidden' using errcode='42501';end if;
 end if;
 if t.state='uploading' and t.lease_until<=clock_timestamp() then
  update neo_private.connect_ai_media_tickets set state='uncertain',lease_id=null,lease_until=null where id=p_ticket returning * into t;
 end if;
 if t.expires_at<=clock_timestamp() then raise exception 'ticket_expired' using errcode='55000';end if;
 bucket:=case when t.mime='image/jpeg' then 'neo-campaign-images' else 'neo-campaign-originals' end;
 path:=t.owner_id::text||'/'||t.id::text||case t.mime when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' else '.mp4' end;
 if p_action='claim' then
  if t.state<>'issued' then raise exception 'ticket_not_available' using errcode='55000';end if;
  update neo_private.connect_ai_media_tickets set state='uploading',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=p_ticket returning * into t;
 elsif p_action='finish' then
  if t.state<>'uploading' or t.lease_id is distinct from (p_data->>'leaseId')::uuid or t.lease_until<=clock_timestamp() then raise exception 'invalid_lease' using errcode='55000';end if;
  digest:=p_data->>'sha256';
  if p_data->>'state'='stored' then
   if digest is null or digest !~ '^[a-f0-9]{64}$' or not exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=path and o.metadata->>'size'=t.size_bytes::text and o.metadata->>'mimetype'=t.mime) then raise exception 'object_not_confirmed' using errcode='55000';end if;
   update neo_private.connect_ai_media_tickets set state='stored',sha256=digest,lease_id=null,lease_until=null where id=p_ticket returning * into t;
  elsif p_data->>'state'='uncertain' then
   update neo_private.connect_ai_media_tickets set state='uncertain',lease_id=null,lease_until=null where id=p_ticket returning * into t;
  else raise exception 'invalid_result' using errcode='22023';end if;
 end if;
 return jsonb_build_object('ticketId',t.id,'connectionId',t.connection_id,'ownerId',t.owner_id,'channel',t.channel,'campaignId',t.campaign_id,'publicationId',t.publication_id,'blockId',t.block_id,'requestId',t.id,'revision',t.revision,'mime',t.mime,'size',t.size_bytes,'name',t.filename,'bucket',bucket,'path',path,'blockType',case when t.mime='image/jpeg' then 'image' else 'file' end,'state',t.state,'sha256',t.sha256,'expiresAt',t.expires_at,'leaseId',case when p_action='claim' then t.lease_id else null end);
end $$;
revoke all on function neo_private.connect_ai_media_ticket(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_media_ticket(uuid,uuid,uuid,text,jsonb) to neo_connect_ai_broker;
commit;
