-- Candidate for cpslafpzjtbpmoxxysaa. Requires the existing Campaign Central ACL.
begin;
create table neo_private.connect_ai_environment(
 project_ref text primary key check(project_ref='cpslafpzjtbpmoxxysaa')
);
insert into neo_private.connect_ai_environment values ('cpslafpzjtbpmoxxysaa');
alter table neo_private.connect_ai_environment enable row level security;
revoke all on neo_private.connect_ai_environment from public,anon,authenticated;
create table neo_private.connect_ai_connections(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null check(length(client_id) between 1 and 128),
 label text not null check(length(label) between 1 and 80),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 days',
 revoked_at timestamptz
);
alter table neo_private.connect_ai_connections enable row level security;
revoke all on neo_private.connect_ai_connections from public,anon,authenticated;
create index connect_ai_connections_owner_idx on neo_private.connect_ai_connections(owner_id,created_at desc);

create function public.neo_connect_ai_connections(p_action text,p_id uuid default null,p_client text default null,p_label text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); item neo_private.connect_ai_connections;
begin
 if actor is null or auth.jwt()->>'iss' is distinct from 'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1' then
  raise exception 'connect_ai_session_required' using errcode='42501';
 end if;
 -- Former administrators may still revoke their own connection.
 if p_action is distinct from 'revoke' and not coalesce(neo_private.campaign_admin_allowed(),false) then
  raise exception 'connect_ai_admin_required' using errcode='42501';
 end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(r)-'owner_id' order by r.created_at desc,r.id)
   from (select * from neo_private.connect_ai_connections where owner_id=actor order by created_at desc,id limit 100) r),'[]'::jsonb);
 elsif p_action='register' then
  insert into neo_private.connect_ai_connections(owner_id,client_id,label)
  values(actor,p_client,btrim(p_label)) returning * into item;
 elsif p_action='inspect' then
  select * into item from neo_private.connect_ai_connections where id=p_id and owner_id=actor;
 elsif p_action='revoke' then
  update neo_private.connect_ai_connections set revoked_at=coalesce(revoked_at,now())
  where id=p_id and owner_id=actor returning * into item;
 else raise exception 'connect_ai_invalid_operation' using errcode='22023';
 end if;
 if item.id is null then return null; end if;
 return to_jsonb(item)||jsonb_build_object('environment','production','resource','https://connect.neopep.com.br/mcp',
  'scopes',jsonb_build_array('campaigns:read'));
end $$;
revoke all on function public.neo_connect_ai_connections(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.neo_connect_ai_connections(text,uuid,text,text) to authenticated;
commit;
