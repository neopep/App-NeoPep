-- Release patch: after 20261125223000_campaign_recurrence_times.sql.
-- Do not apply until validated on isolated staging. No dispatch or data mutation.
begin;
set local lock_timeout='5s';
do $migration$
declare
 definition text:=pg_get_functiondef('public.neo_campaign_weekly_v1(text,jsonb)'::regprocedure);
 old_block constant text:=$old$ select array_agg(p.at order by p.at) into dates from (
  select to_char(start_date+i,'YYYY-MM-DD')||'T'||t as at
  from generate_series(0,end_date-start_date) i
  cross join jsonb_array_elements_text(times) t
  where (frequency='daily' or p_data->'days' @> jsonb_build_array(extract(dow from start_date+i)::integer))
    and ((start_date+i)+t::time) at time zone 'America/Sao_Paulo'>now()
  order by at limit cutoff
 ) p;$old$;
 new_block constant text:=$new$ if p_data ? 'day_times' then
  if frequency<>'weekly' or jsonb_typeof(p_data->'day_times') is distinct from 'object' then
   raise exception 'campaign_weekly_invalid_day_times' using errcode='22023';
  end if;
  if jsonb_array_length(p_data->'days') not between 1 and 7
   or (select count(distinct d) from jsonb_array_elements_text(p_data->'days') d)<>jsonb_array_length(p_data->'days')
   or (select count(*) from jsonb_object_keys(p_data->'day_times'))<>jsonb_array_length(p_data->'days')
   or exists(select 1 from jsonb_each(p_data->'day_times') e
    where e.key !~ '^[0-6]$' or jsonb_typeof(e.value) is distinct from 'string'
     or (e.value#>>'{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
   or exists(select 1 from jsonb_array_elements_text(p_data->'days') d
    where not (p_data->'day_times' ? d))
  then raise exception 'campaign_weekly_invalid_day_times' using errcode='22023';end if;
 end if;
 select array_agg(p.at order by p.at) into dates from (
  select to_char(start_date+i,'YYYY-MM-DD')||'T'||t as at
  from generate_series(0,end_date-start_date) i
  cross join lateral jsonb_array_elements_text(
   case when p_data ? 'day_times'
    then coalesce((select jsonb_build_array(p_data->'day_times'->>extract(dow from start_date+i)::integer::text)
      where p_data->'day_times' ? extract(dow from start_date+i)::integer::text),'[]'::jsonb)
    else times end
  ) t
  where (frequency='daily' or p_data->'days' @> jsonb_build_array(extract(dow from start_date+i)::integer))
    and ((start_date+i)+t::time) at time zone 'America/Sao_Paulo'>now()
  order by at limit cutoff
 ) p;$new$;
begin
 if definition is null then raise exception 'campaign_weekly_missing';end if;
 if position(new_block in definition)>0 then return;end if;
 if cardinality(string_to_array(definition,old_block))<>2 then
  raise exception 'campaign_weekly_unexpected_definition';
 end if;
 execute replace(definition,old_block,new_block);
end;
$migration$;
commit;
