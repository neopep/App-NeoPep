-- Apply after verified 0.2.27 candidate is approved for distribution.
-- Preserves all existing checks and 0.2.26 compatibility.
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
 if position($v$'0.2.27'$v$ in olddef)>0 then raise exception 'already patched: %',sig; end if;
 if position($v$'0.2.26')$v$ in olddef)=0 then raise exception 'allowlist mismatch: %',sig; end if;
 newdef:=replace(olddef,$v$'0.2.26')$v$,$v$'0.2.26','0.2.27')$v$);
 if newdef=olddef or replace(newdef,$v$,'0.2.27')$v$,')')<>olddef then raise exception 'unexpected change: %',sig; end if;
 execute newdef;
 changed:=changed+1;
 end loop;
 if changed<3 then raise exception 'incomplete patch'; end if;
end;$gate$;

do $native$
declare f regprocedure:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure; d text; a text; b text;
begin
 perform set_config('lock_timeout','5s',true);
 d:=pg_get_functiondef(f);
 a:=$a$d.version='0.2.26' and p_data->'native_video_v1'='true'::jsonb$a$;
 b:=$b$d.version in ('0.2.26','0.2.27') and p_data->'native_video_v1'='true'::jsonb$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'native_claim_changed';end if;
 d:=replace(d,a,b);
 a:=$a$d.version<>'0.2.26' or p_data->'native_video_v1' is distinct from 'true'::jsonb$a$;
 b:=$b$d.version not in ('0.2.26','0.2.27') or p_data->'native_video_v1' is distinct from 'true'::jsonb$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'native_start_changed';end if;
 d:=replace(d,a,b);
 a:=$a$d.version='0.2.26' and m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and p_data->>'blocked_reason'='video_conversion'$a$;
 b:=$b$d.version in ('0.2.26','0.2.27') and m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and p_data->>'blocked_reason'='video_conversion'$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'native_conversion_status_changed';end if;
 execute replace(d,a,b);
end;$native$;
