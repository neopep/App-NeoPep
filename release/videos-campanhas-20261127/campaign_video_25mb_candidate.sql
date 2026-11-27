-- CANDIDATA: 25 MiB MP4; PDF 5 MiB. Aplicar somente após CI e homologação do Connect 0.2.16.
-- Não modifica flags, permissões, grupos ou fila. Reutiliza as definições vigentes de cada ambiente.
begin;
set local lock_timeout='5s';
do $patch$
declare d text; a text; b text; fn regprocedure;
 claim_guard constant text:='and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding';
 start_guard constant text:='if m.state<>''leased'' or (m.kind=''file'' and';
 admin_guard constant text:='or length(body)>1000 or not neo_private.campaign_original_valid(actor,bl)';
begin
 if exists(select 1 from neo_private.campaign_wa_rich_messages where state in ('leased','started')) then raise exception 'campaign_busy';end if;
 if not exists(select 1 from storage.buckets where id='neo-campaign-originals' and public=false and file_size_limit=5242880) then raise exception 'original_bucket_contract_changed';end if;

 fn:='neo_private.campaign_original_valid(uuid,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);a:='between 8 and 5242880';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'original_contract_changed';end if;
 execute replace(d,a,'between 8 and (case when p_block->>''media_path'' like ''%.mp4'' then 26214400 else 5242880 end)');

 fn:='public.neo_library_campaign_share(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(fn);a:='between 1 and 5242880';
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'library_share_contract_changed';end if;
 execute replace(d,a,'between 1 and (case when item.mime=''video/mp4'' then 26214400 else 5242880 end)');

 -- New signed Connect version only; old compatible clients continue sending <=5 MiB.
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname,p.proname) in (('public','neo_campaign_rich_admin_v1'),('public','neo_campaign_rich_device_v1'),
   ('public','neo_campaign_dispatch_device_v1'),('neo_private','campaign_wa_auto_rebind')) and p.prokind='f'
 loop
  d:=pg_get_functiondef(fn);
  if strpos(d,'''0.2.15''')>0 then execute replace(d,'''0.2.15''','''0.2.15'',''0.2.16''');end if;
 end loop;

 fn:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;d:=pg_get_functiondef(fn);
 if (length(d)-length(replace(d,admin_guard,'')))/length(admin_guard)<>1 then raise exception 'admin_original_contract_changed';end if;
 execute replace(d,admin_guard,admin_guard||$guard$
      or (exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=bl->>'media_path'
           and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then (o.metadata->>'size')::int>5242880 else true end)
       and not exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
         where c.id=t.connection_id and d.owner_id=actor and d.state='approved' and d.version='0.2.16' and d.last_seen>now()-interval '90 seconds'))
$guard$);

 fn:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;d:=pg_get_functiondef(fn);
 if (length(d)-length(replace(d,claim_guard,'')))/length(claim_guard)<>1
 or (length(d)-length(replace(d,start_guard,'')))/length(start_guard)<>1 then raise exception 'device_original_contract_changed';end if;
 d:=replace(d,claim_guard,$guard$
    and (job.kind<>'file' or exists(select 1 from storage.objects o
      where o.bucket_id='neo-campaign-originals' and o.name=job.media_path
      and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then
         (o.metadata->>'size')::int between 8 and 5242880
         or (d.version='0.2.16' and p_data->'originals_25mb'='true'::jsonb and job.original_mime='video/mp4'
             and (o.metadata->>'size')::int between 8 and 26214400)
         else false end))
    $guard$||claim_guard);
 d:=replace(d,start_guard,$guard$
 if m.kind='file' and not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=m.media_path
    and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$' then
      (o.metadata->>'size')::int between 8 and 5242880
      or (d.version='0.2.16' and p_data->'originals_25mb'='true'::jsonb and m.original_mime='video/mp4'
          and (o.metadata->>'size')::int between 8 and 26214400)
      else false end) then raise exception 'rich_original_capacity' using errcode='42501';end if;
 $guard$||start_guard);
 d:=replace(d,'interval ''120 seconds''','interval ''180 seconds''');
 execute d;
 update storage.buckets set file_size_limit=26214400 where id='neo-campaign-originals' and public=false and file_size_limit=5242880;
 if not found then raise exception 'original_bucket_contract_changed';end if;
end;$patch$;
commit;
