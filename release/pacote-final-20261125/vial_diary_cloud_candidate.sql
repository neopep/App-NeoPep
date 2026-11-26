-- Candidate common to Teste and Produção. No health records are migrated automatically.
begin;
set local lock_timeout='5s';
create table neo_private.vial_diary(
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check(id~'^[-a-zA-Z0-9_:.]{1,150}$'),
 product text not null check(length(btrim(product)) between 1 and 80),
 mass numeric not null check(mass between 0.000001 and 1000000),
 volume numeric not null check(volume between 0.000001 and 1000000),
 dose numeric check(dose between 0.000001 and 1000000),
 unit text check(unit in ('mg','mcg')),
 created_at timestamptz not null default now(),
 active boolean not null default false,
 primary key(user_id,id),check((dose is null)=(unit is null))
);
create unique index vial_diary_active_one on neo_private.vial_diary(user_id) where active;
create table neo_private.vial_diary_links(
 user_id uuid not null references auth.users(id) on delete cascade,
 dose_kind text not null default 'doses' check(dose_kind='doses'),
 dose_id text not null, vial_id text not null,
 primary key(user_id,dose_id),
 foreign key(user_id,vial_id) references neo_private.vial_diary(user_id,id) on delete cascade,
 foreign key(user_id,dose_kind,dose_id) references public.neo_records(user_id,kind,id) on delete cascade
);
alter table neo_private.vial_diary enable row level security;
alter table neo_private.vial_diary_links enable row level security;
revoke all on neo_private.vial_diary,neo_private.vial_diary_links from public,anon,authenticated;

create function neo_private.vial_diary_snapshot(p_owner uuid) returns jsonb
language sql stable security invoker set search_path='' as $snapshot$
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.product,'product',v.product,'mass',v.mass,'volume',v.volume,'dose',v.dose,'unit',v.unit,'createdAt',v.created_at) order by v.created_at desc,v.id) from neo_private.vial_diary v where user_id=p_owner),'[]'::jsonb),
  'links',coalesce((select jsonb_object_agg(dose_id,vial_id) from neo_private.vial_diary_links where user_id=p_owner),'{}'::jsonb),
  'active',(select id from neo_private.vial_diary where user_id=p_owner and active))
$snapshot$;
revoke all on function neo_private.vial_diary_snapshot(uuid) from public,anon,authenticated;
create function neo_private.vial_diary_mass(d jsonb,mass numeric,volume numeric) returns numeric
language sql immutable security invoker set search_path='' as $mass$
 select case d->>'unit' when 'mg' then (d->>'amount')::numeric when 'mcg' then (d->>'amount')::numeric/1000 when 'mL' then (d->>'amount')::numeric*mass/volume else null end
$mass$;
revoke all on function neo_private.vial_diary_mass(jsonb,numeric,numeric) from public,anon,authenticated;
create function neo_private.vial_diary_validate(p_vial jsonb) returns boolean
language sql immutable security invoker set search_path='' as $valid$
 select coalesce(jsonb_typeof(p_vial)='object' and p_vial->>'id'~'^[-a-zA-Z0-9_:.]{1,150}$'
 and jsonb_typeof(p_vial->'product')='string' and length(btrim(p_vial->>'product')) between 1 and 80
 and (p_vial->>'product')!~'[[:cntrl:]]'
 and public.neo_number(p_vial,'mass',0.000001,1000000)
 and public.neo_number(p_vial,'volume',0.000001,1000000)
 and ((coalesce(p_vial->'dose','null'::jsonb)='null'::jsonb and coalesce(p_vial->'unit','null'::jsonb)='null'::jsonb)
  or (public.neo_number(p_vial,'dose',0.000001,1000000) and p_vial->>'unit' in ('mg','mcg')
  and (case when p_vial->>'unit'='mcg' then (p_vial->>'dose')::numeric/1000 else (p_vial->>'dose')::numeric end)<=(p_vial->>'mass')::numeric)),false)
