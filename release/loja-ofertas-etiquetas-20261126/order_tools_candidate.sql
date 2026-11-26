-- Administrative order identification and reversible archive, after catalog_offer_candidate.sql.
begin;
create table if not exists neo_private.shop_test_order_archive(
 order_id uuid primary key references neo_private.shop_orders(id) on delete cascade,
 archived_at timestamptz not null default now(),
 actor_id uuid not null
);
alter table neo_private.shop_test_order_archive enable row level security;
revoke all on neo_private.shop_test_order_archive from public,anon,authenticated;
do $patch$
declare definition text; anchor text:=E'\n result:=neo_private.shop_before_member_visibility(p_action,p_payload);'; tail text:=E'\n return result;\nend $function$'; block text; metadata text;
begin
 definition:=pg_get_functiondef('public.neo_shop(text,jsonb)'::regprocedure);
 if position('shop_test_order_archive' in definition)>0 then return;end if;
 if position('neo_private.shop_catalog_offer_v1(actor' in definition)=0 or position(anchor in definition)=0 or position(tail in definition)=0 then raise exception 'Apply audited catalog offer patch first';end if;
 block:=$body$
 if p_action in ('shipping_label_orders','order_qr_lookup','archive_test_orders','restore_test_orders','test_orders_archive_list') then
  if not admin then raise exception 'Autorização administrativa obrigatória.' using errcode='42501';end if;
  perform neo_private.take_limit('shop_manage',120,3600);
  if p_action='shipping_label_orders' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'address',o.address,'status',o.status,'environment',o.environment,'fulfillment',o.fulfillment,'cancellation_status',o.cancellation_status,'tracking',o.tracking,'created_at',o.created_at) order by o.created_at desc)
    from neo_private.shop_orders o where o.environment='production' and o.status='paid' and o.cancellation_status not in ('requested','approved')),'[]'::jsonb);
  elsif p_action='order_qr_lookup' then
   term:=lower(btrim(coalesce(p_payload->>'code','')));
   if term !~ '^([0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then raise exception 'Código inválido.';end if;
   return coalesce((select jsonb_agg(x) from (select o.id,o.items,o.address,o.subtotal_cents,o.shipping_cents,o.total_cents,o.status,o.environment,o.fulfillment,o.tracking,o.tracking_url,o.created_at,o.expires_at,o.discount_cents,o.discounts,o.coupon_code,o.payment_method,o.cancellation_status,o.cancellation_reason,o.cancellation_note,o.billing_document_type,o.billing_document_number,(select email from auth.users where id=o.user_id) as customer_email,exists(select 1 from neo_private.shop_test_order_archive a where a.order_id=o.id) as test_archived
   from neo_private.shop_orders o where (length(term)=36 and o.id::text=term) or (length(term)=8 and left(o.id::text,8)=term) limit 2)x),'[]'::jsonb);
  elsif p_action='test_orders_archive_list' then
   return coalesce((select jsonb_agg(x order by x.created_at desc) from (select o.id,o.items,o.address,o.subtotal_cents,o.shipping_cents,o.total_cents,o.status,o.environment,o.fulfillment,o.tracking,o.tracking_url,o.created_at,o.discount_cents,o.discounts,o.coupon_code,o.cancellation_status,o.cancellation_reason,o.cancellation_note,exists(select 1 from neo_private.shop_test_order_archive a where a.order_id=o.id) as test_archived from neo_private.shop_orders o where o.environment='test')x),'[]'::jsonb);
  end if;
  if coalesce(p_payload->>'all','false')<>'true' and nullif(p_payload->>'id','') is null then raise exception 'Selecione um pedido de teste.';end if;
  if p_action='archive_test_orders' then
   insert into neo_private.shop_test_order_archive(order_id,actor_id)
   select o.id,actor from neo_private.shop_orders o where o.environment='test'
    and o.status not in ('awaiting_payment','pending')
    and (p_payload->>'all'='true' or o.id=nullif(p_payload->>'id','')::uuid)
   on conflict(order_id) do nothing;
  else
   delete from neo_private.shop_test_order_archive a using neo_private.shop_orders o where a.order_id=o.id and o.environment='test'
    and (p_payload->>'all'='true' or o.id=nullif(p_payload->>'id','')::uuid);
  end if;
  get diagnostics changed=row_count;
  return jsonb_build_object('changed',changed);
 end if;
$body$;
 metadata:=$body$
 if p_action='catalog' and admin then
  result:=jsonb_set(result,'{shop_extensions}',coalesce(result->'shop_extensions','{}')||'{"order_archive":true,"shipping_batch_qr":true}'::jsonb);
 elsif p_action='manage_orders' and admin then
  result:=coalesce((select jsonb_agg(i.item||jsonb_build_object('test_archived',exists(select 1 from neo_private.shop_test_order_archive a where a.order_id=(i.item->>'id')::uuid)) order by i.pos)
  from jsonb_array_elements(result) with ordinality i(item,pos)),'[]'::jsonb);
 end if;
$body$;
 definition:=replace(definition,anchor,block||anchor);
 definition:=replace(definition,tail,metadata||tail);
 execute definition;
end
$patch$;
commit;
