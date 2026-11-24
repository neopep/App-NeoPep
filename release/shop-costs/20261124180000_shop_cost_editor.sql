begin;

alter table neo_private.shop_acquisitions
  add column entry_kind text not null default 'acquisition'
  check (entry_kind in ('cost_only', 'acquisition'));
create index shop_acquisitions_history on neo_private.shop_acquisitions(product_id, recorded_at desc, id desc);

create function public.neo_shop_costs_v1(p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid();
  target_product uuid;
  product_stock integer;
  latest uuid;
  request_id uuid;
  existing neo_private.shop_acquisitions;
  rate neo_private.shop_fx_rates;
  kind text;
  currency_code text;
  quantity integer;
  cost_minor numeric;
  brl_rate numeric;
  rate_source text;
  rate_date timestamptz;
  entry_date timestamptz;
  entry_id uuid;
  page_timestamp timestamptz;
  page_id uuid;
  result jsonb;
begin
  -- Financial costs are restricted to administrators, never community-only moderators.
  -- neo_admin_access() also recognizes community_moderators and is too broad here.
  if actor is null or not exists (
    select 1 from neo_private.admin_members where user_id = actor
  ) then
    raise exception 'shop_cost_admin_required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('read', 'register')
      or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'shop_cost_invalid_request' using errcode = '22023';
  end if;
  target_product := (p_payload->>'product_id')::uuid;

  if p_action = 'register' then
    -- Same lock order as checkout and the existing stock editor.
    perform pg_advisory_xact_lock(642917200);
    select stock into product_stock from neo_private.shop_products
      where id = target_product and deleted_at is null for update;
  else
    select stock into product_stock from neo_private.shop_products
      where id = target_product and deleted_at is null;
  end if;
  if not found then
    raise exception 'shop_cost_product_unavailable' using errcode = '22023';
  end if;

  select a.id into latest from neo_private.shop_acquisitions a
    where a.product_id = target_product order by a.recorded_at desc, a.id desc limit 1;

  if p_action = 'register' then
    request_id := (p_payload->>'request_key')::uuid;
    kind := p_payload->>'entry_kind';
    currency_code := p_payload->>'currency';
    if request_id is null or kind is null or kind not in ('cost_only','acquisition')
        or currency_code is null or currency_code not in ('BRL','USD')
        or coalesce(p_payload->>'quantity','') !~ '^[1-9][0-9]{0,6}$'
        or coalesce(p_payload->>'unit_cost','') !~ '^[0-9]{1,11}(\.[0-9]{1,8})?$'
        or coalesce(p_payload->>'acquired_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'shop_cost_invalid_request' using errcode = '22023';
    end if;
    quantity := (p_payload->>'quantity')::integer;
    cost_minor := trim_scale((p_payload->>'unit_cost')::numeric * 100);
    entry_date := (p_payload->>'acquired_on')::date::timestamp at time zone 'UTC';
    if quantity > 1000000 or cost_minor > 1000000000000
        or entry_date > date_trunc('day', now(), 'UTC') then
      raise exception 'shop_cost_invalid_request' using errcode = '22023';
    end if;
    if currency_code = 'USD' then
      rate_source := btrim(p_payload->>'fx_source');
      if coalesce(p_payload->>'fx_rate','') !~ '^[0-9]{1,7}(\.[0-9]{1,10})?$'
          or coalesce(p_payload->>'fx_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          or coalesce(length(rate_source),0) not between 1 and 160 then
        raise exception 'shop_cost_invalid_fx' using errcode = '22023';
      end if;
      brl_rate := (p_payload->>'fx_rate')::numeric;
      rate_date := (p_payload->>'fx_on')::date::timestamp at time zone 'UTC';
      if brl_rate <= 0 or brl_rate > 1000000 or rate_date > entry_date then
        raise exception 'shop_cost_invalid_fx' using errcode = '22023';
      end if;
    end if;

    select * into existing from neo_private.shop_acquisitions a where a.request_key = request_id;
    if found then
      select * into rate from neo_private.shop_fx_rates f where f.id = existing.fx_rate_id;
      if row(existing.product_id, existing.actor_id, existing.entry_kind, existing.currency,
             existing.quantity, existing.unit_cost_minor, existing.acquired_at,
             rate.brl_per_usd, rate.quoted_at, rate.source)
         is distinct from row(target_product, actor, kind, currency_code, quantity, cost_minor,
                             entry_date, brl_rate, rate_date, rate_source) then
        raise exception 'shop_cost_request_conflict' using errcode = '23505';
      end if;
    else
      if latest is distinct from (p_payload->>'revision')::uuid
          or product_stock is distinct from (p_payload->>'expected_stock')::integer then
        raise exception 'shop_cost_product_changed' using errcode = '40001';
      end if;
      if kind = 'acquisition' and product_stock + quantity > 1000000 then
        raise exception 'shop_cost_stock_limit' using errcode = '22023';
      end if;
      if currency_code = 'USD' then
        insert into neo_private.shop_fx_rates(brl_per_usd, quoted_at, source)
          values (brl_rate, rate_date, rate_source) on conflict (source, quoted_at, brl_per_usd) do nothing;
        select * into strict rate from neo_private.shop_fx_rates f
          where f.brl_per_usd = brl_rate and f.quoted_at = rate_date and f.source = rate_source;
      end if;
      insert into neo_private.shop_acquisitions
        (product_id, request_key, quantity, currency, unit_cost_minor, fx_rate_id, acquired_at, recorded_at, actor_id, entry_kind)
        values (target_product, request_id, quantity, currency_code, cost_minor, rate.id, entry_date, clock_timestamp(), actor, kind)
        returning id into entry_id;
      if kind = 'acquisition' then
        update neo_private.shop_products set stock = product_stock + quantity, updated_at = clock_timestamp()
          where id = target_product;
        insert into neo_private.shop_stock_movements
          (request_key, product_id, acquisition_id, kind, balance_before, balance_after, reason, actor_id)
          values (request_id, target_product, entry_id, 'acquisition', product_stock, product_stock + quantity, 'Aquisição registrada na Loja', actor);
        product_stock := product_stock + quantity;
      end if;
      latest := entry_id;
    end if;
  elsif p_payload->>'before' is not null then
    select a.recorded_at, a.id into strict page_timestamp, page_id
      from neo_private.shop_acquisitions a
      where a.product_id = target_product and a.id = (p_payload->>'before')::uuid;
  end if;

  select coalesce(jsonb_agg(line order by recorded_at desc, id desc), '[]') into result from (
    select a.recorded_at, a.id, jsonb_build_object(
      'id', a.id, 'entry_kind', base.entry_kind, 'quantity', a.quantity, 'currency', a.currency,
      'unit_cost', trim_scale(a.unit_cost_minor * 0.01)::text,
      'brl_unit', trim_scale(a.unit_cost_brl_cents * 0.01)::text,
      'brl_total', trim_scale(a.unit_cost_brl_cents * a.quantity * 0.01)::text,
      'acquired_on', (a.acquired_at at time zone 'UTC')::date,
      'fx_rate', f.brl_per_usd::text, 'fx_source', f.source,
      'fx_on', (f.quoted_at at time zone 'UTC')::date
    ) as line
    from neo_private.shop_acquisition_costs a
    join neo_private.shop_acquisitions base on base.id = a.id
    left join neo_private.shop_fx_rates f on f.id = a.fx_rate_id
    where a.product_id = target_product and (page_id is null or (a.recorded_at, a.id) < (page_timestamp, page_id))
    order by a.recorded_at desc, a.id desc limit 21
  ) history;
  return jsonb_build_object('stock', product_stock, 'revision', latest,
    'history', result - 20, 'next', case when jsonb_array_length(result) = 21 then result->19->>'id' end);
end
$$;
revoke all on function public.neo_shop_costs_v1(text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.neo_shop_costs_v1(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
