begin;
set local lock_timeout='5s';

alter table neo_private.community_materials add column if not exists pin_position integer check(pin_position>0);
create unique index if not exists library_pin_position on neo_private.community_materials(pin_position) where pin_position is not null;

create or replace function neo_private.library_pins(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 pins uuid[];
 requested uuid[];
 expected uuid[];
 admin_id uuid:=auth.uid();
begin
 if admin_id is null or public.neo_admin_access() is not true then
  raise exception 'Somente administradores podem organizar os fixados.' using errcode='42501';
 end if;
 if p_action='pins_save' then
  lock table neo_private.community_materials in share row exclusive mode;
 end if;
 select coalesce(array_agg(id order by pin_position),'{}') into pins
 from neo_private.community_materials where pin_position is not null;
 if p_action='pins_save' then
  if jsonb_typeof(p_payload->'expected') is distinct from 'array' or
     jsonb_typeof(p_payload->'order') is distinct from 'array' then
   raise exception 'Ordem inválida.' using errcode='22023';
  end if;
  select array(select value::uuid from jsonb_array_elements_text(p_payload->'expected')) into expected;
  if pins is distinct from expected then
   raise exception 'Os fixados foram alterados. Atualize a lista e tente novamente.' using errcode='40001';
  end if;
  select array(select value::uuid from jsonb_array_elements_text(p_payload->'order')) into requested;
  if cardinality(requested)>100 or cardinality(requested)<>(select count(distinct id) from unnest(requested) id)
     or exists(select 1 from unnest(requested) r(id) where not exists(select 1 from neo_private.community_materials m where m.id=r.id)) then
   raise exception 'Selecione até 100 publicações existentes e distintas.' using errcode='22023';
  end if;
  if pins is distinct from requested then
   update neo_private.community_materials set pin_position=null where pin_position is not null;
   update neo_private.community_materials m set pin_position=p.position
   from unnest(requested) with ordinality p(id,position) where m.id=p.id;
   insert into neo_private.operations_audit(actor,action,operation,resource)
   values(admin_id,'library_pins','update',jsonb_build_object('before',pins,'after',requested)::text);
  end if;
 end if;
 return jsonb_build_object('pins',coalesce((
  select jsonb_agg(jsonb_build_object('id',id,'title',title) order by pin_position)
  from neo_private.community_materials where pin_position is not null
 ),'[]'));
end $$;
revoke all on function neo_private.library_pins(text,jsonb) from public,anon,authenticated;

-- Change only the pinned-order keys and administrative dispatch in the installed
-- discovery stage, preserving the outer member-access and editor wrappers.
do $migration$
declare
 definition text:=pg_get_functiondef(to_regprocedure('public.neo_library_v25(text,jsonb)'));
 anchor text:=' if p_action=''view'' then';
begin
 if position('order by p.pin_position nulls last' in definition)>0 then return;end if;
 if definition is null or position(anchor in definition)=0
  or position('order by case when v_sort=''popular'' then m.view_count' in definition)=0
  or position('order by case when v_sort=''popular'' then p.view_count' in definition)=0 then
  raise exception 'Contrato de descoberta da Biblioteca divergente.';
 end if;
 definition:=replace(definition,anchor,
  ' if p_action in (''pins_list'',''pins_save'') then return neo_private.library_pins(p_action,p_payload); end if;'||chr(10)||anchor);
 definition:=replace(definition,'''views_ready'',true,','''views_ready'',true,''pins_ready'',true,');
 definition:=replace(definition,'order by case when v_sort=''popular'' then m.view_count','order by m.pin_position nulls last, case when v_sort=''popular'' then m.view_count');
 definition:=replace(definition,'order by case when v_sort=''popular'' then p.view_count','order by p.pin_position nulls last, case when v_sort=''popular'' then p.view_count');
 execute definition;
end
$migration$;

notify pgrst,'reload schema';
commit;
