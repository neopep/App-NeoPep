-- Candidate only; apply after signed 0.2.28 installation and coordinated approval.
begin;
set local lock_timeout='5s';
-- Apply after verified 0.2.28 candidate is approved for distribution.
-- Preserves all existing checks and 0.2.27 compatibility.
do $gate$
declare sig text; f regprocedure; olddef text; newdef text; changed int:=0;
begin
 perform set_config('lock_timeout','5s',true);
 foreach sig in array array['neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid)','public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)','public.neo_campaign_rich_admin_v1(text,jsonb)','public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'] loop
 f:=to_regprocedure(sig);
 if f is null then
  if sig like 'public.neo_campaign_dispatch_device_v1%' then continue; end if;
  raise exception 'required function missing: %',sig;
 end if;
 olddef:=pg_get_functiondef(f);
 if sig like 'public.neo_campaign_dispatch_device_v1%' and olddef not like '%0.2.%' then continue; end if;
 if position($v$'0.2.28'$v$ in olddef)>0 then raise exception 'already patched: %',sig; end if;
 if position($v$'0.2.27')$v$ in olddef)=0 then raise exception 'allowlist mismatch: %',sig; end if;
 newdef:=replace(olddef,$v$'0.2.27')$v$,$v$'0.2.27','0.2.28')$v$);
 if newdef=olddef or replace(newdef,$v$,'0.2.28')$v$,')')<>olddef then raise exception 'unexpected change: %',sig; end if;
 execute newdef;
 changed:=changed+1;
 end loop;
 if changed<3 then raise exception 'incomplete patch'; end if;
end;$gate$;


do $sizes$
declare f regprocedure; d text; a text; b text; k text;
begin
 if not exists(select 1 from storage.buckets where id='neo-campaign-originals' and not public and file_size_limit=26214400 and allowed_mime_types @> array['application/pdf','video/mp4','video/quicktime']::text[]) then raise exception 'original_bucket_changed';end if;
 f:='neo_private.campaign_original_valid(uuid,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);a:=$a$(case when p_block->>'media_path' like '%.mp4' or p_block->>'media_path' like '%.mov' then 26214400 else 5242880 end)$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'original_validator_changed';end if;
 execute replace(d,a,'52428800');
 f:='public.neo_library_campaign_share(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);a:=$a$(case when item.mime in ('video/mp4','video/quicktime') then 26214400 else 5242880 end)$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'library_share_changed';end if;
 execute replace(d,a,'52428800');
 f:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 -- Existing 5 MiB PDF and 25 MiB video clients remain compatible; only .28 with explicit capability can receive bigger originals.
 foreach k in array array['job','m'] loop
  a:='and (o.metadata->>''size'')::int between 8 and 26214400)'||chr(10)||(case when k='job' then '         ' else '      ' end)||'else false end';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'device_size_contract_changed';end if;
  -- Keep the previous size branch unchanged, adding a new alternative inside the existing CASE.
  b:=split_part(a,chr(10),1)||' or (d.version=''0.2.28'' and p_data->''originals_50mb''=''true''::jsonb and '||k||'.original_mime in (''application/pdf'',''video/mp4'',''video/quicktime'') and (o.metadata->>''size'')::int between 8 and 52428800)'||chr(10)||(case when k='job' then '         ' else '      ' end)||'else false end';
  d:=overlay(d placing b from strpos(d,a) for length(a));
 end loop;
 -- The generic allowlist extension also extends the native-video version lists.
 if strpos(d,$a$d.version in ('0.2.26','0.2.27','0.2.28') and p_data->'native_video_v1'='true'::jsonb$a$)=0 or strpos(d,$a$d.version not in ('0.2.26','0.2.27','0.2.28') or p_data->'native_video_v1' is distinct from 'true'::jsonb$a$)=0 then raise exception 'native_gate_changed';end if;
 execute d;
 f:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$      or length(body)>1000 or not neo_private.campaign_original_valid(actor,bl)$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'admin_original_gate_changed';end if;
 b:=a||$b$
      or (exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=bl->>'media_path'
          and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then (o.metadata->>'size')::bigint>(case when bl->>'media_path' like '%.pdf' then 5242880 else 26214400 end) else true end)
        and not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
          where c.id=t.connection_id and d.owner_id=actor and d.state='approved' and d.version='0.2.28' and d.last_seen>now()-interval '90 seconds'))$b$;
 execute replace(d,a,b);
 update storage.buckets set file_size_limit=52428800 where id='neo-campaign-originals' and not public and file_size_limit=26214400;
 if not found then raise exception 'bucket_update_failed';end if;
end;$sizes$;
commit;
