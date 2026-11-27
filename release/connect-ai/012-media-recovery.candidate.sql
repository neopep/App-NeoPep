-- Candidate 012. Never apply in Production. Persist the intended digest before POST.
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then raise exception 'wrong_environment';end if;
end $guard$;
alter table neo_private.connect_ai_media_tickets add column expected_sha256 text check(expected_sha256 ~ '^[a-f0-9]{64}$');
create function neo_private.connect_ai_media_recovery(p_connection uuid,p_owner uuid,p_ticket uuid,p_action text,p_digest text,p_lease uuid default null)
returns boolean language plpgsql security definer set search_path=pg_catalog as $fn$
declare t neo_private.connect_ai_media_tickets; bucket text; path text;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 if p_action is null or p_action not in ('bind','recover') or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'invalid_proof' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('connect-ai-media:'||p_ticket::text,0));
 select * into t from neo_private.connect_ai_media_tickets where id=p_ticket and connection_id=p_connection and owner_id=p_owner for update;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 if t.expires_at<=clock_timestamp() then return false;end if;
 if p_action='bind' then
  if t.state<>'uploading' or p_lease is null or t.lease_id is distinct from p_lease or t.lease_until is null or t.lease_until<=clock_timestamp() or (t.expected_sha256 is not null and t.expected_sha256<>p_digest) then return false;end if;
  update neo_private.connect_ai_media_tickets set expected_sha256=p_digest where id=p_ticket;
  return true;
 end if;
 if p_lease is not null or t.state<>'uncertain' or t.lease_id is not null or t.lease_until is not null or t.expected_sha256 is distinct from p_digest then return false;end if;
 bucket:=case when t.mime='image/jpeg' then 'neo-campaign-images' else 'neo-campaign-originals' end;
 path:=t.owner_id::text||'/'||t.id::text||case t.mime when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' when 'video/mp4' then '.mp4' end;
 if not exists(select 1 from storage.objects o where o.bucket_id=bucket and o.name=path and o.metadata->>'size'=t.size_bytes::text and o.metadata->>'mimetype'=t.mime) then return false;end if;
 update neo_private.connect_ai_media_tickets set state='stored',sha256=p_digest where id=p_ticket;
 return true;
end $fn$;
revoke all on function neo_private.connect_ai_media_recovery(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_media_recovery(uuid,uuid,uuid,text,text,uuid) to neo_connect_ai_broker;
