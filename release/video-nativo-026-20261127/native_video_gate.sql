-- Apply after verified build. Do not send/retry queued campaigns.
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 perform set_config('lock_timeout','5s',true);
 alter table neo_private.campaign_wa_rich_messages drop constraint campaign_wa_rich_messages_blocked_reason_check;
 alter table neo_private.campaign_wa_rich_messages add constraint campaign_wa_rich_messages_blocked_reason_check check(blocked_reason is null or blocked_reason in ('previous_421','video_conversion'));
 f:='public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$blocked_reason=case when outcome='refused' and d.version='0.2.25' and p_data->>'blocked_reason'='previous_421' and receipt is null then 'previous_421' else null end$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'blocked_contract_changed';end if;
 b:=$b$blocked_reason=case when outcome='refused' and receipt is null and ((d.version in ('0.2.25','0.2.26') and p_data->>'blocked_reason'='previous_421') or (d.version='0.2.26' and m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and p_data->>'blocked_reason'='video_conversion')) then p_data->>'blocked_reason' else null end$b$;
 d:=replace(d,a,b);
 -- Guard both claim and start: older clients may still send PDFs/text but must not dispatch videos.
 a:=$a$    and (job.kind<>'file' or exists(select 1 from storage.objects o$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'claim_contract_changed';end if;
 b:=$b$    and (job.kind<>'file' or job.original_mime not in ('video/mp4','video/quicktime') or (d.version='0.2.26' and p_data->'native_video_v1'='true'::jsonb))
$b$;
 d:=replace(d,a,b||a);
 a:=$a$ if m.kind='file' and not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-originals' and o.name=m.media_path$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'start_contract_changed';end if;
 b:=$b$ if m.kind='file' and m.original_mime in ('video/mp4','video/quicktime') and (d.version<>'0.2.26' or p_data->'native_video_v1' is distinct from 'true'::jsonb) then raise exception 'native_video_required' using errcode='42501';end if;
$b$;
 execute replace(d,a,b||a);
 f:='public.neo_campaign_rich_admin_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$case when m.state='refused' and m.blocked_reason='previous_421' then 'paused_previous_421'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'projection_contract_changed';end if;
 execute replace(d,a,a||$b$
     when m.state='refused' and m.blocked_reason='video_conversion' then 'video_conversion_failed'$b$);
 f:='public.neo_campaign_central_v1(text,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 a:=$a$       'blocked_reason','previous_421',$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_contract_changed';end if;
 b:=$b$       'video_conversion_count',(select count(*) from neo_private.campaign_wa_rich_messages m where m.batch_id=b.id and m.owner_id=actor and m.state='refused' and m.blocked_reason='video_conversion'),$b$;
 d:=replace(d,a,b);
 a:=$a$          count(*) filter(where m.state='refused' and m.blocked_reason='previous_421') as blocked_count,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'central_group_contract_changed';end if;
 execute replace(d,a,a||$b$
          count(*) filter(where m.state='refused' and m.blocked_reason='video_conversion') as video_conversion_count,$b$);
end;$patch$;
