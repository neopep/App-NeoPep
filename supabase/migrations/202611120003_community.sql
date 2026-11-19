-- Additive, transactional. No clinical records or photographs are copied.
begin;
create table if not exists neo_private.community_members(user_id uuid primary key references auth.users(id) on delete cascade,alias text not null check(length(alias) between 2 and 40),joined_at timestamptz not null default now(),rules_version text not null default '2026-11-v1');
create table if not exists neo_private.community_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(body) between 3 and 2000),status text not null default 'pending' check(status in ('pending','published','rejected')),created_at timestamptz not null default now());
create table if not exists neo_private.community_materials(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 120),body text not null check(length(body) between 1 and 10000),url text not null default '' check(url='' or (length(url)<=2000 and url ~ '^https://[^/@[:space:]]+([/?#]|$)')),created_at timestamptz not null default now());
create table if not exists neo_private.community_reports(post_id uuid references neo_private.community_posts(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
alter table neo_private.community_members enable row level security;
alter table neo_private.community_posts enable row level security;
alter table neo_private.community_materials enable row level security;
alter table neo_private.community_reports enable row level security;
revoke all on neo_private.community_members,neo_private.community_posts,neo_private.community_materials,neo_private.community_reports from public,anon,authenticated;
create index if not exists neo_community_posts_status_date on neo_private.community_posts(status,created_at desc);
create or replace function public.neo_community(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); a boolean; member_alias text; result jsonb; pid uuid; b text;
begin
 if u is null then raise exception 'authentication required' using errcode='42501';end if;
 a:=public.neo_admin_access();
 select alias into member_alias from neo_private.community_members where user_id=u;
 if p_action='join' then
  if not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=u) then raise exception 'complete onboarding first';end if;
  if p_payload->>'agree'<>'on' or p_payload->>'agree' is null then raise exception 'community consent required';end if;
  perform neo_private.take_limit('community_join',10,3600);
  insert into neo_private.community_members(user_id,alias) values(u,trim(p_payload->>'alias')) on conflict(user_id) do nothing;
  return '{"ok":true}';
 end if;
 if p_action='read' and member_alias is null then return '{"member":false}';end if;
 if member_alias is null then raise exception 'community membership required' using errcode='42501';end if;
 if p_action='read' then
  return jsonb_build_object('member',true,'alias',member_alias,
   'posts',coalesce((select jsonb_agg(x) from(select p.id,p.body,p.status,p.created_at,m.alias,p.user_id=u as own from neo_private.community_posts p join neo_private.community_members m on m.user_id=p.user_id where p.status='published' or p.user_id=u order by p.created_at desc limit 100)x),'[]'::jsonb),
   'pending',case when a then coalesce((select jsonb_agg(x) from(select p.id,p.body,p.status,p.created_at,m.alias,p.user_id=u as own,(select count(*) from neo_private.community_reports r where r.post_id=p.id) as reports from neo_private.community_posts p join neo_private.community_members m on m.user_id=p.user_id where p.status='pending' or (p.status='published' and exists(select 1 from neo_private.community_reports r where r.post_id=p.id)) order by p.created_at limit 100)x),'[]'::jsonb) else '[]'::jsonb end,
   'materials',coalesce((select jsonb_agg(x) from(select id,title,body,url,created_at from neo_private.community_materials order by created_at desc limit 100)x),'[]'::jsonb));
 elsif p_action='export' then
  return jsonb_build_object('alias',member_alias,'posts',coalesce((select jsonb_agg(to_jsonb(p)-'user_id') from neo_private.community_posts p where user_id=u),'[]'::jsonb),'reports',coalesce((select jsonb_agg(jsonb_build_object('post_id',post_id,'created_at',created_at)) from neo_private.community_reports where user_id=u),'[]'::jsonb));
 elsif p_action='leave' then
  delete from neo_private.community_posts where user_id=u;delete from neo_private.community_reports where user_id=u;delete from neo_private.community_members where user_id=u;
 elsif p_action='post' then
  if p_payload->>'share' is distinct from 'on' then raise exception 'publication consent required';end if;
  perform neo_private.take_limit('community_post',10,3600);
  b:=trim(p_payload->>'body');if b is null then raise exception 'body required';end if;
  insert into neo_private.community_posts(user_id,body) values(u,b);
 elsif p_action='material' then
  if not a then raise exception 'administrator required' using errcode='42501';end if;
  perform neo_private.take_limit('community_material',30,3600);
  insert into neo_private.community_materials(title,body,url) values(trim(p_payload->>'title'),trim(p_payload->>'body'),coalesce(p_payload->>'url',''));
 elsif p_action in ('approve','reject','delete_material') then
  if not a then raise exception 'administrator required' using errcode='42501';end if;
  pid:=(p_payload->>'id')::uuid;
  if p_action='delete_material' then delete from neo_private.community_materials where id=pid;
  else update neo_private.community_posts set status=case when p_action='approve' then 'published' else 'rejected' end where id=pid;delete from neo_private.community_reports where post_id=pid;end if;
 elsif p_action='delete_post' then delete from neo_private.community_posts where id=(p_payload->>'id')::uuid and user_id=u;
 elsif p_action='report' then
  perform neo_private.take_limit('community_report',20,3600);
  insert into neo_private.community_reports(post_id,user_id) select id,u from neo_private.community_posts where id=(p_payload->>'id')::uuid and status='published' on conflict do nothing;
 else raise exception 'invalid community action';end if;
 return '{"ok":true}';
end $$;
revoke all on function public.neo_community(text,jsonb) from public,anon;
grant execute on function public.neo_community(text,jsonb) to authenticated;
commit;
