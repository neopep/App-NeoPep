-- Permite que a loja cancele pedidos diretamente, preservando o histórico.
do $$begin
 if to_regprocedure('public.neo_shop_v36(text,jsonb)') is null then alter function public.neo_shop(text,jsonb) rename to neo_shop_v36;end if;
end$$;
revoke all on function public.neo_shop_v36(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_shop(p_action text default 'catalog',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a boolean:=public.neo_admin_access();o neo_private.shop_orders;i jsonb;
begin
 if auth.uid() is null then raise exception 'Entre na conta para acessar a loja.';end if;
 if p_action='admin_cancel_order' then
  if not a then raise exception 'Autorizacao da loja obrigatoria.';end if;
  select * into o from neo_private.shop_orders where id=(p_payload->>'id')::uuid for update;
  if not found then raise exception 'Pedido nao encontrado.';end if;
  if o.status in ('cancelled','expired') or o.fulfillment='delivered' then raise exception 'Este pedido nao pode ser cancelado neste estado.';end if;
  if o.status in ('awaiting_payment','pending') and not o.stock_released then
   for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;
  end if;
  update neo_private.shop_orders set status=case when status in ('awaiting_payment','pending') then 'cancelled' else 'paid_review' end,stock_released=case when status in ('awaiting_payment','pending') then true else stock_released end,cancellation_status='approved',cancellation_reason=left(coalesce(nullif(btrim(p_payload->>'reason'),''),'Cancelado pela loja'),500),cancellation_note='Cancelado pela administração da loja.',cancellation_requested_at=coalesce(cancellation_requested_at,now()),cancellation_resolved_at=now() where id=o.id;
  return jsonb_build_object('cancelled',true,'paid',o.status in ('paid','test_paid','paid_review'));
 end if;
 return public.neo_shop_v36(p_action,p_payload);
end$$;
revoke all on function public.neo_shop(text,jsonb) from public,anon;
grant execute on function public.neo_shop(text,jsonb) to authenticated;
