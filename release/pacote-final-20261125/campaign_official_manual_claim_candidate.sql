-- Produção candidate: exclusive reservation of manual WhatsApp occurrences.
-- Never changes Connect worker ownership or grants access to another admin's synchronized destination.
begin;
set local lock_timeout='5s';
create table neo_private.campaign_manual_claims(
 id uuid primary key,
 publication_id uuid not null references neo_private.campaign_wa_publications(id),
 occurrence_at timestamptz not null,
 holder_id uuid not null references auth.users(id),
 state text not null default 'reserved' check(state in ('reserved','released','confirmed','cancelled')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create unique index campaign_manual_one_claim on neo_private.campaign_manual_claims(publication_id,occurrence_at) where state='reserved';
alter table neo_private.campaign_manual_claims enable row level security;
revoke all on neo_private.campaign_manual_claims from public,anon,authenticated;

create function neo_private.campaign_manual_claim(p_action text,p_id uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $claim$
declare actor uuid:=auth.uid(); pub neo_private.campaign_wa_publications; reservation neo_private.campaign_manual_claims;
 token uuid:=nullif(p_data->>'claim_id','')::uuid; result jsonb; occurrence timestamptz;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
 or coalesce(auth.jwt()->>'iss','')<>'https://cpslafpzjtbpmoxxysaa.supabase.co/auth/v1'
 then raise exception 'campaign_manual_claim_not_allowed' using errcode='42501';end if;
 if p_action='claim_capabilities' then return jsonb_build_object('enabled',true);end if;
 if p_action='claim_status' then
  return coalesce((select jsonb_agg(jsonb_build_object('publication_id',c.publication_id,'own',c.holder_id=actor,'reserved_at',c.created_at))
   from neo_private.campaign_manual_claims c join neo_private.campaign_wa_publications p on p.id=c.publication_id
   where c.state='reserved' and p.status='pending' and c.occurrence_at=coalesce(p.scheduled_at,'-infinity'::timestamptz)
   and not exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=p.group_id and t.owner_id<>actor)),'[]'::jsonb);
 end if;
 select * into pub from neo_private.campaign_wa_publications
  where id=case when p_action='prepare' then nullif(p_data->>'publication','')::uuid else p_id end for update;
 if not found or pub.dispatch_batch is not null or pub.dispatch_state in ('waiting','leased','started','accepted','uncertain')
 or exists(select 1 from neo_private.campaign_wa_sync_targets t where t.group_id=pub.group_id and t.owner_id<>actor)
 then raise exception 'campaign_manual_claim_ineligible' using errcode='42501';end if;
 if pub.status<>'pending' then raise exception 'campaign_manual_occurrence_finished' using errcode='55000';end if;
 occurrence:=coalesce(pub.scheduled_at,'-infinity'::timestamptz);
 if token is null or not (p_data ? 'expected_at') or pub.scheduled_at is distinct from (p_data->>'expected_at')::timestamptz
 then raise exception 'campaign_manual_claim_or_occurrence_required' using errcode='22023';end if;
 select * into reservation from neo_private.campaign_manual_claims c
  where c.publication_id=pub.id and c.occurrence_at=occurrence and c.state='reserved' for update;
 if p_action='reserve_manual' then
  if reservation.id is not null then
   if reservation.holder_id<>actor or reservation.id<>token then raise exception 'campaign_manual_reserved_elsewhere' using errcode='55000';end if;
  else
   insert into neo_private.campaign_manual_claims(id,publication_id,occurrence_at,holder_id) values(token,pub.id,occurrence,actor);
  end if;
  return jsonb_build_object('claim_id',token);
 end if;
 if reservation.id is null or reservation.id<>token or reservation.holder_id<>actor then raise exception 'campaign_manual_claim_required' using errcode='42501';end if;
 if p_action='release_manual' then
  if p_data->'not_sent' is distinct from 'true'::jsonb then raise exception 'campaign_manual_release_confirmation' using errcode='22023';end if;
  update neo_private.campaign_manual_claims set state='released',finished_at=now() where id=token;
  return jsonb_build_object('released',true);
 end if;
 if p_action='prepare' then
  if pub.campaign_id<>p_id then raise exception 'campaign_manual_claim_mismatch' using errcode='42501';end if;
  return neo_private.campaign_wa_legacy(p_action,p_id,p_data-'claim_id'-'expected_at');
 end if;
 if p_action in ('confirm','cancel') then
  result:=neo_private.campaign_wa_legacy(p_action,p_id,p_data-'claim_id');
  if result->'saved' is distinct from 'true'::jsonb then raise exception 'campaign_manual_confirmation_failed' using errcode='55000';end if;
  update neo_private.campaign_manual_claims set state=case when p_action='confirm' then 'confirmed' else 'cancelled' end,finished_at=now() where id=token;
  return result;
 end if;
 raise exception 'campaign_manual_claim_unknown_action' using errcode='22023';
end;$claim$;
revoke all on function neo_private.campaign_manual_claim(text,uuid,jsonb) from public,anon,authenticated;
do $patch$
declare definition text:=pg_get_functiondef('public.neo_campaign_wa(text,uuid,jsonb)'::regprocedure);
 anchor constant text:=$a$ return neo_private.campaign_wa_legacy(p_action,p_id,p_data);$a$;
begin
 if md5(definition) is distinct from 'd48fac218be3f2190d48a0e2049bd089' then raise exception 'official_manual_contract_changed';end if;
 if cardinality(string_to_array(definition,anchor))<>2 then raise exception 'campaign_manual_claim_unexpected_definition';end if;
 execute replace(definition,anchor,$b$ if p_action in ('claim_capabilities','claim_status','reserve_manual','release_manual','confirm','cancel')
 or (p_action='prepare' and p_data ? 'publication') then
  return neo_private.campaign_manual_claim(p_action,p_id,p_data);
 end if;
$b$||anchor);
end;$patch$;
commit;
