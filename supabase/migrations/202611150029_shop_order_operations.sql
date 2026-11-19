-- Cancelamentos, rastreamento completo e exportacao administrativa de pedidos.
alter table neo_private.shop_orders add column if not exists tracking_url text not null default '';
alter table neo_private.shop_orders add column if not exists cancellation_status text not null default 'none' check(cancellation_status in ('none','requested','approved','rejected'));
alter table neo_private.shop_orders add column if not exists cancellation_reason text not null default '';
alter table neo_private.shop_orders add column if not exists cancellation_note text not null default '';
alter table neo_private.shop_orders add column if not exists cancellation_requested_at timestamptz;
alter table neo_private.shop_orders add column if not exists cancellation_resolved_at timestamptz;

do $$begin if to_regprocedure('public.neo_shop_v29(text,jsonb)') is null then alter function public.neo_shop(text,jsonb) rename to neo_shop_v29;end if;end$$;

create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();a boolean:=public.neo_admin_access();o neo_private.shop_orders;i jsonb;result jsonb;decision text;
begin
 if u is null then raise exception 'Entre na conta para acessar a loja.';end if;
 if p_action='cancel_order' then
  select * into o from neo_private.shop_orders where id=(p_payload->>'id')::uuid and user_id=u for update;
  if not found then raise exception 'Pedido nao encontrado.';end if;
  if o.status in ('awaiting_payment','pending') then
   if not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;end if;
   update neo_private.shop_orders set status='cancelled',stock_released=true,cancellation_status='approved',cancellation_reason=left(coalesce(p_payload->>'reason','Cancelado pelo cliente'),500),cancellation_requested_at=now(),cancellation_resolved_at=now() where id=o.id;
   return '{"cancelled":true}'::jsonb;
  elsif o.status in ('paid','test_paid','paid_review') and o.fulfillment<>'delivered' then
   update neo_private.shop_orders set cancellation_status='requested',cancellation_reason=left(coalesce(nullif(trim(p_payload->>'reason'),''),'Solicitacao do cliente'),500),cancellation_requested_at=now(),cancellation_resolved_at=null where id=o.id;
   return '{"requested":true}'::jsonb;
  end if;
  raise exception 'Este pedido nao pode ser cancelado neste estado.';
 elsif p_action='cancellation_decision' then
  if not a then raise exception 'Autorizacao da loja obrigatoria.';end if;
  decision:=p_payload->>'decision';if decision not in ('approved','rejected') then raise exception 'Decisao invalida.';end if;
  update neo_private.shop_orders set cancellation_status=decision,cancellation_note=left(coalesce(p_payload->>'note',''),500),cancellation_resolved_at=now(),status=case when decision='approved' and status in ('paid','test_paid') then 'paid_review' else status end where id=(p_payload->>'id')::uuid and cancellation_status='requested';
  if not found then raise exception 'Solicitacao de cancelamento nao encontrada.';end if;return '{"ok":true}'::jsonb;
 elsif p_action='fulfill' then
  if not a then raise exception 'Autorizacao da loja obrigatoria.';end if;
  if length(coalesce(p_payload->>'tracking_url',''))>500 or (coalesce(p_payload->>'tracking_url','')<>'' and coalesce(p_payload->>'tracking_url','')!~ '^https://') then raise exception 'Informe um link de rastreamento HTTPS valido.';end if;
  result:=public.neo_shop_v29(p_action,p_payload-'tracking_url');
  update neo_private.shop_orders set tracking_url=coalesce(p_payload->>'tracking_url','') where id=(p_payload->>'id')::uuid;return result;
 elsif p_action in ('orders','manage_orders') then
  result:=public.neo_shop_v29(p_action,p_payload);
  return coalesce((select jsonb_agg(x.value||jsonb_build_object('tracking_url',ord.tracking_url,'cancellation_status',ord.cancellation_status,'cancellation_reason',ord.cancellation_reason,'cancellation_note',ord.cancellation_note,'cancellation_requested_at',ord.cancellation_requested_at,'cancellation_resolved_at',ord.cancellation_resolved_at)||case when p_action='manage_orders' then jsonb_build_object('customer_email',(select email from auth.users where id=ord.user_id)) else '{}'::jsonb end order by x.ordinality) from jsonb_array_elements(result) with ordinality x join neo_private.shop_orders ord on ord.id=(x.value->>'id')::uuid),'[]'::jsonb);
 elsif p_action='export_orders' then
  if not a then raise exception 'Autorizacao da loja obrigatoria.';end if;
  return coalesce((select jsonb_agg(to_jsonb(ord)||jsonb_build_object('customer_email',(select email from auth.users where id=ord.user_id)) order by ord.created_at desc) from neo_private.shop_orders ord),'[]'::jsonb);
 end if;
 return public.neo_shop_v29(p_action,p_payload);
end$$;
revoke all on function public.neo_shop_v29(text,jsonb),public.neo_shop(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_shop(text,jsonb) to authenticated;
