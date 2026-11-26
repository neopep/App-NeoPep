-- CANDIDATA TESTE ONLY; NÃO aplicar automaticamente. Não publica mensagens.
-- Pausa reversível das centrais estruturadas WhatsApp/App.
-- Requer revisão e ensaio em banco descartável antes de apply_migration.
begin;
set local lock_timeout='5s';
alter table neo_private.campaign_central_groups add column paused_at timestamptz;
alter table neo_private.campaign_app_groups add column paused_at timestamptz;
create table neo_private.campaign_group_pause_audit(
 id bigint generated always as identity primary key,
 campaign_id uuid not null references neo_private.campaigns(id),
 owner_id uuid not null references auth.users(id) on delete cascade,
 channel text not null check(channel in ('whatsapp','app')),
 enabled boolean not null, recorded_at timestamptz not null default now()
);
alter table neo_private.campaign_group_pause_audit enable row level security;
revoke all on neo_private.campaign_group_pause_audit from public,anon,authenticated;

create function neo_private.campaign_parent_enabled(p_editor uuid,p_channel text) returns boolean
language sql stable security invoker set search_path='' as $enabled$
 select case p_channel when 'whatsapp' then not exists(
  select 1 from neo_private.campaign_central_publications p join neo_private.campaign_central_groups g on g.campaign_id=p.campaign_id
  where p.editor_id=p_editor and (g.paused_at is not null or g.archived_at is not null or g.deleted_at is not null or p.deleted_at is not null))
 when 'app' then not exists(
  select 1 from neo_private.campaign_app_publications p join neo_private.campaign_app_groups g on g.campaign_id=p.campaign_id
  where p.id=p_editor and (g.paused_at is not null or g.archived_at is not null or g.deleted_at is not null or p.deleted_at is not null))
 else false end
$enabled$;
revoke all on function neo_private.campaign_parent_enabled(uuid,text) from public,anon,authenticated;

create function neo_private.campaign_group_set_enabled(p_channel text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $pause$
declare actor uuid:=auth.uid(); cid uuid:=nullif(p_data->>'campaign_id','')::uuid;
 enabled boolean; expected boolean; previous timestamptz; parent_archived timestamptz; parent_deleted timestamptz;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) or
  coalesce(auth.jwt()->>'iss','')<>'https://qnuluspqfazdppciermw.supabase.co/auth/v1' then raise exception 'campaign_pause_admin_required' using errcode='42501';end if;
 if p_channel not in ('whatsapp','app') or cid is null or jsonb_typeof(p_data->'enabled') is distinct from 'boolean'
  or jsonb_typeof(p_data->'expected_enabled') is distinct from 'boolean' or p_data->'confirmed' is distinct from 'true'::jsonb
 then raise exception 'campaign_pause_invalid' using errcode='22023';end if;
 enabled:=(p_data->>'enabled')::boolean;expected:=(p_data->>'expected_enabled')::boolean;
 -- Claim/start and this mutation serialize. Never revoke a live lease or retry an uncertain delivery.
 if not pg_try_advisory_xact_lock(hashtextextended('neo-campaign-group-pause-v1',0)) then
  raise exception 'campaign_pause_busy' using errcode='55000';end if;
 if p_channel='whatsapp' then
  select paused_at,archived_at,deleted_at into previous,parent_archived,parent_deleted
  from neo_private.campaign_central_groups where campaign_id=cid and owner_id=actor for update;
 else
  select paused_at,archived_at,deleted_at into previous,parent_archived,parent_deleted
  from neo_private.campaign_app_groups where campaign_id=cid and owner_id=actor for update;
 end if;
 if not found or parent_archived is not null or parent_deleted is not null then
  raise exception 'campaign_pause_owner_required' using errcode='42501';end if;
 if enabled=(previous is null) then return jsonb_build_object('enabled',enabled,'paused_at',previous,'reused',true);end if;
 if expected is distinct from (previous is null) then raise exception 'campaign_pause_changed' using errcode='40001';end if;
 if p_channel='whatsapp' then
  -- Serialize against batch inserts through campaign_central_guard.
  perform 1 from neo_private.campaign_central_publications where campaign_id=cid order by id for update;
  if exists(select 1 from neo_private.campaign_central_publications p
   join neo_private.campaign_wa_rich_batches b on b.editor_id=p.editor_id
   join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
   where p.campaign_id=cid and m.state in ('leased','started'))
   or exists(select 1 from neo_private.campaign_central_publications p
   join neo_private.campaign_dispatch_batch b on b.editor_id=p.editor_id
   join neo_private.campaign_wa_publications m on m.dispatch_batch=b.id
   where p.campaign_id=cid and m.dispatch_state in ('waiting','leased','started','uncertain'))
  then raise exception 'campaign_pause_in_progress' using errcode='55000';end if;
  if enabled and exists(select 1 from neo_private.campaign_central_publications p
   join neo_private.campaign_wa_rich_batches b on b.editor_id=p.editor_id
   join neo_private.campaign_wa_rich_messages m on m.batch_id=b.id
   where p.campaign_id=cid and b.cancelled_at is null and m.state='waiting' and m.due_at<=now())
  then raise exception 'campaign_pause_overdue' using errcode='55000';end if;
  update neo_private.campaign_central_groups set paused_at=case when enabled then null else now() end where campaign_id=cid returning paused_at into previous;
 else
  -- Teste App has no push lane. Existing displays are historical; future reads use eligibility below.
  update neo_private.campaign_app_groups set paused_at=case when enabled then null else now() end where campaign_id=cid returning paused_at into previous;
 end if;
 insert into neo_private.campaign_group_pause_audit(campaign_id,owner_id,channel,enabled) values(cid,actor,p_channel,enabled);
 return jsonb_build_object('enabled',enabled,'paused_at',previous);
