-- Candidate after campaign_app_draft_repeat_candidate.sql. No activation or dispatch.
begin;
set local lock_timeout='5s';
alter table neo_private.campaign_app_draft_series add column state text not null default 'drafts' check(state in ('drafts','cancelled','replaced'));
alter table neo_private.campaign_app_draft_series add column closed_at timestamptz,add column replacement_id uuid,add column closing_result jsonb;
create function neo_private.campaign_app_repeat_manage(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $manage$
declare actor uuid:=auth.uid(); cid uuid:=(p_data->>'campaign_id')::uuid; sid uuid:=(p_data->>'series_id')::uuid;
 req uuid:=(p_data->>'request_id')::uuid; parent neo_private.campaign_app_groups; series neo_private.campaign_app_draft_series;
 occ jsonb; pid uuid; b record; v jsonb; result jsonb; replacement jsonb; now_wall text:=to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI');
 closed integer:=0; retained integer:=0; cancelled integer:=0;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then raise exception 'app_series_admin_required' using errcode='42501';end if;
 select * into parent from neo_private.campaign_app_groups where campaign_id=cid and owner_id=actor and deleted_at is null for update;
 if not found then raise exception 'app_series_owner_required' using errcode='42501';end if;
 if p_action='repeat_list' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.request_id,'publication_id',s.source_id,'rule',s.rule,'state',s.state,'dates',(select jsonb_agg(x->>'date' order by x->>'date') from jsonb_array_elements(s.occurrences) x),'occurrences',s.occurrences,'replacement_id',s.replacement_id,'closing_result',s.closing_result) order by s.created_at desc) from neo_private.campaign_app_draft_series s where s.owner_id=actor and s.campaign_id=cid),'[]'::jsonb);
 end if;
 if p_action not in ('repeat_cancel','repeat_replace') or sid is null or p_data->'confirmed' is distinct from 'true'::jsonb or parent.archived_at is not null then raise exception 'app_series_confirmation_required' using errcode='22023';end if;
 select * into series from neo_private.campaign_app_draft_series where owner_id=actor and campaign_id=cid and request_id=sid for update;
 if not found then raise exception 'app_series_unavailable' using errcode='42501';end if;
 if series.state<>'drafts' then
  if (p_action='repeat_cancel' and series.state='cancelled') or (p_action='repeat_replace' and series.state='replaced' and series.replacement_id=req) then return series.closing_result||'{"reused":true}'::jsonb;end if;
  raise exception 'app_series_already_closed' using errcode='55000';
 end if;
 if p_action='repeat_replace' and (req is null or req=sid or (p_data->>'publication_id')::uuid is distinct from series.source_id) then raise exception 'app_series_replace_invalid' using errcode='22023';end if;
 for occ in select value from jsonb_array_elements(series.occurrences) loop
  pid:=(occ->>'publication_id')::uuid;
  -- Never rewrite or cancel a started occurrence, even if it has no receipt yet.
  if occ->>'date'<=now_wall or exists(select 1 from neo_private.campaign_app_official_batches b where b.editor_id=pid and b.owner_id=actor and b.starts_at<=now()) then retained:=retained+1;continue;end if;
  if not exists(select 1 from neo_private.campaign_app_publications p where p.id=pid and p.campaign_id=cid and p.deleted_at is null) then continue;end if;
  for b in select id from neo_private.campaign_app_official_batches where editor_id=pid and owner_id=actor and cancelled_at is null and starts_at>now() loop
   v:=neo_private.campaign_app_central('cancel',jsonb_build_object('campaign_id',cid,'publication_id',pid,'batch_id',b.id));
   if exists(select 1 from neo_private.campaign_app_official_batches x where x.id=b.id and x.cancelled_at is null) then raise exception 'app_series_cancel_unconfirmed';end if;
   cancelled:=cancelled+1;
  end loop;
  perform neo_private.campaign_app_central('delete_publication',jsonb_build_object('campaign_id',cid,'publication_id',pid,'confirmed',true));
  closed:=closed+1;
 end loop;
 if p_action='repeat_replace' then
  replacement:=neo_private.campaign_app_draft_repeat('repeat_drafts',p_data-'series_id');
  if replacement->'reused'='true'::jsonb then raise exception 'app_series_replace_request_conflict' using errcode='23505';end if;
 end if;
 result:=jsonb_build_object('closed',closed,'retained',retained,'cancelled_batches',cancelled,'replacement',replacement);
 update neo_private.campaign_app_draft_series set state=case when p_action='repeat_replace' then 'replaced' else 'cancelled' end,closed_at=now(),replacement_id=case when p_action='repeat_replace' then req end,closing_result=result where owner_id=actor and request_id=sid;
 return result;
end;$manage$;
revoke all on function neo_private.campaign_app_repeat_manage(text,jsonb) from public,anon,authenticated;
do $patch$
declare d text:=pg_get_functiondef('neo_private.campaign_app_central(text,jsonb)'::regprocedure);
 a constant text:=$a$ if p_action in ('repeat_capabilities','repeat_list','repeat_drafts') then$a$;
begin
 if cardinality(string_to_array(d,a))<>2 then raise exception 'app_series_manage_contract_changed';end if;
 execute replace(d,a,$a$ if p_action in ('repeat_list','repeat_cancel','repeat_replace') then
  return neo_private.campaign_app_repeat_manage(p_action,p_data);
 end if;
 if p_action in ('repeat_capabilities','repeat_drafts') then$a$);
end;$patch$;
commit;
