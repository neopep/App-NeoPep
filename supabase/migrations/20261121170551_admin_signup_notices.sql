begin;

-- Auth already records account creation. Keep one rollout boundary and individual
-- receipts without copying personal fields or adding a trigger to Auth.
create table neo_private.signup_notice_rollout (
 singleton boolean primary key default true check (singleton),
 started_at timestamptz not null default statement_timestamp()
);
insert into neo_private.signup_notice_rollout default values;

create table neo_private.signup_notice_reads (
 admin_id uuid not null references auth.users(id) on delete cascade,
 signup_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null,
 primary key (admin_id, signup_id)
);
create index signup_notice_reads_signup_idx on neo_private.signup_notice_reads(signup_id);
alter table neo_private.signup_notice_rollout enable row level security;
alter table neo_private.signup_notice_reads enable row level security;
revoke all on neo_private.signup_notice_rollout, neo_private.signup_notice_reads from public, anon, authenticated;

create function public.neo_admin_signups(
 p_action text, p_query text default '', p_new boolean default false,
 p_from timestamptz default null, p_until timestamptz default null,
 p_before timestamptz default null, p_before_id uuid default null,
 p_batch timestamptz default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
 caller uuid := auth.uid();
 started timestamptz;
 batch_at timestamptz;
 total bigint;
 latest uuid[];
 payload jsonb;
 needle text := lower(btrim(coalesce(p_query,'')));
begin
 -- The panel also recognizes community moderators. Individual account details
 -- require a platform administrator, using the existing membership table.
 if caller is null or not public.neo_admin_access() or not exists (
  select 1 from neo_private.admin_members a where a.user_id = caller
 ) then
  raise exception 'Acesso de administrador obrigatório.' using errcode = '42501';
 end if;
 select r.started_at into started from neo_private.signup_notice_rollout r;

 if p_action = 'count' then
  select count(*) into total from auth.users u
  where u.created_at >= started and u.deleted_at is null and not coalesce(u.is_anonymous,false)
   and not exists (select 1 from neo_private.signup_notice_reads r where r.admin_id=caller and r.signup_id=u.id);
  return jsonb_build_object('count',total);
 end if;

 if p_action = 'open' then
  batch_at := clock_timestamp();
  with marked as (
   insert into neo_private.signup_notice_reads(admin_id,signup_id,read_at)
   select caller,u.id,batch_at from auth.users u
   where u.created_at >= started and u.deleted_at is null and not coalesce(u.is_anonymous,false)
    and not exists (select 1 from neo_private.signup_notice_reads r where r.admin_id=caller and r.signup_id=u.id)
   order by u.id
   on conflict (admin_id,signup_id) do nothing
   returning signup_id
  )
  select coalesce(max(n),0),coalesce(array_agg(id order by created_at desc,id desc),'{}'::uuid[]) into total,latest
  from (select u.id,u.created_at,count(*) over () n from marked m join auth.users u on u.id=m.signup_id
   order by u.created_at desc,u.id desc limit 5) newest;
 elsif p_action is distinct from 'page' or length(needle)>120
  or (p_before is null) <> (p_before_id is null)
  or (p_from is not null and p_until is not null and p_from >= p_until) then
  raise exception 'Filtros de cadastro inválidos.' using errcode = '22023';
 end if;

 select coalesce(jsonb_agg(to_jsonb(result) order by result.created_at desc,result.id desc),'[]'::jsonb)
 into payload from (
  select u.id,u.email,u.created_at,greatest(u.last_sign_in_at,a.last_seen) as last_access,
   names.full_name,
   case u.raw_app_meta_data->>'provider' when 'email' then 'email' when 'google' then 'google' when 'apple' then 'apple' end as provider,
   (u.created_at >= started and (r.read_at is null or r.read_at = coalesce(batch_at,p_batch))) as is_new
  from auth.users u
  left join public.neo_profiles p on p.user_id=u.id
  left join neo_private.activity a on a.user_id=u.id
  left join neo_private.signup_notice_reads r on r.admin_id=caller and r.signup_id=u.id
  cross join lateral (select left(coalesce(nullif(btrim(p.data#>>'{profile,name}'),''),
   nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
   nullif(btrim(u.raw_user_meta_data->>'name'),'')),160) as full_name) names
  where u.created_at is not null and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and ((p_action='open' and u.id=any(latest)) or (p_action='page'
   and (p_from is null or u.created_at>=p_from) and (p_until is null or u.created_at<p_until)
   and (p_before is null or (u.created_at,u.id)<(p_before,p_before_id))
   and (not coalesce(p_new,false) or (u.created_at>=started and (r.read_at is null or r.read_at=p_batch)))
   and (needle='' or strpos(lower(coalesce(names.full_name,'')),needle)>0 or strpos(lower(coalesce(u.email,'')),needle)>0)))
  order by u.created_at desc,u.id desc limit 21
 ) result;

 if p_action='open' then
  return jsonb_build_object('read_count',total,'batch',batch_at,'rows',payload);
 end if;
 return jsonb_build_object('rows',payload);
end $$;

revoke all on function public.neo_admin_signups(text,text,boolean,timestamptz,timestamptz,timestamptz,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.neo_admin_signups(text,text,boolean,timestamptz,timestamptz,timestamptz,uuid,timestamptz) to authenticated;
commit;
