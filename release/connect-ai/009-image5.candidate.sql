-- CANDIDATA, NÃO ATIVAR antes de compilar/assinar/homologar o executor 0.2.16.
-- Testar separadamente em Teste e Produção. Não alterar filas nem enviar mensagens.
-- Flag image5_enabled permanece FALSE inclusive após instalar esta migração.
alter table neo_private.campaign_wa_rich_control add column image5_enabled boolean not null default false;
create function neo_private.campaign_image_limit(p_owner uuid,p_connection uuid)
returns integer language sql stable set search_path=pg_catalog as $$
 select case when coalesce((select image5_enabled from neo_private.campaign_wa_rich_control where singleton),false)
 and exists(select 1 from neo_private.connect_wa_connections c join neo_private.connect_devices d on d.id=c.device_id
 where c.id=p_connection and c.owner_id=p_owner and c.status='connected' and d.owner_id=p_owner
 and d.state='approved' and d.version='0.2.16' and d.last_seen>now()-interval '90 seconds')
 then 5242880 else 1048576 end
$$;
create function neo_private.campaign_image_job_supported(p_owner uuid,p_connection uuid,p_bucket text,p_path text,p_capability boolean)
returns boolean language sql stable set search_path=pg_catalog as $$
 select case when p_bucket is null or p_bucket not in ('neo-campaign-images','neo-shop-products') or p_path is null then true
 else exists(select 1 from storage.objects o where o.bucket_id=p_bucket and o.name=p_path
  and case when coalesce(o.metadata->>'size','')~'^[0-9]{1,9}$'
   then (o.metadata->>'size')::bigint between 4 and case when p_capability then neo_private.campaign_image_limit(p_owner,p_connection) else 1048576 end
   else false end) end
$$;
revoke all on function neo_private.campaign_image_limit(uuid,uuid),neo_private.campaign_image_job_supported(uuid,uuid,text,text,boolean) from public,anon,authenticated;
do $patch$
declare a text:=pg_get_functiondef('public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure);
 d text:=pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure);
 sig regprocedure; f text; n int; marker text;
begin
 if position($a$'max_image_bytes',1048576$a$ in a)=0 or position($a$between 4 and 1048576$a$ in a)=0 or position($a$between 1 and 1048576$a$ in a)=0 then raise exception 'image_limit_contract_mismatch';end if;
 a:=replace(a,$a$'max_image_bytes',1048576$a$,$a$'max_image_bytes',neo_private.campaign_image_limit(actor,t.connection_id)$a$);
 a:=replace(a,'between 4 and 1048576','between 4 and neo_private.campaign_image_limit(actor,t.connection_id)');
 a:=replace(a,'between 1 and 1048576','between 1 and neo_private.campaign_image_limit(actor,t.connection_id)');
 a:=replace(a,$a$'0.2.15')$a$,$a$'0.2.15','0.2.16')$a$);
 marker:='and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding';
 if (length(d)-length(replace(d,marker,'')))<>length(marker) then raise exception 'image_claim_marker_mismatch';end if;
 d:=replace(d,marker,$a$and neo_private.campaign_image_job_supported(actor,t.connection_id,job.media_bucket,job.media_path,coalesce(p_data->'image5_v1'='true'::jsonb,false))
    $a$||marker);
 marker:='if m.state<>''leased'' or (m.kind=''file''';
 if (length(d)-length(replace(d,marker,'')))<>length(marker) then raise exception 'image_start_marker_mismatch';end if;
 d:=replace(d,marker,$a$if not neo_private.campaign_image_job_supported(actor,t.connection_id,m.media_bucket,m.media_path,coalesce(p_data->'image5_v1'='true'::jsonb,false)) then return null;end if;
  $a$||marker);
 d:=replace(d,$a$when m.kind='file' then interval '120 seconds'$a$,$a$when m.kind='file' or m.media_bucket in ('neo-campaign-images','neo-shop-products') then interval '120 seconds'$a$);
 d:=replace(d,$a$'0.2.15')$a$,$a$'0.2.15','0.2.16')$a$);
 execute a;execute d;
 -- Other exact version lists vary by environment. Preserve all prior versions.
 for sig in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname,p.proname) in (('neo_private','campaign_wa_auto_rebind'),('public','neo_campaign_dispatch_device_v1'))
 and pg_get_functiondef(p.oid) like '%0.2.15%' loop
  f:=pg_get_functiondef(sig);
  if position($a$'0.2.15')$a$ in f)=0 then raise exception 'version_allowlist_mismatch';end if;
  execute replace(f,$a$'0.2.15')$a$,$a$'0.2.15','0.2.16')$a$);
 end loop;
end $patch$;
-- App popup still uses its independent 1 MiB gate. Update and test that path separately.
-- Release: only set image5_enabled=true after approved signed executor and boundary tests.
-- Rollback: set image5_enabled=false; large queued images stay blocked; do not resend or delete them.
