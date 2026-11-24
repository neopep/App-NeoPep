-- NeoPep: preserve server-side order idempotency across shipping recalculations.
-- No Mercado Pago Edge Function changes. Deploy only after CI and staging validation.
CREATE OR REPLACE FUNCTION public.neo_shop_v36(p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare result jsonb;base_quote jsonb;adjusted_quote jsonb;rules jsonb;entry record;state_value text;shipping_value int;order_id uuid;
 valid_states text[]:=array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
begin
 if p_action='settings' then
  if not public.neo_admin_access() then raise exception 'Autorizacao da loja obrigatoria.';end if;
  rules:=coalesce(p_payload->'shipping_by_state','{}'::jsonb);
  if jsonb_typeof(rules)<>'object' or (select count(*) from jsonb_object_keys(rules))>27 then raise exception 'Confira os fretes cadastrados por estado.';end if;
  for entry in select key,value from jsonb_each_text(rules) loop
   if not (upper(entry.key)=any(valid_states)) or entry.value!~'^\d{1,7}$' or entry.value::bigint>1000000 then raise exception 'Frete invalido para o estado %.',entry.key;end if;
  end loop;
  result:=public.neo_shop_v34(p_action,p_payload-'shipping_by_state');
  update neo_private.shop_settings set shipping_by_state=(select coalesce(jsonb_object_agg(upper(key),value::int),'{}'::jsonb) from jsonb_each_text(rules)) where singleton;
  return result;
 elsif p_action='quote' then
  result:=public.neo_shop_v34(p_action,p_payload);state_value:=upper(coalesce(p_payload->>'state',''));shipping_value:=neo_private.shop_shipping_for_state(state_value);
  return result||jsonb_build_object('shipping_cents',case when (result->>'shipping_ready')::boolean then shipping_value else null end,'total_cents',case when (result->>'shipping_ready')::boolean then (result->>'subtotal_cents')::bigint-(result->>'discount_cents')::bigint+shipping_value else null end,'shipping_state',state_value);
 elsif p_action='order' then
  -- An idempotent retry belongs to its owner and must retain the original order.
  -- After initial creation the cart may be empty; do not quote it again.
  if p_payload ? 'request_key' and exists (
    select 1 from neo_private.shop_orders o
    where o.user_id=auth.uid() and o.request_key=(p_payload->>'request_key')::uuid
  ) then
    return public.neo_shop_v34(p_action,p_payload);
  end if;
  state_value:=upper(coalesce(p_payload->'address'->>'state',''));if not (state_value=any(valid_states)) then raise exception 'Estado de entrega invalido.';end if;
  base_quote:=public.neo_shop_v34('quote','{}'::jsonb);shipping_value:=neo_private.shop_shipping_for_state(state_value);
  adjusted_quote:=base_quote||jsonb_build_object('shipping_cents',shipping_value,'total_cents',(base_quote->>'subtotal_cents')::bigint-(base_quote->>'discount_cents')::bigint+shipping_value);
  if (p_payload->>'expected_total_cents')::bigint is distinct from (adjusted_quote->>'total_cents')::bigint then raise exception 'Os valores do frete mudaram. Atualize e confira o carrinho novamente.';end if;
  result:=public.neo_shop_v34(p_action,p_payload||jsonb_build_object('expected_total_cents',base_quote->'total_cents'));order_id:=(result->>'id')::uuid;
  update neo_private.shop_orders set shipping_cents=shipping_value,total_cents=subtotal_cents-discount_cents+shipping_value,shipping_state=state_value where id=order_id and shipping_state='';
  return result;
 end if;
 result:=public.neo_shop_v34(p_action,p_payload);
 if p_action='catalog' then result:=jsonb_set(result,'{settings,shipping_by_state}',coalesce((select shipping_by_state from neo_private.shop_settings where singleton),'{}'::jsonb),true);
 elsif p_action in ('orders','manage_orders','export_orders') then result:=coalesce((select jsonb_agg(x.value||jsonb_build_object('shipping_state',o.shipping_state) order by x.ordinality) from jsonb_array_elements(result) with ordinality x join neo_private.shop_orders o on o.id=(x.value->>'id')::uuid),'[]'::jsonb);end if;
 return result;
end$function$
;
