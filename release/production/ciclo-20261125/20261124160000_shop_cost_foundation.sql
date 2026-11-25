begin;

create table neo_private.shop_fx_rates (
  id uuid primary key default gen_random_uuid(),
  brl_per_usd numeric not null check (brl_per_usd > 0 and brl_per_usd <= 1000000 and scale(brl_per_usd) <= 10),
  quoted_at timestamptz not null,
  source text not null check (length(btrim(source)) between 1 and 160),
  recorded_at timestamptz not null default now(),
  unique (source, quoted_at, brl_per_usd)
);

create table neo_private.shop_acquisitions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references neo_private.shop_products(id),
  request_key uuid not null unique,
  quantity integer not null check (quantity between 1 and 1000000),
  currency text not null check (currency in ('BRL', 'USD')),
  unit_cost_minor numeric not null check (
    unit_cost_minor between 0 and 1000000000000 and scale(unit_cost_minor) <= 6
  ),
  fx_rate_id uuid references neo_private.shop_fx_rates(id),
  acquired_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_id uuid not null,
  check ((currency = 'USD') = (fx_rate_id is not null)),
  unique (id, product_id)
);
create index shop_acquisitions_product_date on neo_private.shop_acquisitions(product_id, acquired_at);

create view neo_private.shop_acquisition_costs with (security_invoker = true) as
select a.*, a.unit_cost_minor * coalesce(f.brl_per_usd, 1) as unit_cost_brl_cents
from neo_private.shop_acquisitions a
left join neo_private.shop_fx_rates f on f.id = a.fx_rate_id;

create table neo_private.shop_stock_movements (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  product_id uuid not null references neo_private.shop_products(id),
  order_id uuid references neo_private.shop_orders(id),
  acquisition_id uuid unique,
  batch_id uuid,
  reverses_id uuid unique,
  kind text not null check (kind in ('adjustment', 'acquisition', 'reserve', 'release', 'sale', 'return', 'reversal')),
  balance_before integer not null check (balance_before between 0 and 1000000),
  balance_after integer not null check (balance_after between 0 and 1000000),
  delta integer generated always as (balance_after - balance_before) stored,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  actor_id uuid,
  recorded_at timestamptz not null default now(),
  unique (id, product_id),
  foreign key (acquisition_id, product_id) references neo_private.shop_acquisitions(id, product_id),
  foreign key (reverses_id, product_id) references neo_private.shop_stock_movements(id, product_id),
  check ((kind = 'reversal') = (reverses_id is not null)),
  check ((kind = 'acquisition') = (acquisition_id is not null)),
  check (kind not in ('reserve', 'release', 'sale', 'return') or order_id is not null),
  check (kind not in ('adjustment', 'acquisition', 'reversal') or actor_id is not null),
  check (case kind
    when 'sale' then balance_after = balance_before
    when 'reserve' then balance_after < balance_before
    when 'release' then balance_after > balance_before
    when 'return' then balance_after > balance_before
    when 'acquisition' then balance_after > balance_before
    else balance_after <> balance_before
  end)
);
create index shop_stock_movements_product_date on neo_private.shop_stock_movements(product_id, recorded_at);
create index shop_stock_movements_order on neo_private.shop_stock_movements(order_id) where order_id is not null;
create index shop_stock_movements_batch on neo_private.shop_stock_movements(batch_id) where batch_id is not null;

-- Orders already own quantities, prices, shipping, discounts and payment environment.
-- line_position is the one-based position in the existing orders.items array.
create table neo_private.shop_sale_cost_snapshots (
  order_id uuid not null references neo_private.shop_orders(id),
  line_position integer not null check (line_position > 0),
  reservation_movement_id uuid references neo_private.shop_stock_movements(id),
  policy_version integer not null check (policy_version > 0),
  unit_cost_brl_cents numeric check (
    unit_cost_brl_cents between 0 and 1000000000000000000 and scale(unit_cost_brl_cents) <= 16
  ),
  recorded_at timestamptz not null default now(),
  primary key (order_id, line_position)
);

alter table neo_private.shop_fx_rates enable row level security;
alter table neo_private.shop_acquisitions enable row level security;
alter table neo_private.shop_stock_movements enable row level security;
alter table neo_private.shop_sale_cost_snapshots enable row level security;

revoke all on neo_private.shop_fx_rates, neo_private.shop_acquisitions,
  neo_private.shop_acquisition_costs, neo_private.shop_stock_movements,
  neo_private.shop_sale_cost_snapshots from public, anon, authenticated, service_role;

create function neo_private.shop_cost_append_only()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'shop_cost_history_is_append_only' using errcode = '55000';
end
$$;

create trigger shop_fx_rates_append_only before update or delete or truncate
  on neo_private.shop_fx_rates for each statement execute function neo_private.shop_cost_append_only();
