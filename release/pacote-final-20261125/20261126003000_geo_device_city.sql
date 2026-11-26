-- NeoPep: city/state from device after the consented IP estimate.
-- No latitude, longitude, address, postcode, or GPS accuracy is saved.
-- Run in Teste first. Do not deploy in Produção until reviewed.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.neo_geo_observe(uuid,text,text,text)'::regprocedure)) IS DISTINCT FROM 'a319faf940b5f5d3c0403dcab23df60b' THEN RAISE EXCEPTION 'official_geo_contract_changed'; END IF;
 IF to_regprocedure('public.neo_geo_device_city(text,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'official_device_city_already_exists'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.neo_geo_device_city(p_country text, p_region text, p_city text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=auth.uid(); observation jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING errcode='42501'; END IF;
 IF p_country IS NULL OR p_country !~ '^[A-Z]{2}$'
 OR p_region IS NULL OR length(btrim(p_region))<1 OR length(p_region)>100
 OR p_city IS NULL OR length(btrim(p_city))<1 OR length(p_city)>120
 OR p_region ~ '[[:cntrl:]]' OR p_city ~ '[[:cntrl:]]'
 THEN RETURN false; END IF;
 observation:=jsonb_build_object('country',p_country,'region',btrim(p_region),
  'city',btrim(p_city),'source','device_city','observed_at',statement_timestamp());
 -- Only users with an active location consent (account_geo row) can update their location.
 -- Device-derived city/state replace the earlier IP estimate in both admin fields.
 UPDATE neo_private.account_geo
 SET first_location=CASE
       WHEN first_location IS NULL OR first_location->>'source'='vercel_ip_approximate'
       THEN observation ELSE first_location END,
     last_location=observation
 WHERE user_id=u
   AND (last_location IS NULL OR last_location->>'source' IS DISTINCT FROM 'device_city'
        OR (last_location->>'observed_at')::timestamptz < statement_timestamp()-interval '1 minute');
 RETURN found;
END $function$;

REVOKE ALL ON FUNCTION public.neo_geo_device_city(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.neo_geo_device_city(text,text,text) TO authenticated;

-- IP fallback must never downgrade a GPS-derived city/state.
CREATE OR REPLACE FUNCTION public.neo_geo_observe(p_user uuid, p_country text, p_region text DEFAULT NULL::text, p_city text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare observation jsonb;
begin
 if p_country is null or p_country !~ '^[A-Z]{2}$'
 or length(p_region)>100 or length(p_city)>120 or coalesce(p_region,'')~'[[:cntrl:]]' or coalesce(p_city,'')~'[[:cntrl:]]'
 then return false;end if;
 observation:=jsonb_strip_nulls(jsonb_build_object('country',p_country,'region',nullif(btrim(p_region),''),
  'city',nullif(btrim(p_city),''),'source','vercel_ip_approximate','observed_at',statement_timestamp()));
 update neo_private.account_geo set first_location=coalesce(first_location,observation),last_location=observation
 where user_id=p_user and (last_location is null or (last_location->>'source' is distinct from 'device_city' and (last_location->>'observed_at')::timestamptz<statement_timestamp()-interval '5 minutes'));
 return found;
end $function$
;

COMMIT;
