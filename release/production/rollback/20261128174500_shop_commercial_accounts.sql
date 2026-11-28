-- Rollback for the dormant commercial enrollment schema.
begin;
set local lock_timeout = '5s';
lock table neo_private.shop_commercial_accounts in access exclusive mode;
do $$
begin
 if exists (select 1 from neo_private.shop_commercial_accounts) then
  raise exception 'O rollback exige revisar e preservar os cadastros comerciais existentes.';
 end if;
end;
$$;
drop function public.neo_manage_commercial_account(uuid, boolean);
drop function public.neo_commercial_account();
drop table neo_private.shop_commercial_accounts;
commit;
