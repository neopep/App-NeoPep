-- NeoPep 2026-11-25: criar peso de referencia na mesma transacao do cadastro inicial.
-- Nao altera contas existentes, nao cria pesos retroativamente e nao duplica historicos.
-- p_profile.initialRecordDate nao e armazenado no perfil; e apenas a data local do cadastro.
-- Compatible com clientes antigos que nao enviam initialRecordDate.
-- A funcao existente preserva autorizacao, limitador e verificacoes de consentimento.
begin;

CREATE OR REPLACE FUNCTION public.neo_complete_onboarding(p_profile jsonb, p_settings jsonb, p_health boolean, p_terms boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare d jsonb;k text; initial_date text;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 if p_health is distinct from true or p_terms is distinct from true then raise exception 'explicit consent required';end if;
 if not neo_private.take_limit('onboarding',12,3600) then raise exception 'too many requests';end if;
 if not public.neo_number(p_profile,'height',40,260) or not public.neo_number(p_profile,'initialWeight',1,650) or not public.neo_number(p_profile,'goal',1,650) then raise exception 'initial profile incomplete';end if;
 if jsonb_typeof(p_profile->'tracking') is distinct from 'object' then raise exception 'tracking preferences required';end if;
 foreach k in array array['weight','measures','journal','photos','applications'] loop
  if jsonb_typeof(p_profile->'tracking'->k) is distinct from 'boolean' then raise exception 'invalid tracking preference';end if;
 end loop;
 -- A data enviada pelo aplicativo e local ao usuario; codigos legados usam a data do Brasil.
 if p_profile ? 'initialRecordDate' then
  initial_date := p_profile->>'initialRecordDate';
  if public.neo_valid_date(initial_date) is distinct from true then raise exception 'invalid initial weight date';end if;
  if abs((initial_date::date - (clock_timestamp() at time zone 'America/Sao_Paulo')::date)) > 1 then raise exception 'initial weight date too distant';end if;
 else
  initial_date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date::text;
 end if;
 d=jsonb_build_object('profile',p_profile - 'initialRecordDate','settings',p_settings);
 if public.neo_valid_profile(d) is distinct from true then raise exception 'invalid profile';end if;
 -- Presence of both core consents identifies accounts that already completed this flow.
 insert into neo_private.privacy_setup(user_id)
 select auth.uid()
 where not exists (select 1 from public.neo_consents c where c.user_id=auth.uid() and c.purpose in ('health','terms')
  group by c.user_id having count(distinct c.purpose)=2)
 on conflict(user_id) do nothing;
 insert into public.neo_consents(user_id,purpose,granted) values(auth.uid(),'health',true),(auth.uid(),'terms',true)
 on conflict(user_id,purpose,version) do update set granted=true,changed_at=now();
 insert into public.neo_profiles(user_id,data) values(auth.uid(),d) on conflict(user_id) do update set data=excluded.data;
 -- O primeiro peso integra a mesma transacao do onboarding. Nunca altera registros existentes.
 insert into public.neo_records(user_id,kind,id,data)
 select auth.uid(),'weights','onboarding-initial',
        jsonb_build_object('id','onboarding-initial','date',initial_date,'value',p_profile->'initialWeight')
 where not exists (
  select 1 from public.neo_records r
  where r.user_id=auth.uid() and r.kind='weights'
 )
 on conflict (user_id,kind,id) do nothing;
end $function$
;

commit;
