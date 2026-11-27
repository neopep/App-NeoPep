-- Read-only inventory. Run in each project and compare before testing 009.
with installed as (
 select proname, prosrc, prosecdef, proconfig
 from pg_catalog.pg_proc
 where oid in (
  to_regprocedure('public.neo_campaign_rich_admin_v1(text,jsonb)'),
  to_regprocedure('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)')
 )
), markers(rpc, marker) as (values
 ('neo_campaign_rich_admin_v1', '''max_image_bytes'',1048576'),
 ('neo_campaign_rich_admin_v1', 'between 4 and 1048576'),
 ('neo_campaign_rich_admin_v1', 'between 1 and 1048576'),
 ('neo_campaign_rich_device_v1', 'and not exists(select 1 from neo_private.campaign_wa_rich_messages preceding'),
 ('neo_campaign_rich_device_v1', 'if m.state<>''leased'' or (m.kind=''file''')
)
select m.rpc, m.marker, md5(i.prosrc) as body_checksum,
 (length(i.prosrc)-length(replace(i.prosrc,m.marker,'')))/length(m.marker) as occurrences,
 i.prosecdef as security_definer, i.proconfig as settings
from markers m left join installed i on i.proname=m.rpc
order by m.rpc,m.marker;
