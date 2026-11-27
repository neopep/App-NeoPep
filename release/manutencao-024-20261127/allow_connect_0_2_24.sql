-- Apply after verified 0.2.24 candidate is approved for distribution.
-- Preserves all existing checks and 0.2.23 compatibility.
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
 if position($v$'0.2.24'$v$ in olddef)>0 then raise exception 'already patched: %',sig; end if;
 if position($v$'0.2.23')$v$ in olddef)=0 then raise exception 'allowlist mismatch: %',sig; end if;
 newdef:=replace(olddef,$v$'0.2.23')$v$,$v$'0.2.23','0.2.24')$v$);
 if newdef=olddef or replace(newdef,$v$,'0.2.24')$v$,')')<>olddef then raise exception 'unexpected change: %',sig; end if;
 execute newdef;
 changed:=changed+1;
 end loop;
 if changed<3 then raise exception 'incomplete patch'; end if;
end;$gate$;
