-- Candidate only. Apply after 001 to the authorized Teste database.
begin;
create table neo_private.connect_ai_oauth_grants(
 digest text primary key check(digest ~ '^[0-9a-f]{64}$'),
 connection_id uuid not null references neo_private.connect_ai_connections(id) on delete cascade,
 kind text not null check(kind in ('code','refresh')),
 redirect_uri text,
 challenge text,
 expires_at timestamptz not null,
 used_at timestamptz,
 check((kind='code' and redirect_uri is not null and challenge ~ '^[A-Za-z0-9_-]{43}$' and challenge is not null)
    or (kind='refresh' and redirect_uri is null and challenge is null))
);
create index connect_ai_grants_connection_idx on neo_private.connect_ai_oauth_grants(connection_id);
alter table neo_private.connect_ai_oauth_grants enable row level security;
revoke all on neo_private.connect_ai_oauth_grants from public,anon,authenticated;

-- Only the trusted issuer/database adapter may call this (no public HTTP RPC).
create function neo_private.connect_ai_rotate_grant(
 p_digest text,p_kind text,p_client text,p_redirect text,p_challenge text,p_next text
) returns jsonb language plpgsql set search_path=pg_catalog as $$
declare g neo_private.connect_ai_oauth_grants; c neo_private.connect_ai_connections; t timestamptz;
begin
 if p_next is null or p_next !~ '^[0-9a-f]{64}$' or p_next=p_digest then return null; end if;
 select * into g from neo_private.connect_ai_oauth_grants where digest=p_digest and kind=p_kind;
 if not found then return null; end if;
 -- Serialize all exchanges and revocations for the same connection.
 select * into c from neo_private.connect_ai_connections where id=g.connection_id for update;
 t:=clock_timestamp();
 if not found or c.revoked_at is not null or c.expires_at<=t or c.client_id is distinct from p_client then return null; end if;
 select * into g from neo_private.connect_ai_oauth_grants where digest=p_digest and kind=p_kind;
 if not found or g.expires_at<=t or g.redirect_uri is distinct from p_redirect or g.challenge is distinct from p_challenge then return null; end if;
 if g.used_at is not null then
  if g.kind='refresh' then
   update neo_private.connect_ai_connections set revoked_at=t where id=c.id;
  end if;
  return null;
 end if;
 update neo_private.connect_ai_oauth_grants set used_at=t where digest=p_digest;
 insert into neo_private.connect_ai_oauth_grants(digest,connection_id,kind,expires_at)
 values(p_next,c.id,'refresh',least(c.expires_at,t+interval '7 days'));
 return jsonb_build_object('id',c.id,'ownerId',c.owner_id);
end $$;
revoke all on function neo_private.connect_ai_rotate_grant(text,text,text,text,text,text) from public,anon,authenticated;
commit;
