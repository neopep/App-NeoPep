-- CANDIDATA TESTE: aplicar somente após campaign_pause_test_candidate.sql.
-- Campanhas manuais com propriedade comprovada. Sem migração de proprietários.
begin;
set local lock_timeout='5s';
create function neo_private.campaign_manual_set_enabled(p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $fn$
declare actor uuid:=auth.uid(); cid uuid:=nullif(p_data->>'campaign_id','')::uuid;
 item neo_private.campaigns; enabled boolean; expected boolean;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(auth.jwt()->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1'
 then raise exception 'campaign_pause_admin_required' using errcode='42501';end if;
 if cid is null or jsonb_typeof(p_data->'enabled') is distinct from 'boolean'
 or jsonb_typeof(p_data->'expected_enabled') is distinct from 'boolean'
 or p_data->'confirmed' is distinct from 'true'::jsonb
 then raise exception 'campaign_pause_invalid' using errcode='22023';end if;
 enabled:=(p_data->>'enabled')::boolean;expected:=(p_data->>'expected_enabled')::boolean;
 if not pg_try_advisory_xact_lock(hashtextextended('neo-campaign-group-pause-v1',0))
 then raise exception 'campaign_pause_busy' using errcode='55000';end if;
 select * into item from neo_private.campaigns where id=cid and whatsapp_enabled and structured_review_only is not true
 and not popup_enabled and not push_requested and status<>'archived' for update;
 if not found or not exists(select 1 from neo_private.campaign_manual_ownership where campaign_id=cid and owner_id=actor and deleted_at is null)
 or exists(select 1 from neo_private.campaign_central_groups where campaign_id=cid)
 or exists(select 1 from neo_private.campaign_app_groups where campaign_id=cid)
 or exists(select 1 from neo_private.campaign_editor_versions where campaign_id=cid)
 then raise exception 'campaign_pause_owner_required' using errcode='42501';end if;
 if enabled=(item.status='active') and (enabled or item.status='paused') then return jsonb_build_object('enabled',enabled,'status',item.status,'reused',true);end if;
 if expected is distinct from (item.status='active') then raise exception 'campaign_pause_changed' using errcode='40001';end if;
 -- A reserva pode corresponder a WhatsApp já aberto no telefone. Não revogar.
 if exists(select 1 from neo_private.campaign_manual_claims c join neo_private.campaign_wa_publications p on p.id=c.publication_id
  where p.campaign_id=cid and c.state='reserved')
 or exists(select 1 from neo_private.campaign_wa_publications where campaign_id=cid and dispatch_state in ('waiting','leased','started','uncertain'))
 then raise exception 'campaign_pause_in_progress' using errcode='55000';end if;
 update neo_private.campaigns set status=case when enabled then 'active' else 'paused' end,updated_at=now()
 where id=cid returning * into item;
 insert into neo_private.campaign_group_pause_audit(campaign_id,owner_id,channel,enabled) values(cid,actor,'whatsapp',enabled);
 return jsonb_build_object('enabled',enabled,'status',item.status);
end;$fn$;
revoke all on function neo_private.campaign_manual_set_enabled(jsonb) from public,anon,authenticated;

do $patch$
declare d text; a text;
begin
 d:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 a:=$a$ if p_action='legacy_states' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_route_anchor';end if;
 d:=replace(d,a,$b$ if p_action='legacy_set_enabled' then return neo_private.campaign_manual_set_enabled(p_data);end if;
 if p_action='legacy_states' then$b$);
 a:=$a$'deleted',o.deleted_at is not null,'can_delete'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_states_anchor';end if;
 d:=replace(d,a,$b$'deleted',o.deleted_at is not null,'status',c.status,'can_toggle',o.owner_id=actor and o.deleted_at is null
      and c.whatsapp_enabled and c.status<>'archived' and c.structured_review_only is not true and not c.push_requested and not c.popup_enabled
      and not exists(select 1 from neo_private.campaign_central_groups g where g.campaign_id=c.id)
      and not exists(select 1 from neo_private.campaign_app_groups g where g.campaign_id=c.id)
      and not exists(select 1 from neo_private.campaign_editor_versions v where v.campaign_id=c.id),
      'can_delete'$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_manual_claim(text,uuid,jsonb)'::regprocedure);
 a:=$a$ select * into pub from neo_private.campaign_wa_publications$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_claim_anchor';end if;
 d:=replace(d,a,$b$ if p_action in ('reserve_manual','prepare') then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));end if;
 select * into pub from neo_private.campaign_wa_publications$b$);
 a:=$a$ if pub.status<>'pending' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_ineligible_anchor';end if;
 d:=replace(d,a,$b$ if p_action in ('reserve_manual','prepare') and exists(select 1 from neo_private.campaigns where id=pub.campaign_id and status in ('paused','archived'))
 then raise exception 'campaign_group_paused' using errcode='55000';end if;
 if pub.status<>'pending' then$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_wa_legacy(text,uuid,jsonb)'::regprocedure);
 a:=$a$ if p_action='groups' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_legacy_route_anchor';end if;
 d:=replace(d,a,$b$ if p_action in ('prepare','schedule','reminders') then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));end if;
 if p_action='groups' then$b$);
 a:=$a$c.status<>'archived'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'manual_pause_legacy_status_anchor';end if;
 d:=replace(d,a,$b$c.status not in ('paused','archived')$b$);
 a:=$a$where id=campaign and whatsapp_enabled and status<>'archived'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_legacy_schedule_anchor';end if;
 d:=replace(d,a,$b$where id=campaign and whatsapp_enabled and status not in ('paused','archived')$b$);
 a:=$a$case when p.status<>'pending' then p.status when p.scheduled_at is null then 'pending'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_legacy_queue_anchor';end if;
 d:=replace(d,a,$b$case when p.status<>'pending' then p.status when c.status='paused' then 'paused' when p.scheduled_at is null then 'pending'$b$);
 execute d;

 -- Preserve the existing admin endpoint; route verified manual ownership through the same guard.
 d:=pg_get_functiondef('public.neo_campaign_admin(text,uuid,jsonb)'::regprocedure);
 a:=$a$  next_status:=case p_action when 'activate' then 'active' when 'pause' then 'paused' else 'archived' end;$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'manual_pause_admin_anchor';end if;
 d:=replace(d,a,$b$  if p_action in ('activate','pause') and exists(select 1 from neo_private.campaign_manual_ownership where campaign_id=p_id and deleted_at is null) then
   perform neo_private.campaign_manual_set_enabled(jsonb_build_object('campaign_id',p_id,'enabled',p_action='activate','expected_enabled',item.status='active','confirmed',true));
   select * into strict item from neo_private.campaigns where id=p_id;
   return to_jsonb(item);
  end if;
  next_status:=case p_action when 'activate' then 'active' when 'pause' then 'paused' else 'archived' end;$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_shared_queue(jsonb)'::regprocedure);
 a:=$a$     when bool_or(m.state='waiting') and exists(select 1 from neo_private.campaign_wa_review$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_shared_rich_anchor';end if;
 d:=replace(d,a,$b$     when bool_or(m.state='waiting') and not neo_private.campaign_parent_enabled(b.editor_id,'whatsapp') then 'paused'
     when bool_or(m.state='waiting') and exists(select 1 from neo_private.campaign_wa_review$b$);
 a:=$a$     when p.dispatch_state='waiting' then case$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_shared_legacy_anchor';end if;
 d:=replace(d,a,$b$     when p.status='pending' and c.status='paused' then 'paused'
     when p.dispatch_state='waiting' then case$b$);
 execute d;
end;$patch$;
commit;
