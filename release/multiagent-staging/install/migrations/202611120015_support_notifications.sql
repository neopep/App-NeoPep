-- Private support push queue. Payloads never contain message text, names or attachments.
begin;
create table if not exists neo_private.support_push_jobs(id uuid primary key default gen_random_uuid(),device_id uuid not null references neo_private.push_devices(id) on delete cascade,message_id uuid not null references neo_private.support_messages(id) on delete cascade,sent boolean not null default false,attempts int not null default 0,lease_until timestamptz,unique(device_id,message_id));
alter table neo_private.support_push_jobs enable row level security;
revoke all on neo_private.support_push_jobs from public,anon,authenticated;
create or replace function public.neo_support_push_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$declare result jsonb;begin
 perform pg_advisory_xact_lock(642917126);
 delete from neo_private.support_push_jobs j using neo_private.support_messages m where j.message_id=m.id and m.created_at<now()-interval '1 day';
 insert into neo_private.support_push_jobs(device_id,message_id)
 select d.id,m.id from neo_private.push_devices d join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.support_messages m on m.sender_id<>d.user_id and m.created_at between now()-interval '10 minutes' and now() and m.created_at>=d.created_at join neo_private.support_threads t on t.id=m.thread_id
 where (t.user_id=d.user_id and m.seq>t.owner_seen) or ((t.assigned_to=d.user_id or (t.assigned_to is null and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)))) and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)) and m.seq>coalesce((select through_seq from neo_private.support_reads r where r.thread_id=t.id and r.user_id=d.user_id),0)) on conflict do nothing;
 with candidates as(select j.id from neo_private.support_push_jobs j join neo_private.push_devices d on d.id=j.device_id join neo_private.community_preferences pref on pref.user_id=d.user_id and pref.push_enabled join neo_private.support_messages m on m.id=j.message_id join neo_private.support_threads t on t.id=m.thread_id where not j.sent and j.attempts<3 and (j.lease_until is null or j.lease_until<now()) and m.created_at>=now()-interval '10 minutes' and ((t.user_id=d.user_id and m.seq>t.owner_seen) or ((t.assigned_to=d.user_id or t.assigned_to is null) and (exists(select 1 from neo_private.admin_members a where a.user_id=d.user_id) or exists(select 1 from neo_private.community_moderators a where a.user_id=d.user_id)) and m.seq>coalesce((select through_seq from neo_private.support_reads r where r.thread_id=t.id and r.user_id=d.user_id),0))) order by m.created_at,j.id limit 20),claimed as(update neo_private.support_push_jobs j set attempts=attempts+1,lease_until=now()+interval '5 minutes' from candidates c where j.id=c.id returning j.id,j.device_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind','support')),'[]') into result from claimed j join neo_private.push_devices d on d.id=j.device_id;return result;end $$;
create or replace function public.neo_support_push_finish(p_id uuid,p_outcome text) returns void language plpgsql security definer set search_path=pg_catalog as $$begin
 if p_outcome='gone' then delete from neo_private.push_devices where id=(select device_id from neo_private.support_push_jobs where id=p_id);
 elsif p_outcome='sent' then update neo_private.support_push_jobs set sent=true where id=p_id;
 elsif p_outcome<>'retry' then raise exception 'invalid outcome';end if;end $$;
revoke all on function public.neo_support_push_claim(),public.neo_support_push_finish(uuid,text) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_support_push_claim(),public.neo_support_push_finish(uuid,text) to service_role';end if;end $$;
notify pgrst,'reload schema';
commit;
