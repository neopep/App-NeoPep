-- Private member-to-mediation conversations. No group or health records are copied.
begin;
create table if not exists neo_private.support_threads(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id) on delete cascade,next_seq bigint not null default 0,owner_seen bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists neo_private.support_messages(id uuid primary key,thread_id uuid not null references neo_private.support_threads(id) on delete cascade,sender_id uuid not null references auth.users(id) on delete cascade,sender_alias text not null,sender_type text not null check(sender_type in ('member','team')),seq bigint not null,body text not null check(length(body) between 1 and 4000),created_at timestamptz not null default now(),unique(thread_id,seq));
create table if not exists neo_private.support_reads(thread_id uuid not null references neo_private.support_threads(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,through_seq bigint not null default 0,primary key(thread_id,user_id));
alter table neo_private.support_threads enable row level security;
alter table neo_private.support_messages enable row level security;
alter table neo_private.support_reads enable row level security;
revoke all on neo_private.support_threads,neo_private.support_messages,neo_private.support_reads from public,anon,authenticated;
create index if not exists neo_support_thread_order on neo_private.support_threads(updated_at desc);
create or replace function public.neo_support(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();moderator boolean;tid uuid;mid uuid;before_seq bigint;watermark bigint;body_text text;alias_text text;thread_owner uuid;rows jsonb;previous neo_private.support_messages;unread_count bigint;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'complete onboarding first';end if;
 moderator:=public.neo_admin_access();
 if p_action='list' then
  select coalesce(jsonb_agg(x),'[]'::jsonb) into rows from (
   select t.id,coalesce(nullif(left((regexp_split_to_array(btrim(p.data->'profile'->>'name'),'\s+'))[1],40),''),'Participante') as alias,t.updated_at,
    (select left(m.body,120) from neo_private.support_messages m where m.thread_id=t.id order by m.seq desc limit 1) as preview,
    (select count(*) from neo_private.support_messages m where m.thread_id=t.id and m.sender_id<>u and m.seq>case when moderator then coalesce((select through_seq from neo_private.support_reads r where r.thread_id=t.id and r.user_id=u),0) else t.owner_seen end) as unread
   from neo_private.support_threads t join public.neo_profiles p on p.user_id=t.user_id where moderator or t.user_id=u order by t.updated_at desc,t.id limit 200
  )x;
  return jsonb_build_object('is_moderator',moderator,'threads',rows);
 end if;
 tid:=nullif(p_payload->>'thread_id','')::uuid;
 if tid is null and not moderator and p_action in ('open','send') then
  insert into neo_private.support_threads(user_id) values(u) on conflict(user_id) do nothing;
  select id into tid from neo_private.support_threads where user_id=u;
 end if;
 select user_id,next_seq into thread_owner,watermark from neo_private.support_threads where id=tid;
 if thread_owner is null or (thread_owner<>u and not moderator) then raise exception 'conversation access denied' using errcode='42501';end if;
 if p_action='send' then
  body_text:=btrim(p_payload->>'body');mid:=(p_payload->>'id')::uuid;
  if body_text is null or length(body_text) not between 1 and 4000 or mid is null then raise exception 'invalid message';end if;
  -- Serialize writers in this thread, including an idempotent retry of a lost response.
  perform 1 from neo_private.support_threads where id=tid for update;
  select * into previous from neo_private.support_messages where id=mid;
  if found then
   if previous.thread_id=tid and previous.sender_id=u and previous.body=body_text then return jsonb_build_object('ok',true,'thread_id',tid,'id',mid);end if;
   raise exception 'message conflict';
  end if;
  perform neo_private.take_limit('support_send',60,60);
  select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into alias_text from public.neo_profiles where user_id=u;
  update neo_private.support_threads set next_seq=next_seq+1,updated_at=clock_timestamp() where id=tid returning next_seq into watermark;
  insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body) values(mid,tid,u,coalesce(nullif(alias_text,''),'Participante'),case when moderator then 'team' else 'member' end,watermark,body_text);
  return jsonb_build_object('ok',true,'thread_id',tid,'id',mid);
 elsif p_action='open' then
  before_seq:=coalesce((p_payload->>'before')::bigint,0);
  if before_seq<0 then raise exception 'invalid history cursor';end if;
  select coalesce(jsonb_agg(x order by x.seq),'[]'::jsonb) into rows from (
   select id,seq,body,created_at,sender_alias as alias,sender_type,sender_id=u as own from neo_private.support_messages where thread_id=tid and seq<=watermark and (before_seq=0 or seq<before_seq) order by seq desc limit 100
  )x;
  if before_seq=0 then
   if moderator then insert into neo_private.support_reads(thread_id,user_id,through_seq) values(tid,u,watermark) on conflict(thread_id,user_id) do update set through_seq=greatest(support_reads.through_seq,excluded.through_seq);
   else update neo_private.support_threads set owner_seen=greatest(owner_seen,watermark) where id=tid;end if;
  end if;
  select left((regexp_split_to_array(btrim(data->'profile'->>'name'),'\s+'))[1],40) into alias_text from public.neo_profiles where user_id=thread_owner;
  return jsonb_build_object('is_moderator',moderator,'thread_id',tid,'alias',coalesce(alias_text,'Participante'),'messages',rows,'has_more',exists(select 1 from neo_private.support_messages where thread_id=tid and seq<coalesce((rows->0->>'seq')::bigint,0)));
 else raise exception 'invalid support action';end if;
end $$;
create or replace function public.neo_support_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();result jsonb;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
  select t.id,t.created_at,(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'alias',m.sender_alias,'sender_type',m.sender_type,'created_at',m.created_at) order by m.seq),'[]'::jsonb) from neo_private.support_messages m where m.thread_id=t.id) as messages
  from neo_private.support_threads t where t.user_id=u
 )x;
 return result;
end $$;
revoke all on function public.neo_support_export() from public,anon;
grant execute on function public.neo_support_export() to authenticated;
revoke all on function public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_support(text,jsonb) to authenticated;
commit;
