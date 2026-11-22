-- Extended voluntary summary: tracking categories, last three records each.
begin;
create or replace function neo_private.community_snapshot(u uuid,fields jsonb) returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare p jsonb; current_weight numeric; initial_weight numeric; first_day date; result jsonb; f text;
begin
 if jsonb_typeof(fields) is distinct from 'array' or jsonb_array_length(fields)<1 or jsonb_array_length(fields)>12 then raise exception 'choose summary fields';end if;
 if not exists(select 1 from public.neo_consents where user_id=u and purpose='health' and granted) then raise exception 'health consent required';end if;
 select data->'profile' into p from public.neo_profiles where user_id=u;
 select (data->>'value')::numeric into current_weight from public.neo_records where user_id=u and kind='weights' order by data->>'date' desc,id desc limit 1;
 select min((data->>'date')::date) into first_day from public.neo_records where user_id=u and kind='weights';
 initial_weight:=(p->>'initialWeight')::numeric;
 result:=jsonb_build_object('as_of',current_date);
 for f in select jsonb_array_elements_text(fields) loop
  if f='change' then result:=result||jsonb_build_object('change_kg',case when current_weight is not null and initial_weight is not null then round(current_weight-initial_weight,2) else null end);
  elsif f='current' then result:=result||jsonb_build_object('current_kg',current_weight);
  elsif f='goal' then result:=result||jsonb_build_object('goal_kg',(p->>'goal')::numeric);
  elsif f='days' then result:=result||jsonb_build_object('days',case when first_day is not null then greatest(1,current_date-first_day+1) else null end);
  elsif f='initial' then result:=result||jsonb_build_object('initial_kg',initial_weight);
  elsif f='height' then result:=result||jsonb_build_object('height_cm',(p->>'height')::numeric);
  elsif f in ('weights','measures','journal','doses','protocols','reminders') then
   result:=result||jsonb_build_object(f,coalesce((select jsonb_agg(x.data) from (select r.data-'id'-'protocolId' as data from public.neo_records r where r.user_id=u and r.kind=f order by r.data->>'date' desc,r.id desc limit 3)x),'[]'::jsonb));
  else raise exception 'invalid summary field';end if;
 end loop;
 if octet_length(result::text)>32000 then raise exception 'summary too large; choose fewer categories';end if;
 return result;
end $$;
revoke all on function neo_private.community_snapshot(uuid,jsonb) from public,anon,authenticated;
commit;
