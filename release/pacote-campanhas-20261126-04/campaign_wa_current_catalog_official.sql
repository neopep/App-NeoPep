-- Scope the interactive catalog to the current authorized connection only.
-- Preserve the private catalog and recipients lookup for history.
begin;
set local lock_timeout='5s';
do $patch$
declare d text; a constant text:=$a$from neo_private.campaign_wa_sync_catalog(owner) c);$a$;
begin
 d:=pg_get_functiondef('public.neo_campaign_wa_sync(text,uuid,jsonb)'::regprocedure);
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'wa_current_catalog_anchor_changed';end if;
 execute replace(d,a,$b$from neo_private.campaign_wa_sync_catalog(owner) c
   where c.state in ('eligible','stale') and exists(
    select 1 from neo_private.campaign_wa_official_config f
    where f.singleton and f.enabled and f.owner_id=owner
    and split_part(c.id,':',1)=f.connection_id::text
    and (f.group_jid is null or split_part(c.id,':',2)=f.group_jid)));$b$);
end;$patch$;
commit;
