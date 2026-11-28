-- STAGING ONLY. Encrypted one-shot consultation; no plaintext results. Default closed.
begin;
create table neo_private.group_view_gate_v1(singleton boolean primary key default true check(singleton),enabled boolean not null default false,approved_version text check(approved_version is null or approved_version ~ '^0[.]2[.][0-9]{2,3}$'),check(not enabled or approved_version is not null));
insert into neo_private.group_view_gate_v1(singleton) values(true);
alter table neo_private.group_view_gate_v1 enable row level security;
revoke all on neo_private.group_view_gate_v1 from public,anon,authenticated,service_role;
create table neo_private.group_view_requests_v1(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 session_id uuid not null references auth.sessions(id) on delete cascade,
 device_id uuid not null references neo_private.connect_devices(id) on delete cascade,
 connection_id uuid not null references neo_private.connect_wa_connections(id) on delete cascade,
 connection_revision bigint not null,group_jid text not null check(group_jid ~ '^[0-9-]{1,64}@g[.]us$'),
 kind text not null check(kind in ('members','messages')),
 browser_key text not null check(length(browser_key)=392 and browser_key ~ '^[A-Za-z0-9+/]+$'),
 fence uuid,state text not null default 'waiting' check(state in ('waiting','claimed','ready','denied')),
 encrypted_result jsonb,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '4 minutes',
 check((state='waiting' and fence is null) or (state<>'waiting' and fence is not null)),
 check((state='ready' and encrypted_result is not null) or (state<>'ready' and encrypted_result is null)));
alter table neo_private.group_view_requests_v1 enable row level security;
revoke all on neo_private.group_view_requests_v1 from public,anon,authenticated,service_role;
create function neo_private.group_view_scope_v1(p_owner uuid,p_device uuid,p_connection uuid,p_jid text,p_revision bigint)
returns boolean language sql stable set search_path=pg_catalog as $$
 select exists(select 1 from neo_private.connect_wa_connections c
 join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
 join neo_private.connect_wa_selected_groups g on g.connection_id=c.id and g.group_jid=p_jid
 join neo_private.group_view_gate_v1 v on v.singleton and v.enabled and v.approved_version=d.version
 join neo_private.campaign_wa_test_config t on t.singleton and t.enabled and t.owner_id=c.owner_id and t.connection_id=c.id and (t.group_jid is null or t.group_jid=g.group_jid)
 where c.owner_id=p_owner and c.device_id=p_device and c.id=p_connection and c.revision=p_revision
 and c.status='connected' and c.last_seen_at>now()-interval '5 minutes' and d.state='approved' and d.last_seen>now()-interval '90 seconds'
 and exists(select 1 from neo_private.admin_members a where a.user_id=p_owner))
$$;
create function neo_private.group_view_session_valid_v1(p_owner uuid,p_session uuid)
returns boolean language sql stable set search_path=pg_catalog as $$
 select exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=p_owner and (s.not_after is null or s.not_after>now()))
$$;
create function neo_private.group_view_browser_session_v1()
returns uuid language plpgsql stable set search_path=pg_catalog as $$
declare sid uuid; raw text:=auth.jwt()->>'session_id';
begin
 if auth.uid() is null or not neo_private.campaign_admin_allowed() or coalesce(raw,'') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Consulta não autorizada.' using errcode='42501';end if;
 sid:=raw::uuid;
 if not neo_private.group_view_session_valid_v1(auth.uid(),sid) then raise exception 'Sessão indisponível.' using errcode='42501';end if;
 return sid;
