-- STAGING ONLY: retain disabled legacy shop push trigger; enqueue paid notices only for approved sandbox users.
begin;
create function neo_private.staging_shop_paid_push_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.environment is distinct from 'test' or new.status is distinct from 'test_paid'
 or old.status is not distinct from new.status or new.user_id is null
 or not exists(select 1 from neo_private.staging_checkout_users_v1 where user_id=new.user_id) then return new;end if;
 insert into neo_private.event_push_jobs(device_id,event_key,kind,title,body)
 select d.id,'shop:'||new.id||':status:test_paid','shop','Pagamento confirmado','Seu pagamento de teste foi confirmado.'
 from neo_private.push_devices d where d.user_id=new.user_id on conflict do nothing;
 perform neo_private.push_dispatch_wake();
 return new;
end $$;
revoke all on function neo_private.staging_shop_paid_push_v1() from public,anon,authenticated,service_role;
create trigger neo_staging_shop_paid_push_v1 after update of status on neo_private.shop_orders
 for each row execute function neo_private.staging_shop_paid_push_v1();
commit;
