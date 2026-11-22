-- Envio imediato de mensagens privadas. O cron de um minuto continua como contingência.
begin;

create or replace function public.neo_support_push_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(642917126);
 delete from neo_private.support_push_jobs j using neo_private.support_messages m where j.message_id=m.id and m.created_at<now()-interval '1 day';
 insert into neo_private.support_push_jobs(device_id,message_id)
 select d.id,m.id from neo_private.push_devices d join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.support_messages m on m.sender_id is not null and m.sender_id<>d.user_id and m.created_at between now()-interval '10 minutes' and now() and m.created_at>=d.created_at join neo_private.support_threads t on t.id=m.thread_id
 where (t.user_id=d.user_id and m.seq>t.owner_seen) or ((t.assigned_to=d.user_id or (t.assigned_to is null and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)))) and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)) and m.seq>coalesce((select through_seq from neo_private.support_reads r where r.thread_id=t.id and r.user_id=d.user_id),0)) on conflict do nothing;
 with candidates as(select j.id from neo_private.support_push_jobs j join neo_private.push_devices d on d.id=j.device_id join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.support_messages m on m.id=j.message_id join neo_private.support_threads t on t.id=m.thread_id where not j.sent and j.attempts<3 and (j.lease_until is null or j.lease_until<now()) and m.sender_id is not null and m.created_at>=now()-interval '10 minutes' and ((t.user_id=d.user_id and m.seq>t.owner_seen) or ((t.assigned_to=d.user_id or t.assigned_to is null) and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)) and m.seq>coalesce((select through_seq from neo_private.support_reads r where r.thread_id=t.id and r.user_id=d.user_id),0))) order by m.created_at,j.id limit 20),
 claimed as(update neo_private.support_push_jobs j set attempts=attempts+1,lease_until=now()+interval '5 minutes' from candidates c where j.id=c.id returning j.id,j.device_id,j.message_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind','support','title','Mensagem de '||left(m.sender_alias,70),'body',left(regexp_replace(m.body,'[[:space:]]+',' ','g'),160))),'[]') into result from claimed j join neo_private.push_devices d on d.id=j.device_id join neo_private.support_messages m on m.id=j.message_id;
 return result;
end $$;

revoke all on function public.neo_support_push_claim() from public,anon,authenticated;
grant execute on function public.neo_support_push_claim() to service_role;

create or replace function neo_private.support_push_wake() returns trigger language plpgsql security definer set search_path=pg_catalog,extensions as $$
declare secret text;
begin
 if new.sender_id is null then return new;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='neo_push_cron_secret' limit 1;
 if secret is not null then
  perform net.http_post(
   url:='https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch',
   headers:=jsonb_build_object('Content-Type','application/json','x-neo-cron-secret',secret),
   body:='{"source":"message"}'::jsonb,
   timeout_milliseconds:=10000
  );
 end if;
 return new;
end $$;

revoke all on function neo_private.support_push_wake() from public,anon,authenticated;
drop trigger if exists neo_support_push_wake on neo_private.support_messages;
create trigger neo_support_push_wake after insert on neo_private.support_messages for each row execute function neo_private.support_push_wake();

notify pgrst,'reload schema';
commit;
