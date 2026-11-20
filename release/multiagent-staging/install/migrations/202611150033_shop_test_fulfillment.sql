-- Permite testar o fluxo operacional de envio sem uma cobranca real.
begin;
do $$begin
 if to_regprocedure('public.neo_shop_v33(text,jsonb)') is null then
  alter function public.neo_shop(text,jsonb) rename to neo_shop_v33;
 end if;
end$$;
revoke all on function public.neo_shop_v33(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare fulfillment_value text;tracking_value text;url_value text;
begin
 if p_action='fulfill' then
  if auth.uid() is null or not public.neo_admin_access() then raise exception 'Autorizacao da loja obrigatoria.';end if;
  fulfillment_value:=coalesce(p_payload->>'fulfillment','');
  tracking_value:=coalesce(p_payload->>'tracking','');
  url_value:=coalesce(p_payload->>'tracking_url','');
  if fulfillment_value not in ('processing','dispatched','delivered') or length(tracking_value)>150 or length(url_value)>500 or (url_value<>'' and url_value!~'^https://') then
   raise exception 'Dados de envio invalidos.';
  end if;
  update neo_private.shop_orders set fulfillment=fulfillment_value,tracking=tracking_value,tracking_url=url_value
  where id=(p_payload->>'id')::uuid and status in ('paid','test_paid','paid_review');
  if not found then raise exception 'O pagamento deve estar aprovado antes do envio.';end if;
  return '{"ok":true}'::jsonb;
 end if;
 return public.neo_shop_v33(p_action,p_payload);
end$$;
revoke all on function public.neo_shop(text,jsonb) from public,anon;
grant execute on function public.neo_shop(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
