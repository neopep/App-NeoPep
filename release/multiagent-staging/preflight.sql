-- Execute only in the neopep-staging project (qnuluspqfazdppciermw).
-- The SQL editor project selector is the authoritative target check.
begin read only;
do $$
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'Esperado PostgreSQL 17 de homologação.';
  end if;
  if to_regnamespace('neo_private') is not null or to_regclass('public.neo_profiles') is not null then
    raise exception 'Banco contém objetos do aplicativo. Interrompa e revise a base.';
  end if;
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null
    or to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null
    or to_regprocedure('storage.foldername(text)') is null then
    raise exception 'Estrutura padrão Auth/Storage do Supabase ausente.';
  end if;
  if exists (select 1 from auth.users) then raise exception 'Esperado Auth vazio antes da instalação.'; end if;
  if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')) <> 3 then
    raise exception 'Papéis padrão do Supabase ausentes.';
  end if;
  if to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'Confira Supabase Vault e pg_net em staging antes de prosseguir.';
  end if;
  if exists(select 1 from vault.decrypted_secrets where name in ('neo_ai_cron_secret','neo_push_cron_secret')) then
    raise exception 'Segredos de agendamento encontrados. Revise o staging antes de instalar.';
  end if;
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job where active) then
      raise exception 'Há cron ativo. Revise o isolamento antes de instalar.';
    end if;
  end if;
end;
$$;
rollback;
