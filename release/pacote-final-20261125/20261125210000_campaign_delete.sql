begin;
set local lock_timeout='5s';
alter table neo_private.campaign_central_groups add column deleted_at timestamptz;
do $patch$
declare
 def text:=pg_get_functiondef(to_regprocedure('public.neo_campaign_central_v1(text,jsonb)'));
 anchor text;
begin
 anchor:='where g.owner_id=actor order by g.created_at desc,g.campaign_id';
 if def is null or (length(def)-length(replace(def,anchor,'')))<>length(anchor) then
  raise exception 'Contrato de listagem da Central divergente';
 end if;
 def:=replace(def,anchor,'where g.owner_id=actor and g.deleted_at is null order by g.created_at desc,g.campaign_id');
 anchor:=' if p_action=''rename'' then';
 if (length(def)-length(replace(def,anchor,'')))<>length(anchor) then
  raise exception 'Contrato de mutação da Central divergente';
 end if;
 def:=replace(def,anchor,$new$
 if p_action='delete' then
  if p_data->'confirmed' is distinct from 'true'::jsonb then
   raise exception 'campaign_delete_confirmation_required' using errcode='22023';
  end if;
  if parent.deleted_at is not null then return '{}'::jsonb; end if;
  -- The parent is already locked by the Central. Lock every publication before
  -- cancelling pending batches so the dispatch insert trigger serializes.
  perform 1 from neo_private.campaign_central_publications
   where campaign_id=campaign_key order by id for update;
  perform 1 from neo_private.campaign_wa_rich_messages m
   join neo_private.campaign_wa_rich_batches b on b.id=m.batch_id
   join neo_private.campaign_central_publications pub on pub.editor_id=b.editor_id
   where pub.campaign_id=campaign_key and m.state in ('waiting','leased','started')
   order by m.id for update of m;
  if exists(select 1 from neo_private.campaign_wa_rich_messages m
   join neo_private.campaign_wa_rich_batches b on b.id=m.batch_id
   join neo_private.campaign_central_publications pub on pub.editor_id=b.editor_id
   where pub.campaign_id=campaign_key and m.state='started') then
   raise exception 'campaign_delete_dispatch_in_progress' using errcode='55000';
  end if;
  -- Manual legacy dispatch has independent semantics. Fail closed if present.
  if exists(select 1 from neo_private.campaign_dispatch_batch b
   join neo_private.campaign_central_publications pub on pub.editor_id=b.editor_id
   join neo_private.campaign_wa_publications p on p.dispatch_batch=b.id
   where pub.campaign_id=campaign_key and p.dispatch_state in ('waiting','leased','started')) then
   raise exception 'campaign_delete_legacy_dispatch_pending' using errcode='55000';
  end if;
  with cancelled as (
   update neo_private.campaign_wa_rich_messages m
   set state='cancelled',lease_until=null
   from neo_private.campaign_wa_rich_batches b,neo_private.campaign_central_publications pub
   where m.batch_id=b.id and b.editor_id=pub.editor_id and pub.campaign_id=campaign_key
   and m.state in ('waiting','leased') returning m.id
  )
  insert into neo_private.campaign_wa_rich_audit(message_id,event)
   select id,'cancelled' from cancelled;
  update neo_private.campaign_central_groups set deleted_at=now(),archived_at=coalesce(archived_at,now())
   where campaign_id=campaign_key;
  insert into neo_private.campaign_central_events(campaign_id,actor_id,event)
   values(campaign_key,actor,'deleted');
  return '{}'::jsonb;
 end if;
 if parent.deleted_at is not null and p_action<>'load' then
  raise exception 'campaign_deleted' using errcode='55000';
 end if;
 if p_action='rename' then$new$);
 execute def;
end;
$patch$;
notify pgrst,'reload schema';
commit;
