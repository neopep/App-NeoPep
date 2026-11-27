-- Apply in the target project after its 001 and shared 002. Bind a dedicated login to the NOLOGIN role separately.
begin;
create role neo_connect_ai_broker nologin;
create table neo_private.connect_ai_consent_claims (
 proof text primary key check (proof ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null
);
create table neo_private.connect_ai_sessions (
 connection_id uuid primary key references neo_private.connect_ai_connections(id) on delete cascade,
 iv text not null,
 ciphertext text not null,
 expires_at timestamptz not null
);
create index connect_ai_consent_expiry_idx on neo_private.connect_ai_consent_claims(expires_at);
create index connect_ai_sessions_expiry_idx on neo_private.connect_ai_sessions(expires_at);
alter table neo_private.connect_ai_consent_claims enable row level security;
alter table neo_private.connect_ai_sessions enable row level security;
revoke all on neo_private.connect_ai_consent_claims,neo_private.connect_ai_sessions from public,anon,authenticated;
grant usage on schema neo_private to neo_connect_ai_broker;
grant select on neo_private.connect_ai_environment to neo_connect_ai_broker;
create policy connect_ai_environment_broker on neo_private.connect_ai_environment for select to neo_connect_ai_broker using (true);
grant select,insert,delete on neo_private.connect_ai_consent_claims,neo_private.connect_ai_sessions to neo_connect_ai_broker;
grant select (id,owner_id,client_id,created_at,expires_at,revoked_at) on neo_private.connect_ai_connections to neo_connect_ai_broker;
grant select (digest,connection_id,kind),insert on neo_private.connect_ai_oauth_grants to neo_connect_ai_broker;
create policy connect_ai_claim_broker on neo_private.connect_ai_consent_claims to neo_connect_ai_broker using (true) with check (true);
create policy connect_ai_session_broker on neo_private.connect_ai_sessions to neo_connect_ai_broker using (true) with check (true);
create policy connect_ai_read_connections on neo_private.connect_ai_connections for select to neo_connect_ai_broker using (true);
create policy connect_ai_read_grants on neo_private.connect_ai_oauth_grants for select to neo_connect_ai_broker using (true);
create policy connect_ai_register_code on neo_private.connect_ai_oauth_grants for insert to neo_connect_ai_broker
 with check (kind='code' and used_at is null and expires_at<=clock_timestamp()+interval '2 minutes');
-- Existing rotation stays internal and receives the same minimum privileges as the callback.
alter function neo_private.connect_ai_rotate_grant(text,text,text,text,text,text) security definer;
grant execute on function neo_private.connect_ai_rotate_grant(text,text,text,text,text,text) to neo_connect_ai_broker;
commit;
