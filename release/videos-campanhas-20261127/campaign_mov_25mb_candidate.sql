-- MOV original 25 MiB, preserva PDF 5 MiB e MP4 25 MiB.
-- Aplicar somente após CI, instalação assinada 0.2.17 e confirmação do heartbeat.
begin;
set local lock_timeout='5s';
do $patch$
declare d text; fn regprocedure; a text; b text; cname text:='campaign_wa_rich_original_metadata';
begin
 lock table neo_private.campaign_wa_rich_messages in share row exclusive mode;
 if exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('leased','started')) then raise exception 'campaign_busy';end if;
 if not exists(select 1 from neo_private.connect_devices where version='0.2.17' and state='approved' and last_seen>now()-interval '90 seconds') then raise exception 'connect_0217_not_online';end if;
 if not exists(select 1 from storage.buckets where id='neo-campaign-originals' and not public and file_size_limit=26214400 and allowed_mime_types @> array['application/pdf','video/mp4']::text[] and not ('video/quicktime'=any(allowed_mime_types))) then raise exception 'original_bucket_contract_changed';end if;
 fn:='public.neo_campaign_original_allowed(text)'::regprocedure;
 d:=pg_get_functiondef(fn);
 if strpos(d,'(pdf|mp4)')=0 then raise exception 'path_contract_changed';end if;
 execute replace(d,'(pdf|mp4)','(pdf|mp4|mov)');
 fn:='neo_private.campaign_original_valid(uuid,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);
 a:=$a$or (lower(p_block->>'name') like '%.mp4' and p_block->>'media_path' like '%.mp4'))$a$;
 if strpos(d,a)=0 or strpos(d,'(pdf|mp4)')=0 then raise exception 'original_contract_changed';end if;
 d:=replace(d,a,$a$or (lower(p_block->>'name') like '%.mp4' and p_block->>'media_path' like '%.mp4') or (lower(p_block->>'name') like '%.mov' and p_block->>'media_path' like '%.mov'))$a$);
 d:=replace(d,'(pdf|mp4)','(pdf|mp4|mov)');
 d:=replace(d,$a$then 'application/pdf' else 'video/mp4' end$a$,$a$then 'application/pdf' when p_block->>'media_path' like '%.mov' then 'video/quicktime' else 'video/mp4' end$a$);
 d:=replace(d,$a$when p_block->>'media_path' like '%.mp4' then 26214400$a$,$a$when p_block->>'media_path' like '%.mp4' or p_block->>'media_path' like '%.mov' then 26214400$a$);
 execute d;
 fn:='public.neo_library_campaign_share(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);a:=$a$('application/pdf','video/mp4')$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'library_contract_changed';end if;
 d:=replace(d,a,$a$('application/pdf','video/mp4','video/quicktime')$a$);
 d:=replace(d,$a$item.mime='video/mp4' then 26214400$a$,$a$item.mime in ('video/mp4','video/quicktime') then 26214400$a$);
 execute d;
 fn:='neo_private.campaign_popup_blocks(uuid,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);a:=$a$case when path like '%.pdf' then 'application/pdf' else 'video/mp4' end$a$;
 if strpos(d,a)=0 then raise exception 'popup_contract_changed';end if;
 execute replace(d,a,$a$case when path like '%.pdf' then 'application/pdf' when path like '%.mov' then 'video/quicktime' else 'video/mp4' end$a$);
 -- Expand the existing validated row constraint, without dropping other checks.
 select pg_get_constraintdef(oid) into strict d from pg_constraint where conrelid='neo_private.campaign_wa_rich_messages'::regclass and conname=cname;
 a:=$a$'video/mp4'::text$a$;
 if strpos(d,a)=0 then raise exception 'message_constraint_changed';end if;
 d:=replace(d,a,$a$'video/mp4'::text, 'video/quicktime'::text$a$);
 execute format('alter table neo_private.campaign_wa_rich_messages drop constraint %I, add constraint %I %s',cname,cname,d);
 -- Extend existing version lists, not unrelated AI functions.
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname,p.proname) in (('public','neo_campaign_rich_admin_v1'),('public','neo_campaign_rich_device_v1'),('public','neo_campaign_dispatch_device_v1'),('neo_private','campaign_wa_auto_rebind')) and p.prokind='f'
 loop
  d:=pg_get_functiondef(fn);a:=$a$'0.2.15','0.2.16'$a$;
  if strpos(d,a)>0 then execute replace(d,a,a||$a$,'0.2.17'$a$);end if;
 end loop;
 fn:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);
 a:=$a$and d.version='0.2.16' and d.last_seen$a$;
 if strpos(d,a)=0 then raise exception 'admin_guard_changed';end if;
 d:=replace(d,a,$a$and d.version in ('0.2.16','0.2.17') and (bl->>'media_path' not like '%.mov' or d.version='0.2.17') and d.last_seen$a$);
 a:=$a$then (o.metadata->>'size')::int>5242880 else true end$a$;
 if strpos(d,a)=0 then raise exception 'admin_size_guard_changed';end if;
 d:=replace(d,a,$a$then ((o.metadata->>'size')::int>5242880 or bl->>'media_path' like '%.mov') else true end$a$);
 a:=$a$case when image_path like '%.pdf' then 'application/pdf' else 'video/mp4' end$a$;
 if strpos(d,a)=0 then raise exception 'admin_mime_changed';end if;
 execute replace(d,a,$a$case when image_path like '%.pdf' then 'application/pdf' when image_path like '%.mov' then 'video/quicktime' else 'video/mp4' end$a$);
 fn:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);
 a:=$a$(o.metadata->>'size')::int between 8 and 5242880$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'worker_guard_changed';end if;
 d:=replace(d,$a$(o.metadata->>'size')::int between 8 and 5242880
         or (d.version='0.2.16' and p_data->'originals_25mb'='true'::jsonb and job.original_mime='video/mp4'$a$,$a$((o.metadata->>'size')::int between 8 and 5242880 and job.original_mime in ('application/pdf','video/mp4'))
         or (d.version in ('0.2.16','0.2.17') and p_data->'originals_25mb'='true'::jsonb and (job.original_mime='video/mp4' or (job.original_mime='video/quicktime' and d.version='0.2.17' and p_data->'originals_mov'='true'::jsonb))$a$);
 d:=replace(d,$a$(o.metadata->>'size')::int between 8 and 5242880
      or (d.version='0.2.16' and p_data->'originals_25mb'='true'::jsonb and m.original_mime='video/mp4'$a$,$a$((o.metadata->>'size')::int between 8 and 5242880 and m.original_mime in ('application/pdf','video/mp4'))
      or (d.version in ('0.2.16','0.2.17') and p_data->'originals_25mb'='true'::jsonb and (m.original_mime='video/mp4' or (m.original_mime='video/quicktime' and d.version='0.2.17' and p_data->'originals_mov'='true'::jsonb))$a$);
 if (length(d)-length(replace(d,'originals_mov','')))/length('originals_mov')<>2 then raise exception 'worker_mov_gate_changed';end if;
 execute d;
 update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'video/quicktime') where id='neo-campaign-originals' and not public and file_size_limit=26214400;
 if not found then raise exception 'bucket_changed';end if;
end;$patch$;
commit;
