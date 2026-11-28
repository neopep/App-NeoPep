-- STAGING ONLY. Reconcile only an order already linked by the sandbox checkout.
-- Keep reconciliation available after closing the checkout gate, for already issued links.
begin;
create function public.neo_staging_shop_payment_event_v1(p_order uuid,p_provider_order text,p_payment text,p_status text,p_amount bigint,p_method text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;
begin
 perform pg_advisory_xact_lock(642917200);
 select * into o from neo_private.shop_orders where id=p_order for update;
 if not found or o.environment is distinct from 'test' or o.preference_id is distinct from p_provider_order
 or coalesce(p_provider_order,'') !~ '^ORD[A-Z0-9]{10,60}$' or o.payment_create_started is distinct from true
 or p_amount is null or p_amount<=0 or o.total_cents is distinct from p_amount or coalesce(p_payment,'') !~ '^[0-9]{1,30}$'
 or p_status is null or p_status not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back','in_mediation','partially_refunded')
 or p_method is null or p_method not in ('pix','credit_card','boleto','other')
 then raise exception 'Confirmação sandbox incompatível com o pedido.' using errcode='22023';end if;
 return public.neo_shop_payment_event_v2(p_order,p_payment,p_status,p_amount,'test',p_method);
end $$;
revoke all on function public.neo_staging_shop_payment_event_v1(uuid,text,text,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.neo_staging_shop_payment_event_v1(uuid,text,text,text,bigint,text) to service_role;
notify pgrst,'reload schema';
commit;
