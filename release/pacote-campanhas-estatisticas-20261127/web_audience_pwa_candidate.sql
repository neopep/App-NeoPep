-- CANDIDATA: somente aplicar no pacote consolidado após ensaio em transação revertida.
-- Ambos os ambientes verificados em 27/11/2026 com as mesmas assinaturas e hashes.
-- Sem novo endpoint anônimo, sem IP, identificador de aparelho, localização ou conteúdo.
begin;
set local lock_timeout='5s';
alter table neo_private.audience_observations
 add column web_visit_count integer not null default 0 check(web_visit_count>=0),
 add column web_last_seen_at timestamptz,
 add column pwa_first_observed_at timestamptz,
 add column pwa_native_confirmed_at timestamptz,
 add column pwa_os text check(pwa_os in ('iOS','Android','Windows','macOS','Linux'));
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 f:='public.neo_audience_self(text,jsonb,jsonb)'::regprocedure;
 d:=pg_get_functiondef(f);
 if md5(d)<>'d44204a3a71c21e2c46a526298e4ccfe' then raise exception 'audience_contract_changed';end if;
 a:=$a$first_device=null,last_device=null,first_campaign=null,last_campaign=null$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'consent_reset_changed';end if;
 d:=replace(d,a,a||',web_visit_count=0,web_last_seen_at=null,pwa_first_observed_at=null,pwa_native_confirmed_at=null,pwa_os=null');
 a:=$a$ elsif p_action='observe' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'observe_changed';end if;
 b:=$b$ elsif p_action='web_telemetry' then
  if jsonb_typeof(p_device) is distinct from 'object' or (p_device-array['context','os','native_install'])<>'{}'::jsonb
   or coalesce(p_device->>'context','') not in ('browser','pwa')
   or (p_device ? 'native_install' and jsonb_typeof(p_device->'native_install')<>'boolean') then
    raise exception 'invalid_web_observation' using errcode='22023';
  end if;
  -- Row-level update serializes concurrent visits and checks existing statistics permission.
  -- Client reports are observational, not cryptographic proof of installation.
  update neo_private.audience_observations
  set web_visit_count=case when web_last_seen_at is null or web_last_seen_at<t-interval '30 minutes'
        then least(web_visit_count+1,1000000) else web_visit_count end,
      web_last_seen_at=t,
      pwa_first_observed_at=case when p_device->>'context'='pwa' then coalesce(pwa_first_observed_at,t) else pwa_first_observed_at end,
      pwa_native_confirmed_at=case when p_device->'native_install'='true'::jsonb and p_device->>'os' is distinct from 'iOS'
        then coalesce(pwa_native_confirmed_at,t) else pwa_native_confirmed_at end,
      pwa_os=coalesce(pwa_os,case when (p_device->>'context'='pwa' or (p_device->'native_install'='true'::jsonb and p_device->>'os' is distinct from 'iOS'))
          and p_device->>'os' in ('iOS','Android','Windows','macOS','Linux') then p_device->>'os' end)
  where user_id=u and expires_at>t;
  return jsonb_build_object('allowed',found);
$b$;
 execute replace(d,a,b||a);
 f:='public.neo_admin_audience(date,date,uuid[])'::regprocedure;
 d:=pg_get_functiondef(f);
 if md5(d)<>'2e6efc8ba7dc245fca6e9d03cfc71fab' then raise exception 'admin_audience_contract_changed';end if;
 a:=$a$ return result;
end$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'admin_report_changed';end if;
 b:=$b$ -- Counts are current consent-window observations, not lifetime installs or anonymous traffic.
 return result||jsonb_build_object('web_statistics',(select jsonb_build_object(
  'pwa_accounts',count(*) filter(where pwa_first_observed_at is not null),
  'native_accounts',count(*) filter(where pwa_native_confirmed_at is not null),
  'sessions',coalesce(sum(web_visit_count),0))
  from neo_private.audience_observations where expires_at>now()));
end$b$;
 execute replace(d,a,b);
end;$patch$;
commit;
