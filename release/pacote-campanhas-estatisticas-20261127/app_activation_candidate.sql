-- Candidate activation only. No public App/push dispatch in Teste.
-- First select the 1–30 explicitly authorized Teste accounts in the existing homologation configuration.
-- Never copy the Production audience or infer which users may receive campaigns.
begin;
set local lock_timeout='5s';
do $gate$
declare n int;
begin
 select count(*) into n from neo_private.campaign_test_accounts where enabled;
 if n not between 1 and 30 then raise exception 'authorized_test_accounts_required';end if;
 if (select count(*) from neo_private.campaign_test_config)<>1 then raise exception 'config_changed';end if;
 update neo_private.campaign_test_config set enabled=true where singleton and enabled=false;
 if not found then raise exception 'test_gate_already_changed';end if;
end;$gate$;
commit;
-- Rollback (if authorized): update neo_private.campaign_test_config set enabled=false where singleton;