end $$;
create function neo_private.group_view_cipher_valid_v1(p jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
begin
 if jsonb_typeof(p) is distinct from 'object' then return false;end if;
 return coalesce(p-array['wrapped_key','iv','ciphertext']='{}'::jsonb
 and jsonb_typeof(p->'wrapped_key')='string' and length(p->>'wrapped_key')=344 and p->>'wrapped_key' ~ '^[A-Za-z0-9+/]+==$'
 and jsonb_typeof(p->'iv')='string' and p->>'iv' ~ '^[A-Za-z0-9+/]{16}$'
 and jsonb_typeof(p->'ciphertext')='string' and length(p->>'ciphertext') between 24 and 1048576
 and length(p->>'ciphertext')%4=0 and p->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$',false);
end $$;
revoke all on function neo_private.group_view_scope_v1(uuid,uuid,uuid,text,bigint),neo_private.group_view_session_valid_v1(uuid,uuid),neo_private.group_view_browser_session_v1(),neo_private.group_view_cipher_valid_v1(jsonb) from public,anon,authenticated,service_role;
create function public.neo_group_view_web_v1(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid(); sid uuid; c neo_private.connect_wa_connections; r neo_private.group_view_requests_v1; rid uuid; key text; kind_value text; jid text;
begin
 sid:=neo_private.group_view_browser_session_v1();
 if p_action='status' then return jsonb_build_object('enabled',coalesce((select enabled from neo_private.group_view_gate_v1 where singleton),false));end if;
 perform pg_advisory_xact_lock(hashtextextended('group_view:'||actor::text,0));
 delete from neo_private.group_view_requests_v1 where owner_id=actor and expires_at<=now();
 if p_action='request' then
  if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirmação obrigatória.' using errcode='42501';end if;
  kind_value:=p_data->>'kind';key:=p_data->>'browser_key';jid:=p_data->>'group_jid';
  if kind_value is null or kind_value not in ('members','messages') or length(coalesce(key,''))<>392 or key !~ '^[A-Za-z0-9+/]+$' or coalesce(jid,'') !~ '^[0-9-]{1,64}@g[.]us$'
  or coalesce(p_data->>'connection_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Consulta inválida.' using errcode='22023';end if;
  select * into c from neo_private.connect_wa_connections where id=(p_data->>'connection_id')::uuid and owner_id=actor for share;
  if not found or not neo_private.group_view_scope_v1(actor,c.device_id,c.id,jid,c.revision) then raise exception 'Grupo indisponível.' using errcode='42501';end if;
  if exists(select 1 from neo_private.group_view_requests_v1 where owner_id=actor) then raise exception 'Já existe uma consulta ativa.' using errcode='55000';end if;
  insert into neo_private.group_view_requests_v1(owner_id,session_id,device_id,connection_id,connection_revision,group_jid,kind,browser_key)
  values(actor,sid,c.device_id,c.id,c.revision,jid,kind_value,key) returning * into r;
  return jsonb_build_object('id',r.id,'state',r.state,'expires_at',r.expires_at);
 end if;
 if p_action not in ('poll','cancel') or coalesce(p_data->>'id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Consulta inválida.' using errcode='22023';end if;
 rid:=(p_data->>'id')::uuid;
 select * into r from neo_private.group_view_requests_v1 where id=rid and owner_id=actor and session_id=sid for update;
 if not found then return '{"state":"unavailable"}'::jsonb;end if;
 if p_action='cancel' or not neo_private.group_view_scope_v1(actor,r.device_id,r.connection_id,r.group_jid,r.connection_revision) then delete from neo_private.group_view_requests_v1 where id=rid;return '{"state":"unavailable"}'::jsonb;end if;
 if r.state='ready' then delete from neo_private.group_view_requests_v1 where id=rid;return jsonb_build_object('state','ready','result',r.encrypted_result);
 elsif r.state='denied' then delete from neo_private.group_view_requests_v1 where id=rid;return '{"state":"denied"}'::jsonb;end if;
 return jsonb_build_object('state',r.state,'expires_at',r.expires_at);
end $$;
create function public.neo_group_view_device_v1(p_action text,p_device uuid,p_secret text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid; r neo_private.group_view_requests_v1; rid uuid; cid uuid;
begin
 actor:=neo_private.connect_wa_assert_device(p_device,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('group_view:'||actor::text,0));
 delete from neo_private.group_view_requests_v1 where owner_id=actor and expires_at<=now();
 if coalesce(p_data->>'connection_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Conexão inválida.' using errcode='22023';end if;
 cid:=(p_data->>'connection_id')::uuid;
 if p_action='claim' then
  select * into r from neo_private.group_view_requests_v1 x where x.owner_id=actor and x.device_id=p_device and x.connection_id=cid and x.state='waiting'
   and neo_private.group_view_scope_v1(actor,p_device,cid,x.group_jid,x.connection_revision) and neo_private.group_view_session_valid_v1(actor,x.session_id) for update;
  if not found then return '{"state":"unavailable"}'::jsonb;end if;
  update neo_private.group_view_requests_v1 set state='claimed',fence=gen_random_uuid() where id=r.id returning * into r;
  return jsonb_build_object('id',r.id,'state',r.state,'fence',r.fence,'group_jid',r.group_jid,'kind',r.kind,'browser_key',r.browser_key,'expires_at',r.expires_at);
 end if;
 if p_action not in ('finish','deny') or coalesce(p_data->>'id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Consulta inválida.' using errcode='22023';end if;
 rid:=(p_data->>'id')::uuid;
 select * into r from neo_private.group_view_requests_v1 where id=rid and owner_id=actor and device_id=p_device and connection_id=cid and state='claimed' and fence::text=p_data->>'fence' for update;
 if not found then return '{"state":"unavailable"}'::jsonb;end if;
 if not neo_private.group_view_scope_v1(actor,p_device,cid,r.group_jid,r.connection_revision) or not neo_private.group_view_session_valid_v1(actor,r.session_id) then delete from neo_private.group_view_requests_v1 where id=rid;return '{"state":"unavailable"}'::jsonb;end if;
 if p_action='deny' then update neo_private.group_view_requests_v1 set state='denied' where id=rid;return '{"state":"denied"}'::jsonb;end if;
 if p_data->'confirmed' is distinct from 'true'::jsonb or not neo_private.group_view_cipher_valid_v1(p_data->'result') then raise exception 'Resultado inválido.' using errcode='22023';end if;
 update neo_private.group_view_requests_v1 set state='ready',encrypted_result=p_data->'result' where id=rid;
 return '{"state":"ready"}'::jsonb;
end $$;
revoke all on function public.neo_group_view_web_v1(text,jsonb),public.neo_group_view_device_v1(text,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_group_view_web_v1(text,jsonb),public.neo_group_view_device_v1(text,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
