-- Aplicar exclusivamente em Teste, depois de connect-release-register.sql.
create table neo_private.connect_release_evidence (
 version text primary key references neo_private.connect_releases(version) on delete cascade,
 commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40}$'),
 run_id text not null check (run_id ~ '^[1-9][0-9]{0,19}$'),
 run_attempt text check (run_attempt ~ '^[1-9][0-9]{0,8}$'),
 artifact text not null,
 sha256 text not null,
 bytes bigint not null,
 verified_at timestamptz not null default now()
);
alter table neo_private.connect_release_evidence enable row level security;
revoke all on neo_private.connect_release_evidence from public,anon,authenticated;

create function public.neo_connect_release_stage(p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v text:=p_data->>'version'; r neo_private.connect_releases%rowtype; reused boolean:=false; evidence_inserted boolean;
begin
 if p_action='list' then
  return jsonb_build_object('releases',coalesce((select jsonb_agg(to_jsonb(x)) from
   (select version,profile,channel,bytes,sha256,artifact,release_signature,distribution_state
    from neo_private.connect_releases) x),'[]'::jsonb));
 end if;
 if p_action is distinct from 'register' or v is null or v !~ '^[0-9]{1,8}[.][0-9]{1,8}[.][0-9]{1,8}$'
  or p_data->>'profile' is distinct from 'staging' or p_data->>'channel' is distinct from 'stable'
  or coalesce(p_data->>'bytes','') !~ '^[1-9][0-9]{0,7}$' or (p_data->>'bytes')::bigint>52428800 then
  raise exception 'Rascunho inválido.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(208751192,1);
 select * into r from neo_private.connect_releases where version=v for update;
 if found then
  if r.distribution_state<>'draft' or r.profile<>'staging' or r.channel<>'stable' or r.path<>v||'/NeoPepConnectSetup.exe'
   or r.bytes is distinct from (p_data->>'bytes')::bigint or r.sha256 is distinct from p_data->>'sha256'
   or r.artifact is distinct from p_data->>'artifact' or r.release_signature is distinct from p_data->>'signature' then
   raise exception 'Versão divergente.' using errcode='23505';
  end if;
  reused:=true;
 elsif exists(select 1 from neo_private.connect_releases x where
   string_to_array(x.version,'.')::numeric[]>string_to_array(v,'.')::numeric[]) then
  return jsonb_build_object('ok',false,'code','release_version');
 else
  insert into neo_private.connect_releases(version,path,sha256,bytes,artifact,release_signature,notes,distribution_state)
  values(v,v||'/NeoPepConnectSetup.exe',p_data->>'sha256',(p_data->>'bytes')::bigint,p_data->>'artifact',p_data->>'signature','','draft');
 end if;
 insert into neo_private.connect_release_evidence(version,commit_sha,run_id,run_attempt,artifact,sha256,bytes)
 values(v,p_data->>'commit',p_data->>'run_id',p_data->>'attempt',p_data->>'artifact',p_data->>'sha256',(p_data->>'bytes')::bigint)
 on conflict(version) do nothing;
 evidence_inserted:=found;
 if not exists(select 1 from neo_private.connect_release_evidence e where version=v
   and commit_sha=p_data->>'commit' and run_id=p_data->>'run_id' and run_attempt is not distinct from p_data->>'attempt') then
  raise exception 'Proveniência divergente.' using errcode='23505';
 end if;
 if evidence_inserted then
  insert into neo_private.connect_audit(actor_id,event,release_version,release_result)
  values((p_data->>'actor')::uuid,'update_register',v,'ok');
 end if;
 return jsonb_build_object('ok',true,'reused',reused);
end $$;
revoke all on function public.neo_connect_release_stage(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_connect_release_stage(text,jsonb) to service_role;
