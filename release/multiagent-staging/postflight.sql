begin read only;
do $$
begin
  if (select count(*) from neo_private.agents where is_default) <> 1
     or exists (select 1 from neo_private.agents where not is_default and status = 'active')
     or not exists(select 1 from neo_private.agent_settings where singleton and not enabled) then
    raise exception 'Estado inicial dos agentes fora do esperado para instalação vazia.';
  end if;
  if exists(select 1 from neo_private.ai_integrations where encrypted_key is not null)
    or exists(select 1 from neo_private.ai_jobs)
    or exists(select 1 from auth.users) then
    raise exception 'Esperado staging sem usuários, credenciais de IA e jobs antes das fixtures.';
  end if;
  if not has_function_privilege('authenticated','public.neo_multiagent(text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.neo_multiagent(text,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.neo_ai_claim(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.neo_ai_claim(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','neo_private.agents','SELECT') then
    raise exception 'Grants do catálogo ou worker fora do esperado.';
  end if;
  if not exists(select 1 from pg_class where oid='neo_private.agents'::regclass and relrowsecurity)
    or not exists(select 1 from pg_class where oid='neo_private.agent_catalog_knowledge'::regclass and relrowsecurity) then
    raise exception 'RLS do catálogo ou conhecimento ausente.';
  end if;
  if position('https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch' in
      pg_get_functiondef('neo_private.support_push_wake()'::regprocedure)) = 0
     or position('https://qnuluspqfazdppciermw.supabase.co/functions/v1/push-dispatch' in
      pg_get_functiondef('neo_private.push_dispatch_wake()'::regprocedure)) = 0 then
    raise exception 'Destino dos triggers deve ser exclusivamente o Supabase de homologação.';
  end if;
end;
$$;
rollback;