$valid$;
revoke all on function neo_private.vial_diary_validate(jsonb) from public,anon,authenticated;
create function public.neo_vial_diary(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $diary$
declare actor uuid:=auth.uid(); item jsonb; v neo_private.vial_diary; prior neo_private.vial_diary; rid text; vid text; current_id text;
 existing public.neo_records; saved public.neo_records; d jsonb; rev integer; linked text; used numeric; amount numeric; raw_link record;
begin
 if actor is null then raise exception 'vial_auth_required' using errcode='42501';end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>500000 then raise exception 'vial_invalid_payload' using errcode='22023';end if;
 -- Match the existing health-record policies: owner may read/export, but writes require consent.
 if p_action='read' then return neo_private.vial_diary_snapshot(actor);end if;
 if not public.neo_has_consent('health') or not public.neo_has_consent('terms') or not exists(select 1 from public.neo_profiles where user_id=actor) then raise exception 'vial_consent_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('neo-vial-diary:'||actor::text,0));
 select id into current_id from neo_private.vial_diary where user_id=actor and active;
 if p_action='add' then
  item:=p_data->'vial';if not neo_private.vial_diary_validate(item) then raise exception 'vial_invalid' using errcode='22023';end if;
  select * into prior from neo_private.vial_diary where user_id=actor and id=item->>'id';
  if found then
   if row(prior.product,prior.mass,prior.volume,prior.dose,prior.unit) is distinct from row(btrim(item->>'product'),(item->>'mass')::numeric,(item->>'volume')::numeric,(item->>'dose')::numeric,item->>'unit') then raise exception 'vial_request_conflict' using errcode='23505';end if;
   return neo_private.vial_diary_snapshot(actor);
  end if;
  if current_id is distinct from nullif(p_data->>'expected_active','') then raise exception 'vial_active_changed' using errcode='40001';end if;
  if (select count(*) from neo_private.vial_diary where user_id=actor)>=300 then raise exception 'vial_limit' using errcode='22023';end if;
  update neo_private.vial_diary set active=false where user_id=actor and active;
  insert into neo_private.vial_diary(user_id,id,product,mass,volume,dose,unit,active) values(actor,item->>'id',btrim(item->>'product'),(item->>'mass')::numeric,(item->>'volume')::numeric,(item->>'dose')::numeric,item->>'unit',true);
  return neo_private.vial_diary_snapshot(actor);
 end if;
 if p_action='import_local' then
  if exists(select 1 from neo_private.vial_diary where user_id=actor) or p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'vial_import_conflict' using errcode='55000';end if;
  if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_typeof(p_data->'links') is distinct from 'object' then raise exception 'vial_import_invalid' using errcode='22023';end if;
  if jsonb_array_length(p_data->'items') not between 1 and 300 or (select count(*) from jsonb_object_keys(p_data->'links'))>20000 then raise exception 'vial_import_limit' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_data->'items') loop
   if not neo_private.vial_diary_validate(item) then raise exception 'vial_import_invalid_item' using errcode='22023';end if;
   insert into neo_private.vial_diary(user_id,id,product,mass,volume,dose,unit,created_at,active)
   values(actor,item->>'id',btrim(item->>'product'),(item->>'mass')::numeric,(item->>'volume')::numeric,(item->>'dose')::numeric,item->>'unit',least(coalesce((item->>'createdAt')::timestamptz,now()),now()),coalesce(item->>'id'=p_data->>'active',false));
  end loop;
  for raw_link in select key,value from jsonb_each_text(p_data->'links') loop
   select * into v from neo_private.vial_diary where user_id=actor and id=raw_link.value;
   if not found then raise exception 'vial_import_link_invalid' using errcode='22023';end if;
   select * into existing from public.neo_records where user_id=actor and kind='doses' and id=raw_link.key;
   -- Missing/deleted local references are not created, and no record is rewritten.
   if not found then continue;end if;
   if lower(btrim(existing.data->>'product')) is distinct from lower(v.product) then raise exception 'vial_import_product_mismatch' using errcode='22023';end if;
   insert into neo_private.vial_diary_links(user_id,dose_id,vial_id) values(actor,raw_link.key,v.id);
  end loop;
  return neo_private.vial_diary_snapshot(actor);
 end if;
 if p_action<>'put_dose' then raise exception 'vial_action_invalid' using errcode='22023';end if;
 d:=p_data->'record';rid:=d->>'id';rev:=(p_data->>'revision')::int;vid:=nullif(p_data->>'vial_id','');
 if public.neo_valid_record('doses',rid,d) is distinct from true then raise exception 'vial_dose_invalid' using errcode='22023';end if;
 select * into existing from public.neo_records where user_id=actor and kind='doses' and id=rid for update;
 if found then
  select vial_id into linked from neo_private.vial_diary_links where user_id=actor and dose_id=rid;
  if rev is null and existing.data=d and linked is not distinct from vid then return jsonb_build_object('revision',existing.revision,'diary',neo_private.vial_diary_snapshot(actor));end if;
  if rev is distinct from existing.revision then raise exception 'vial_dose_revision_changed' using errcode='40001';end if;
  if linked is distinct from vid then raise exception 'vial_link_changed' using errcode='40001';end if;
 else
  if rev is not null then raise exception 'vial_dose_revision_changed' using errcode='40001';end if;
  if vid is null or vid is distinct from current_id then raise exception 'vial_active_changed' using errcode='40001';end if;
 end if;
 if vid is not null then
  select * into v from neo_private.vial_diary where user_id=actor and id=vid;
  if not found or lower(btrim(d->>'product')) is distinct from lower(v.product) then raise exception 'vial_product_mismatch' using errcode='22023';end if;
  amount:=neo_private.vial_diary_mass(d,v.mass,v.volume);
  select coalesce(sum(neo_private.vial_diary_mass(r.data,v.mass,v.volume)),0) into used from neo_private.vial_diary_links l join public.neo_records r on r.user_id=l.user_id and r.kind=l.dose_kind and r.id=l.dose_id where l.user_id=actor and l.vial_id=vid and l.dose_id<>rid;
  if amount is null or amount<=0 or used+amount>v.mass+v.mass*0.0000000001 then raise exception 'vial_balance_insufficient' using errcode='22023';end if;
 end if;
 if existing.id is not null then update public.neo_records set data=d where user_id=actor and kind='doses' and id=rid and revision=rev returning * into saved;
 else insert into public.neo_records(user_id,kind,id,data) values(actor,'doses',rid,d) returning * into saved;
  insert into neo_private.vial_diary_links(user_id,dose_id,vial_id) values(actor,rid,vid);
 end if;
 if saved.id is null then raise exception 'vial_dose_revision_changed' using errcode='40001';end if;
 return jsonb_build_object('revision',saved.revision,'diary',neo_private.vial_diary_snapshot(actor));
end;$diary$;
revoke all on function public.neo_vial_diary(text,jsonb) from public,anon;
grant execute on function public.neo_vial_diary(text,jsonb) to authenticated;
commit;
