-- Teste candidate, not applied. Read historical evidence, never retry or modify objects/drafts.
do $guard$ begin
 if not exists(select 1 from neo_private.connect_ai_environment where project_ref='qnuluspqfazdppciermw') then raise exception 'wrong_environment';end if;
end $guard$;
create function neo_private.connect_ai_media_attachment_receipt(p_connection uuid,p_owner uuid,p_ticket uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare t neo_private.connect_ai_media_tickets; prev neo_private.campaign_editor_versions; saved neo_private.campaign_editor_versions;
 blocks jsonb; expected jsonb; path text; kind text; n integer; idx integer; fallback jsonb;
begin
 if not neo_private.connect_ai_job_check(p_connection,p_owner) then raise exception 'forbidden' using errcode='42501';end if;
 select * into t from neo_private.connect_ai_media_tickets where id=p_ticket and connection_id=p_connection and owner_id=p_owner;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 fallback:=jsonb_build_object('ticketId',t.id,'publicationId',t.publication_id,'state','unconfirmed');
 if t.state<>'stored' or t.sha256 is null or t.sha256 !~ '^[a-f0-9]{64}$' or t.revision<1 or t.channel not in ('app','whatsapp') or t.mime not in ('image/jpeg','application/pdf','video/mp4') or (t.channel='app' and t.mime<>'image/jpeg') then return fallback;end if;
 if not (case when t.channel='app' then exists(select 1 from neo_private.campaign_app_publications p where p.id=t.publication_id and p.campaign_id=t.campaign_id)
 else exists(select 1 from neo_private.campaign_central_publications p where p.id=t.publication_id and p.campaign_id=t.campaign_id and p.editor_id=t.publication_id and p.source_id=t.campaign_id) end) then return fallback;end if;
 select * into prev from neo_private.campaign_editor_versions where editor_id=t.publication_id and revision=t.revision and owner_id=p_owner and channel=t.channel and source_id=t.campaign_id;
 if not found or jsonb_typeof(prev.draft->'blocks') is distinct from 'array' then return fallback;end if;
 select * into saved from neo_private.campaign_editor_versions where request_id=t.id and editor_id=t.publication_id and revision=t.revision+1 and owner_id=p_owner and channel=t.channel and source_id=t.campaign_id;
 if not found then return fallback;end if;
 kind:=case when t.mime='image/jpeg' then 'image' else 'file' end;
 path:=p_owner::text||'/'||p_ticket::text||case t.mime when 'image/jpeg' then '.jpg' when 'application/pdf' then '.pdf' else '.mp4' end;
 blocks:=prev.draft->'blocks';
 select count(*),min((ord-1)::integer) into n,idx from jsonb_array_elements(blocks) with ordinality a(b,ord) where b->>'id'=t.block_id::text;
 if n>1 then return fallback;end if;
 if n=0 then
  if jsonb_array_length(blocks)>=32 then return fallback;end if;
  blocks:=blocks||jsonb_build_array(jsonb_build_object('id',t.block_id,'type',kind,'text','','media_path',path,'name',t.filename));
 else
  if blocks->idx->>'type' is distinct from kind then return fallback;end if;
  blocks:=jsonb_set(blocks,array[idx::text],(blocks->idx)||jsonb_build_object('media_path',path,'name',t.filename),false);
 end if;
 expected:=jsonb_set(prev.draft,'{blocks}',blocks,false);
 if saved.draft is distinct from expected then return fallback;end if;
 return jsonb_build_object('ticketId',t.id,'publicationId',t.publication_id,'state','attached_historically','revision',saved.revision);
end $fn$;
revoke all on function neo_private.connect_ai_media_attachment_receipt(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function neo_private.connect_ai_media_attachment_receipt(uuid,uuid,uuid) to neo_connect_ai_broker;
