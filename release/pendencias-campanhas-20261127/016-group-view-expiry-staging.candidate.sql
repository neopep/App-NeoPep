-- STAGING ONLY: delete expired encrypted consultation envelopes without external requests.
begin;
do $guard$ begin
 if to_regclass('neo_private.group_view_requests_v1') is null
 or exists(select 1 from cron.job where jobname='neopep-staging-group-view-expiry-v1')
 or (select enabled from neo_private.group_view_gate_v1 where singleton) is distinct from false
 then raise exception 'group_view_expiry_preflight';end if;
end $guard$;
create index group_view_expiry_idx_v1 on neo_private.group_view_requests_v1(expires_at);
create function neo_private.group_view_purge_expired_v1()
returns bigint language plpgsql volatile set search_path=pg_catalog as $$
declare removed bigint;
begin
 delete from neo_private.group_view_requests_v1 where expires_at<=clock_timestamp();
 get diagnostics removed=row_count;
 return removed;
end $$;
revoke all on function neo_private.group_view_purge_expired_v1() from public,anon,authenticated,service_role;
select cron.schedule('neopep-staging-group-view-expiry-v1','* * * * *','select neo_private.group_view_purge_expired_v1();');
commit;
