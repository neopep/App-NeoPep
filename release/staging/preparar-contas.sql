-- Execute pelo SQL Editor do projeto qnuluspqfazdppciermw após criar
-- administrativamente as duas contas fictícias confirmadas, sem enviar convites.
begin;
do $fixture$
declare
  test_admin uuid;
begin
  if to_regclass('neo_private.agent_runtime_attempts') is null
    or not exists (
      select 1 from pg_constraint
      where conname='staging_community_push_disabled'
        and conrelid='neo_private.community_preferences'::regclass
        and convalidated
    ) or exists (select 1 from neo_private.push_devices) then
    raise exception 'Confirme o projeto de staging e o estado de isolamento.';
  end if;

  if (select count(*) from auth.users) <> 2
    or not exists (
      select 1 from auth.users
      where email='participante-ma@example.invalid' and email_confirmed_at is not null
    ) then
    raise exception 'Esperadas somente as duas contas fictícias confirmadas.';
  end if;

  select id into strict test_admin from auth.users
  where email='admin-ma@example.invalid' and email_confirmed_at is not null;
  if exists (select 1 from neo_private.admin_members where user_id<>test_admin)
    or exists (select 1 from neo_private.community_moderators) then
    raise exception 'Encontrados papéis fora da fixture de homologação.';
  end if;
  insert into neo_private.admin_members(user_id) values (test_admin) on conflict do nothing;
end
$fixture$;
commit;