end;$pause$;
revoke all on function neo_private.campaign_group_set_enabled(text,jsonb) from public,anon,authenticated;

-- Exact anchors: fail atomically if live function definitions have drifted.
do $patch$
declare d text; a text; v text;
begin
 d:=pg_get_functiondef('public.neo_campaign_central_v1(text,jsonb)'::regprocedure);
 a:=$a$ if p_action='shared_queue' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_central_route_anchor';end if;
 d:=replace(d,a,$b$ if p_action='pause_capabilities' then return jsonb_build_object('enabled',true,'structured_only',true);end if;
 if p_action='set_enabled' then return neo_private.campaign_group_set_enabled('whatsapp',p_data);end if;
 if p_action='shared_queue' then$b$);
 a:='g.campaign_id,g.created_at,g.archived_at,c.title';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_central_list_anchor';end if;
 d:=replace(d,a,'g.campaign_id,g.created_at,g.archived_at,g.paused_at,c.title');
 a:=$a$'archived_at',parent.archived_at,'default_destination'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_central_get_anchor';end if;
 d:=replace(d,a,$b$'archived_at',parent.archived_at,'paused_at',parent.paused_at,'default_destination'$b$);
 a:=$a$ if p_action in ('schedule','publish') then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_central_schedule_anchor';end if;
 d:=replace(d,a,$b$ if p_action in ('schedule','publish') then
  if parent.paused_at is not null then raise exception 'campaign_group_paused' using errcode='55000';end if;$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_app_central(text,jsonb)'::regprocedure);
 a:=$a$ if p_action='list' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_app_route_anchor';end if;
 d:=replace(d,a,$b$ if p_action='pause_capabilities' then return jsonb_build_object('enabled',true,'structured_only',true);end if;
 if p_action='set_enabled' then return neo_private.campaign_group_set_enabled('app',p_data);end if;
 if p_action='list' then$b$);
 a:='g.campaign_id,g.created_at,g.archived_at,c.title';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_app_list_anchor';end if;
 d:=replace(d,a,'g.campaign_id,g.created_at,g.archived_at,g.paused_at,c.title');
 a:=$a$'archived_at',parent.archived_at,$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_app_get_anchor';end if;
 d:=replace(d,a,$b$'archived_at',parent.archived_at,'paused_at',parent.paused_at,$b$);
 a:=$a$ if p_action in ('schedule','publish') then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_app_schedule_anchor';end if;
 d:=replace(d,a,$b$ if p_action in ('schedule','publish') then
  if parent.paused_at is not null then raise exception 'campaign_group_paused' using errcode='55000';end if;$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_central_guard()'::regprocedure);
 a:=$a$ if linked.deleted_at is not null then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_rich_insert_anchor';end if;
 d:=replace(d,a,$b$ if tg_table_name='campaign_wa_rich_batches' and not neo_private.campaign_parent_enabled(linked.editor_id,'whatsapp') then
  raise exception 'campaign_group_paused' using errcode='55000';end if;
 if linked.deleted_at is not null then$b$);
 execute d;

 d:=pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure);
 a:=$a$ if p_action='claim' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_worker_claim_anchor';end if;
 d:=replace(d,a,$b$ if p_action='claim' then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));$b$);
 a:=$a$and b.cancelled_at is null and job.state='waiting' and job.due_at<=now()$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_worker_filter_anchor';end if;
 d:=replace(d,a,$b$and b.cancelled_at is null and job.state='waiting' and job.due_at<=now()
    and neo_private.campaign_parent_enabled(b.editor_id,'whatsapp')$b$);
 a:=$a$ if p_action='start' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_worker_start_anchor';end if;
 d:=replace(d,a,$b$ if p_action='start' then
  perform pg_advisory_xact_lock_shared(hashtextextended('neo-campaign-group-pause-v1',0));
  if exists(select 1 from neo_private.campaign_wa_rich_batches b where b.id=m.batch_id and not neo_private.campaign_parent_enabled(b.editor_id,'whatsapp')) then return null;end if;$b$);
 execute d;

 d:=pg_get_functiondef('neo_private.campaign_test_popup_eligible(neo_private.campaign_test_batches,timestamptz)'::regprocedure);
 a:=$a$select b.cancelled_at is null and b.starts_at<=p_now$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'pause_app_popup_anchor';end if;
 d:=replace(d,a,$b$select neo_private.campaign_parent_enabled(b.editor_id,'app') and b.cancelled_at is null and b.starts_at<=p_now$b$);
 execute d;
end;$patch$;

-- Block direct App batch insert, even outside the Central, without changing drafts.
create function neo_private.campaign_test_pause_guard() returns trigger
language plpgsql security definer set search_path='' as $guard$
begin
 perform 1 from neo_private.campaign_app_groups g join neo_private.campaign_app_publications p on p.campaign_id=g.campaign_id
 where p.id=new.editor_id for share of g;
 if not neo_private.campaign_parent_enabled(new.editor_id,'app') then raise exception 'campaign_group_paused' using errcode='55000';end if;
 return new;
end;$guard$;
revoke all on function neo_private.campaign_test_pause_guard() from public,anon,authenticated;
create trigger campaign_test_pause_guard before insert on neo_private.campaign_test_batches for each row execute function neo_private.campaign_test_pause_guard();
commit;