create trigger shop_acquisitions_append_only before update or delete or truncate
  on neo_private.shop_acquisitions for each statement execute function neo_private.shop_cost_append_only();
create trigger shop_stock_movements_append_only before update or delete or truncate
  on neo_private.shop_stock_movements for each statement execute function neo_private.shop_cost_append_only();
create trigger shop_sale_cost_snapshots_append_only before update or delete or truncate
  on neo_private.shop_sale_cost_snapshots for each statement execute function neo_private.shop_cost_append_only();

create function neo_private.shop_validate_sale_cost_snapshot()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare
  sale neo_private.shop_orders;
  line jsonb;
begin
  select * into strict sale from neo_private.shop_orders where id = new.order_id for share;
  line := sale.items -> (case when new.line_position > 0 then new.line_position - 1 end);
  if sale.environment <> 'production' or sale.status <> 'paid'
      or sale.stock_released or jsonb_typeof(line) is distinct from 'object'
      or line->>'product_id' is null then
    raise exception 'shop_cost_snapshot_requires_paid_sale_line' using errcode = '23514';
  end if;
  if new.reservation_movement_id is not null and not exists (
    select 1 from neo_private.shop_stock_movements
    where id = new.reservation_movement_id and order_id = new.order_id
      and product_id = (line->>'product_id')::uuid and kind = 'reserve'
  ) then
    raise exception 'shop_cost_snapshot_reservation_mismatch' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger shop_sale_cost_validate before insert on neo_private.shop_sale_cost_snapshots
  for each row execute function neo_private.shop_validate_sale_cost_snapshot();

-- Internal foundation for a future admin RPC. No route or legacy trigger calls it.
create function neo_private.shop_record_stock_adjustment(
  p_product uuid, p_request uuid, p_expected integer, p_delta integer,
  p_reason text, p_batch uuid default null, p_reverses uuid default null
) returns uuid language plpgsql set search_path = pg_catalog as $$
declare
  actor uuid := auth.uid();
  prior neo_private.shop_stock_movements;
  balance integer;
  next_balance bigint;
  movement_id uuid;
begin
  if actor is null or not coalesce(public.neo_admin_access(), false) then
    raise exception 'shop_stock_admin_required' using errcode = '42501';
  end if;
  if p_product is null or p_request is null or p_expected is null
      or p_expected not between 0 and 1000000 or p_delta is null or p_delta = 0
      or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'shop_stock_invalid_request' using errcode = '22023';
  end if;

  -- Acquire the same lock, in the same order, as the existing checkout.
  perform pg_advisory_xact_lock(642917200);
  select * into prior from neo_private.shop_stock_movements where request_key = p_request;
  if found then
    if row(prior.product_id, prior.actor_id, prior.balance_before, prior.delta,
           prior.reason, prior.batch_id, prior.reverses_id)
       is distinct from row(p_product, actor, p_expected, p_delta, btrim(p_reason), p_batch, p_reverses) then
      raise exception 'shop_stock_request_conflict' using errcode = '23505';
    end if;
    return prior.id;
  end if;

  select stock into strict balance from neo_private.shop_products where id = p_product for update;
  if balance <> p_expected then
    raise exception 'shop_stock_balance_changed' using errcode = '40001';
  end if;
  next_balance := balance::bigint + p_delta;
  if next_balance not between 0 and 1000000 then
    raise exception 'shop_stock_balance_out_of_range' using errcode = '22023';
  end if;

  if p_reverses is not null then
    select * into prior from neo_private.shop_stock_movements where id = p_reverses;
    if not found or prior.kind <> 'adjustment' or prior.product_id <> p_product
        or prior.delta <> -p_delta or prior.balance_after <> p_expected then
      raise exception 'shop_stock_invalid_reversal' using errcode = '22023';
    end if;
    -- A compensating movement is appended. A later mutation needs a new adjustment.
    if exists (select 1 from neo_private.shop_stock_movements
        where product_id = p_product and id <> prior.id and recorded_at >= prior.recorded_at) then
      raise exception 'shop_stock_reversal_requires_review' using errcode = '40001';
    end if;
  end if;

  update neo_private.shop_products set stock = next_balance::integer, updated_at = clock_timestamp()
    where id = p_product;
  insert into neo_private.shop_stock_movements (
    request_key, product_id, batch_id, reverses_id, kind, balance_before,
    balance_after, reason, actor_id, recorded_at
  ) values (
    p_request, p_product, p_batch, p_reverses,
    case when p_reverses is null then 'adjustment' else 'reversal' end,
    balance, next_balance::integer, btrim(p_reason), actor, clock_timestamp()
  ) returning id into movement_id;
  return movement_id;
end
$$;

revoke all on function neo_private.shop_cost_append_only(), neo_private.shop_validate_sale_cost_snapshot(),
  neo_private.shop_record_stock_adjustment(uuid, uuid, integer, integer, text, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
