-- Libera com seguranca uma tentativa de pagamento que falhou antes de criar a Order no provedor.
create or replace function public.neo_shop_payment_release(p_order uuid,p_user uuid,p_force boolean default false) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare changed int;
begin
 update neo_private.shop_orders set payment_lease=null
 where id=p_order and user_id=p_user and init_point is null and status in ('awaiting_payment','pending')
 and (p_force or payment_lease is null or payment_lease<now()-interval '30 seconds');
 get diagnostics changed=row_count;return changed=1;
end$$;
revoke all on function public.neo_shop_payment_release(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.neo_shop_payment_release(uuid,uuid,boolean) to service_role;
