begin;

create function public.neo_shop_financial_dashboard_v1(p_filters jsonb)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid();
  local_today date := (now() at time zone 'America/Sao_Paulo')::date;
  start_day date;
  end_day date;
  target_product uuid;
  target_category text;
  target_status text;
  target_environment text;
  target_fulfillment text;
  group_by text;
  detail_page integer;
  output jsonb;
begin
  if actor is null or not exists (
    select 1 from neo_private.admin_members where user_id = actor
  ) then
    raise exception 'shop_financial_admin_required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_filters) is distinct from 'object' then
    raise exception 'shop_financial_invalid_filters' using errcode = '22023';
  end if;

  start_day := coalesce(nullif(p_filters->>'from','')::date, local_today - 29);
  end_day := coalesce(nullif(p_filters->>'to','')::date, local_today);
  target_product := nullif(p_filters->>'product_id','')::uuid;
  target_category := nullif(p_filters->>'category','');
  target_status := nullif(p_filters->>'status','');
  target_environment := nullif(p_filters->>'environment','');
  target_fulfillment := nullif(p_filters->>'fulfillment','');
  group_by := coalesce(nullif(p_filters->>'group_by',''),'day');
  detail_page := coalesce((p_filters->>'page')::integer,1);
  if not isfinite(start_day) or not isfinite(end_day) or end_day > local_today
     or start_day > end_day or end_day - start_day > 365
     or length(target_category) > 40
     or target_status not in ('awaiting_payment','pending','paid','paid_review','test_paid',
          'expired','rejected','cancelled','refunded','partially_refunded','charged_back')
     or target_environment not in ('production','test')
     or target_fulfillment not in ('processing','dispatched','delivered')
     or group_by not in ('day','product','category') or detail_page not between 1 and 10000 then
    raise exception 'shop_financial_invalid_filters' using errcode = '22023';
  end if;

  with window_orders as (
    select o.id, o.items, o.discount_cents, o.shipping_cents, o.environment, o.stock_released,
      (o.created_at at time zone 'America/Sao_Paulo')::date as day,
      case when o.status = 'paid_review' and exists (
        select 1 from neo_private.shop_payments pay
        where pay.payment_id = o.payment_id and pay.order_id = o.id and pay.status = 'partially_refunded'
      ) then 'partially_refunded' else o.status end as status
    from neo_private.shop_orders o
    where o.created_at >= (start_day::timestamp at time zone 'America/Sao_Paulo')
      and o.created_at < ((end_day+1)::timestamp at time zone 'America/Sao_Paulo')
      and (target_environment is null or o.environment = target_environment)
      and (target_fulfillment is null or o.fulfillment = target_fulfillment)
  ), lines as (
    select o.*, item.pos, item.value->>'name' as item_name,
      (item.value->>'product_id')::uuid as product_id,
      (item.value->>'quantity')::integer as units,
      (item.value->>'quantity')::numeric * (item.value->>'unit_price_cents')::numeric as gross
    from window_orders o
    cross join lateral jsonb_array_elements(o.items) with ordinality item(value,pos)
    where target_status is null or status = target_status
  ), running as (
    select l.*, sum(gross) over (partition by id) as order_gross,
      sum(gross) over (partition by id order by pos rows unbounded preceding) as running_gross
    from lines l
  ), selected as (
    select l.*, p.category, s.unit_cost_brl_cents * l.units as cost,
      case when order_gross > 0 then round(discount_cents * running_gross / order_gross)
        - round(discount_cents * (running_gross-gross) / order_gross) else 0 end as discount
    from running l
    left join neo_private.shop_products p on p.id = l.product_id
    left join neo_private.shop_sale_cost_snapshots s on s.order_id = l.id and s.line_position = l.pos
    where (target_product is null or l.product_id = target_product)
      and (target_category is null or p.category = target_category)
  ), sales as (
    select * from selected
    where environment = 'production' and status = 'paid' and not stock_released
  ), totals as (
    select count(distinct id) as orders, coalesce(sum(units),0) as units,
      coalesce(sum(units) filter (where cost is not null),0) as covered_units,
      coalesce(sum(gross),0) as gross, coalesce(sum(discount),0) as discount,
      coalesce(sum(gross-discount),0) as commercial, sum(cost) as known_cost
    from sales
  ), order_states as (
    select environment, status, count(distinct id) as orders
    from selected group by environment, status
  ), sale_orders as (
    select distinct id, shipping_cents from sales
  ), grouped as (
    select case group_by when 'day' then day::text when 'product' then product_id::text
      else coalesce(category,'') end as key,
      max(case group_by when 'day' then day::text when 'product' then coalesce(item_name,'Produto')
        else coalesce(category,'Sem categoria atual') end) as label,
      sum(gross-discount) as commercial_cents, sum(units) as units, count(distinct id) as orders
    from sales group by 1
  ), detail as (
    select key,label,commercial_cents::text,units,orders
    from grouped order by key desc nulls last limit 20 offset (detail_page-1)*20
  ), stock as (
    select id,name,stock from neo_private.shop_products
    where deleted_at is null and active and (target_product is null or id = target_product)
      and (target_category is null or category = target_category)
  ), alerts as (
    select * from stock where stock <= 5 order by stock,name,id limit 10
  )
  select jsonb_build_object(
    'from',start_day,'to',end_day,'page',detail_page,
    'detail_pages',(select (count(*)+19)/20 from grouped),
    'details',(select coalesce(jsonb_agg(to_jsonb(d) order by key desc nulls last),'[]') from detail d),
    'states',(select coalesce(jsonb_agg(to_jsonb(s) order by environment,status),'[]') from order_states s),
    'stock',jsonb_build_object('units',(select coalesce(sum(stock),0) from stock),
      'alert_count',(select count(*) from stock where stock <= 5),
      'alerts',(select coalesce(jsonb_agg(to_jsonb(a) order by stock,name,id),'[]') from alerts a)),
    'sales',jsonb_build_object('orders',t.orders,'units',t.units,'covered_units',t.covered_units,
      'coverage_percent',case when t.units > 0 then round(100*t.covered_units::numeric/t.units,2)::text end,
      'gross_cents',t.gross::text,'discount_cents',t.discount::text,'commercial_cents',t.commercial::text,
      'shipping_cents',case when target_product is null and target_category is null
        then (select coalesce(sum(shipping_cents),0)::text from sale_orders) end,
      'known_cmv_cents',round(t.known_cost)::text,
      'profit_cents',case when t.units > 0 and t.units = t.covered_units then (t.commercial-round(t.known_cost))::text end,
      'margin_percent',case when t.units > 0 and t.units = t.covered_units and t.commercial > 0
        then round(100*(t.commercial-round(t.known_cost))/t.commercial,2)::text end))
  into output from totals t;
  return output;
end
$$;

revoke all on function public.neo_shop_financial_dashboard_v1(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.neo_shop_financial_dashboard_v1(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
