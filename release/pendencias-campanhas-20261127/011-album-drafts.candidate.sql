-- NeoPep native WhatsApp album draft persistence. Reconciled with both databases after the 50 MiB release. Dispatch remains blocked.
begin;

create function neo_private.campaign_validate_album_draft()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare invalid boolean;
begin
 if not jsonb_path_exists(new.draft,'$.blocks[*].album_id') then return new; end if;
 if new.channel<>'whatsapp' then
  raise exception 'campaign_album_channel' using errcode='22023';
 end if;
 with images as (
  select b, n, b->>'album_id' as album, b->>'id' as image_id,
   case when o.metadata->>'size' ~ '^[0-9]{1,8}$' then (o.metadata->>'size')::bigint end as bytes,
   o.metadata->>'mimetype' as mime
  from jsonb_array_elements(new.draft->'blocks') with ordinality as blocks(b,n)
  left join storage.objects o on o.bucket_id='neo-campaign-images'
   and o.name=b->>'media_path' and o.owner_id=new.owner_id::text
  where b ? 'album_id'
 )
 select exists(
  select 1 from images where b->>'type' is distinct from 'image'
   or coalesce(album,'') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or coalesce(image_id,'') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
   or (b->>'media_path') is distinct from (new.owner_id::text||'/'||image_id||'.jpg')
   or mime is distinct from 'image/jpeg' or bytes is null or bytes not between 5 and 1048576
   or (b ? 'text' and jsonb_typeof(b->'text')<>'string')
   or length(coalesce(b->>'text',''))>1000
  union all
  select 1 from images group by album having count(*) not between 2 and 4
   or count(*)<>max(n)-min(n)+1 or sum(bytes)>10485760
  union all
  select 1 from jsonb_array_elements(new.draft->'blocks') b
   where b->>'id' in (select image_id from images)
   group by b->>'id' having count(*)>1
 ) into invalid;
 if invalid then raise exception 'campaign_album_invalid' using errcode='22023'; end if;
 return new;
end $$;

create function neo_private.campaign_block_album_dispatch()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.campaign_editor_versions v where v.editor_id=new.editor_id
  and v.revision=new.revision and jsonb_path_exists(v.draft,'$.blocks[*].album_id')) then
  raise exception 'campaign_album_dispatch_disabled' using errcode='55000';
 end if;
 return new;
end $$;

revoke all on function neo_private.campaign_validate_album_draft(),neo_private.campaign_block_album_dispatch()
 from public,anon,authenticated,service_role;
create trigger campaign_validate_album_draft before insert or update on neo_private.campaign_editor_versions
 for each row execute function neo_private.campaign_validate_album_draft();
create trigger campaign_block_album_dispatch before insert on neo_private.campaign_wa_rich_batches
 for each row execute function neo_private.campaign_block_album_dispatch();
create trigger campaign_block_album_dispatch before insert on neo_private.campaign_dispatch_batch
 for each row execute function neo_private.campaign_block_album_dispatch();

-- Extend the installed revision RPC without replacing unrelated native authorization or validation.
do $patch$
declare definition text; source_hash text;
 keys constant text:=$key$b - array['id','type','text','label','ref','name','url','layout','media_path']$key$;
 marker constant text:=$key$if p_action='catalog' then$key$;
begin
 select md5(prosrc),pg_get_functiondef(oid) into source_hash,definition from pg_proc
 where oid='public.neo_campaign_editor_v1(text,jsonb)'::regprocedure;
 if source_hash is distinct from 'a50af0883bceb18e8df0e22849375989'
  or length(definition)-length(replace(definition,keys,''))<>length(keys)
  or length(definition)-length(replace(definition,marker,''))<>length(marker) then
  raise exception 'campaign_album_editor_contract_mismatch';
 end if;
 definition:=replace(definition,keys,left(keys,-1)||',''album_id'']');
 definition:=replace(definition,marker,$action$if p_action='album_draft_capabilities' then
    return jsonb_build_object('album_drafts',true,'max_image_bytes',1048576);
  end if;
  $action$||marker);
 execute definition;
end $patch$;
commit;
