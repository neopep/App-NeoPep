-- Explicitly extend only existing campaign allowlists to the signed 0.2.19 release.
-- Keep 0.2.18 operational and preserve all group, owner, device and receipt checks.
begin;
set local lock_timeout='5s';
do $gate$
declare signature text; oid regprocedure; definition text; revised text; patched int:=0;
begin
 foreach signature in array array[
 'neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid)',
 'public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb)',
 'public.neo_campaign_rich_admin_v1(text,jsonb)',
 'public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'
 ] loop
  oid:=to_regprocedure(signature);
  if oid is null then
   if signature like 'public.neo_campaign_dispatch_device_v1%' then continue;end if;
   raise exception 'required_campaign_function_missing';
  end if;
  definition:=pg_get_functiondef(oid);
  if strpos(definition,$a$'0.2.19'$a$)>0 then raise exception 'version_already_present';end if;
  if strpos(definition,$a$'0.2.18'$a$)=0 then
   if signature like 'public.neo_campaign_dispatch_device_v1%' then continue;end if;
   raise exception 'version_contract_missing';
  end if;
  revised:=replace(replace(definition,$a$'0.2.18')$a$,$a$'0.2.18','0.2.19')$a$),$a$d.version<>'0.2.18'$a$,$a$d.version not in ('0.2.18','0.2.19')$a$);
  if revised=definition then raise exception 'version_contract_changed';end if;
  execute revised;patched:=patched+1;
 end loop;
 if patched<3 then raise exception 'incomplete_version_allowlist';end if;
end;$gate$;
commit;
