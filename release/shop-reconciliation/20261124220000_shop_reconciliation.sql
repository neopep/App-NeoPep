begin;

-- Keep the quantity on shop_products. This journal observes committed deltas.
create table neo_private.shop_stock_journal (
  id bigint generated always as identity primary key,
  product_id uuid not null references neo_private.shop_products(id),
  transaction_id xid8 not null default pg_current_xact_id(),
  balance_before integer not null,
  balance_after integer not null,
  cost_before numeric,
  actor_id uuid,
  recorded_at timestamptz not null default clock_timestamp()
);
create index shop_stock_journal_product on neo_private.shop_stock_journal(product_id,id desc);
create index shop_stock_journal_transaction on neo_private.shop_stock_journal(transaction_id,product_id,id desc);

create table neo_private.shop_stock_valuation (
  journal_id bigint primary key references neo_private.shop_stock_journal(id),
  movement_id uuid not null unique references neo_private.shop_stock_movements(id),
  unit_cost numeric,
  policy_version integer not null default 1 check (policy_version = 1)
);

create table neo_private.shop_order_stock_links (
  journal_id bigint primary key references neo_private.shop_stock_journal(id),
  movement_id uuid not null unique references neo_private.shop_stock_movements(id),
  order_id uuid not null references neo_private.shop_orders(id),
  line_position integer not null check(line_position > 0)
);
create index shop_order_stock_position on neo_private.shop_order_stock_links(order_id,line_position,journal_id desc);

create table neo_private.shop_reconciliation_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references neo_private.shop_orders(id),
  event_type text not null,
  state jsonb not null,
  recorded_at timestamptz not null default clock_timestamp()
);
create index shop_reconciliation_events_order on neo_private.shop_reconciliation_events(order_id,id desc);

-- One verified total per expense kind/order. Zero is explicit. A correction is a
-- new entry that supersedes the previous total of that kind, with its own evidence.
create table neo_private.shop_reconciliation_evidence (
  request_key uuid primary key,
  order_id uuid not null references neo_private.shop_orders(id),
  kind text not null check(kind in ('fee','shipping_cost','tax','other','refund')),
  amount_cents bigint not null check(amount_cents between 0 and 1000000000000),
  source_ref text not null check(length(btrim(source_ref)) between 1 and 160),
  actor_id uuid not null,
  effective_on date not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(order_id,kind,source_ref)
);
create index shop_reconciliation_evidence_order on neo_private.shop_reconciliation_evidence(order_id,kind,recorded_at desc);

create table neo_private.shop_physical_returns (
  request_key uuid primary key references neo_private.shop_stock_movements(request_key) deferrable initially deferred,
  order_id uuid not null references neo_private.shop_orders(id),
  line_position integer not null check (line_position > 0),
  units integer not null check (units > 0),
  source_ref text not null check(length(btrim(source_ref)) between 1 and 160),
  unique(order_id,line_position,source_ref)
);
create index shop_physical_returns_order on neo_private.shop_physical_returns(order_id,line_position);

do $$
declare relation_name text;
begin
  foreach relation_name in array array['shop_stock_journal','shop_stock_valuation','shop_order_stock_links',
    'shop_reconciliation_events','shop_reconciliation_evidence','shop_physical_returns'] loop
    execute format('alter table neo_private.%I enable row level security',relation_name);
    execute format('revoke all on neo_private.%I from public, anon, authenticated, service_role',relation_name);
    execute format('create trigger shop_reconciliation_append_only before update or delete or truncate on
      neo_private.%I for each statement execute function neo_private.shop_cost_append_only()',relation_name);
  end loop;
end $$;

create function neo_private.shop_journal_stock()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare previous_cost numeric;
begin
  if tg_op='INSERT' then
    if new.stock > 0 then
      insert into neo_private.shop_stock_journal(product_id,balance_before,balance_after,actor_id)
        values(new.id,0,new.stock,auth.uid());
    end if;
    return new;
  end if;
  if old.stock = new.stock then return new; end if;
  if old.stock > 0 then
    select case when v.journal_id is not null then v.unit_cost
        when j.balance_after < j.balance_before then j.cost_before end
      into previous_cost
      from neo_private.shop_stock_journal j
      left join neo_private.shop_stock_valuation v on v.journal_id=j.id
      where j.product_id=old.id order by j.id desc limit 1;
  end if;
  insert into neo_private.shop_stock_journal(product_id,balance_before,balance_after,cost_before,actor_id)
    values(new.id,old.stock,new.stock,previous_cost,auth.uid());
  return new;
end $$;

-- Verified inputs are the only positive deltas allowed to carry known cost.
create function neo_private.shop_value_stock_movement()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare entry_cost numeric; j neo_private.shop_stock_journal;
begin
  if new.kind not in ('acquisition','return') then return new; end if;
  if new.kind='acquisition' then
    select unit_cost_brl_cents into entry_cost
      from neo_private.shop_acquisition_costs a where a.id=new.acquisition_id;
  elsif new.kind='return' then
    select s.unit_cost_brl_cents into entry_cost from neo_private.shop_physical_returns r
    left join neo_private.shop_sale_cost_snapshots s using(order_id,line_position)
    where r.request_key=new.request_key;
  end if;

  select j0.* into j from neo_private.shop_stock_journal j0
  where j0.product_id=new.product_id and j0.transaction_id=pg_current_xact_id()
    and j0.balance_before=new.balance_before and j0.balance_after=new.balance_after
    and not exists (select 1 from neo_private.shop_stock_valuation v where v.journal_id=j0.id)
  order by j0.id desc limit 1;
  if found then
    insert into neo_private.shop_stock_valuation(journal_id,movement_id,unit_cost)
    values(j.id,new.id,case
      when entry_cost is null then null
      when j.balance_before=0 then round(entry_cost,16)
      when j.cost_before is not null then round(
        (j.cost_before*j.balance_before+entry_cost*new.delta)::numeric(52,24)/j.balance_after,16)
      end);
  end if;
  return new;
end $$;

create function neo_private.shop_journal_order()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare
  observed record;
  j neo_private.shop_stock_journal;
  reservation_id uuid;
  captured_cost numeric;
  delta_expected integer;
  movement_kind text;
  movement_key uuid;
  sale_balance int;
begin
  if tg_op='UPDATE' then
    if row(old.status,old.fulfillment,old.stock_released,old.payment_id,old.cancellation_status)
       is not distinct from row(new.status,new.fulfillment,new.stock_released,new.payment_id,new.cancellation_status)
    then return new; end if;
    if old.stock_released and not new.stock_released then movement_kind:='reserve';
    elsif not old.stock_released and new.stock_released then movement_kind:='release';
    end if;
  elsif not new.stock_released and new.status='awaiting_payment' then
    movement_kind:='reserve';
  end if;
  insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
  values(new.id,'order',jsonb_build_object('status',new.status,'environment',new.environment,
    'fulfillment',new.fulfillment,'stock_released',new.stock_released,'cancellation_status',new.cancellation_status,
    'payment_id',new.payment_id));
  if new.status='refunded' and new.stock_released and (movement_kind='release' or exists (
    select 1 from neo_private.shop_order_stock_links lk
    join neo_private.shop_stock_journal r on r.id=lk.journal_id
    join neo_private.shop_stock_movements m on m.id=lk.movement_id and m.kind='release'
    where lk.order_id=new.id and r.transaction_id=pg_current_xact_id()
  )) then
    insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
      values(new.id,'legacy_refund_release','{"physical_return_unverified":true}');
  end if;

  for observed in select (value->>'product_id')::uuid product_id,
    (value->>'quantity')::integer units, pos::integer line
    from jsonb_array_elements(new.items) with ordinality items(value,pos)
  loop
    if movement_kind is not null then
      delta_expected := case when movement_kind='reserve' then -observed.units else observed.units end;
      select j0.* into j from neo_private.shop_stock_journal j0
      where j0.product_id=observed.product_id and j0.transaction_id=pg_current_xact_id()
        and j0.balance_after-j0.balance_before=delta_expected
        and not exists (select 1 from neo_private.shop_order_stock_links lk where lk.journal_id=j0.id)
        and not exists (select 1 from neo_private.shop_stock_valuation v where v.journal_id=j0.id)
      order by j0.id desc limit 1;
      if found then
        -- Deterministic for this committed journal event; append-only mapping also enforces uniqueness.
        movement_key := md5('shop-01006-journal:'||j.id)::uuid;
        insert into neo_private.shop_stock_movements(id,request_key,product_id,order_id,kind,balance_before,balance_after,reason,actor_id)
          values(movement_key,movement_key,j.product_id,new.id,movement_kind,j.balance_before,j.balance_after,
            'Conciliação 010.06 · '||new.status,auth.uid());
        insert into neo_private.shop_order_stock_links values(j.id,movement_key,new.id,observed.line);
        -- Revalue releases only when they are documented as cancellation or expiry of the reserve.
        if movement_kind='release' then
          select r.cost_before into captured_cost
          from neo_private.shop_order_stock_links lk
          join neo_private.shop_stock_journal r on r.id=lk.journal_id
          join neo_private.shop_stock_movements m on m.id=lk.movement_id and m.kind='reserve'
          where lk.order_id=new.id and lk.line_position=observed.line and r.id<j.id
          order by r.id desc limit 1;
          insert into neo_private.shop_stock_valuation(journal_id,movement_id,unit_cost)
          values(j.id,movement_key,case
            when new.status not in ('expired','cancelled','rejected','test_paid') or captured_cost is null then null
            when j.balance_before=0 then captured_cost
            when j.cost_before is not null then round(
              (j.cost_before*j.balance_before+captured_cost*delta_expected)::numeric(52,24)/j.balance_after,16)
            end);
        end if;
      else
        insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
          values(new.id,'stock_event_missing',jsonb_build_object('line',observed.line,'kind',movement_kind));
      end if;
    end if;
    if new.status='paid' and new.environment='production' and not new.stock_released
       and (tg_op='INSERT' or old.status is distinct from new.status or old.stock_released) then
      select lk.movement_id,r.cost_before into reservation_id,captured_cost
      from neo_private.shop_order_stock_links lk
      join neo_private.shop_stock_journal r on r.id=lk.journal_id
      join neo_private.shop_stock_movements m on m.id=lk.movement_id and m.kind='reserve'
      where lk.order_id=new.id and lk.line_position=observed.line
      order by r.id desc limit 1;
      if movement_kind='reserve' and j.id is null then
        reservation_id:=null; captured_cost:=null;
      end if;
      insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,reservation_movement_id,policy_version,unit_cost_brl_cents)
        values(new.id,observed.line,reservation_id,1,captured_cost) on conflict do nothing;
      if found then
        select stock into sale_balance from neo_private.shop_products where id=observed.product_id;
        if found then
          movement_key:=md5('shop-01006-sale:'||new.id||':'||observed.line)::uuid;
          insert into neo_private.shop_stock_movements(id,request_key,product_id,order_id,kind,balance_before,balance_after,reason,actor_id)
            values(movement_key,movement_key,observed.product_id,new.id,'sale',sale_balance,sale_balance,
              'Venda confirmada · reserva mantida',auth.uid());
        end if;
      end if;
    end if;
  end loop;
  return new;
end $$;

create function neo_private.shop_journal_payment()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op='UPDATE' and row(old.status,old.amount_cents) is not distinct from row(new.status,new.amount_cents)
  then return new; end if;
  insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
    values(new.order_id,'payment',jsonb_build_object('payment_id',new.payment_id,'status',new.status,
      'reported_amount_cents',new.amount_cents,'observed_at',new.updated_at));
  return new;
end $$;

-- Preserve the existing lock order: legacy stock writers lock the product; audit
-- triggers neither acquire an extra advisory lock nor update a protected table.
create trigger shop_01006_stock after insert or update of stock on neo_private.shop_products
  for each row execute function neo_private.shop_journal_stock();
create trigger shop_01006_valuation after insert on neo_private.shop_stock_movements
  for each row when (new.kind in ('acquisition','return')) execute function neo_private.shop_value_stock_movement();
create trigger shop_01006_order after insert or update on neo_private.shop_orders
  for each row execute function neo_private.shop_journal_order();
create trigger shop_01006_payment after insert or update on neo_private.shop_payments
  for each row execute function neo_private.shop_journal_payment();

revoke all on function neo_private.shop_journal_stock(),neo_private.shop_value_stock_movement(),
 neo_private.shop_journal_order(),neo_private.shop_journal_payment() from public,anon,authenticated,service_role;

create function public.neo_shop_reconciliation_v1(p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  actor uuid := auth.uid();
  target_order uuid;
  target_product uuid;
  start_day date;
  end_day date;
  local_today date := (now() at time zone 'America/Sao_Paulo')::date;
  before_id bigint;
  request_id uuid;
  source text;
  expense_kind text;
  expense bigint;
  evidence_date date;
  requested int;
  line_no int;
  line jsonb;
  o neo_private.shop_orders;
  recorded neo_private.shop_reconciliation_evidence;
  returned neo_private.shop_physical_returns;
  stock_before int;
  result jsonb;
begin
  if actor is null or not exists(select 1 from neo_private.admin_members where user_id=actor) then
    raise exception 'shop_reconciliation_admin_required' using errcode='42501';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' or p_action is null then
    raise exception 'shop_reconciliation_invalid_input' using errcode='22023';
  end if;
  target_order:=nullif(p_input->>'order_id','')::uuid;

  if p_action='read' then
    target_product:=nullif(p_input->>'product_id','')::uuid;
    start_day:=coalesce(nullif(p_input->>'from','')::date,local_today-29);
    end_day:=coalesce(nullif(p_input->>'to','')::date,local_today);
    before_id:=nullif(p_input->>'before_event','')::bigint;
    if not isfinite(start_day) or not isfinite(end_day) or start_day>end_day
       or end_day-start_day>365 or end_day>local_today or before_id<=0 then
      raise exception 'shop_reconciliation_invalid_period' using errcode='22023';
    end if;
    with events as (
      select e.* from neo_private.shop_reconciliation_events e
      join neo_private.shop_orders so on so.id=e.order_id
      where e.recorded_at >= (start_day::timestamp at time zone 'America/Sao_Paulo')
        and e.recorded_at < ((end_day+1)::timestamp at time zone 'America/Sao_Paulo')
        and (target_order is null or e.order_id=target_order)
        and (before_id is null or e.id<before_id)
        and (target_product is null or so.items @> jsonb_build_array(jsonb_build_object('product_id',target_product)))
      order by e.id desc limit 21
    ), stock as (
      select j.id,j.product_id,j.balance_before,j.balance_after,j.recorded_at,j.actor_id,p.name,
        lk.order_id, lk.line_position, v.unit_cost,
        coalesce(m.kind,'unclassified') as movement_kind
      from neo_private.shop_stock_journal j join neo_private.shop_products p on p.id=j.product_id
      left join neo_private.shop_order_stock_links lk on lk.journal_id=j.id
      left join neo_private.shop_stock_valuation v on v.journal_id=j.id
      left join neo_private.shop_stock_movements m on m.id=coalesce(lk.movement_id,v.movement_id)
      where (target_order is null or coalesce(lk.order_id,m.order_id)=target_order)
        and (target_product is null or j.product_id=target_product)
        and j.recorded_at >= (start_day::timestamp at time zone 'America/Sao_Paulo')
        and j.recorded_at < ((end_day+1)::timestamp at time zone 'America/Sao_Paulo')
      order by j.id desc limit 20
    ), evidence as (
      select distinct on (kind) kind, amount_cents,source_ref,effective_on
      from neo_private.shop_reconciliation_evidence
      where order_id=target_order order by kind,recorded_at desc,request_key desc
    ), totals as (
      select count(*) filter(where kind<>'refund') expense_kinds,
        sum(amount_cents) filter(where kind<>'refund') expenses,
        max(amount_cents) filter(where kind='refund') refund
      from evidence
    ), order_cost as (
      select so.total_cents, so.environment, so.status,
        count(s.unit_cost_brl_cents)=jsonb_array_length(so.items) and jsonb_array_length(so.items)>0 as complete,
        sum(s.unit_cost_brl_cents*(i.value->>'quantity')::int) as cmv
      from neo_private.shop_orders so
      cross join lateral jsonb_array_elements(so.items) with ordinality i(value,pos)
      left join neo_private.shop_sale_cost_snapshots s on s.order_id=so.id and s.line_position=i.pos
      where so.id=target_order
      group by so.id
    )
    select jsonb_build_object(
      'events',(select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('id',e.id::text) order by id desc),'[]')-20 from events e),
      'next',(select case when count(*)=21 then (array_agg(id order by id desc))[20]::text end from events),
      'stock',(select coalesce(jsonb_agg(to_jsonb(j) order by id desc),'[]') from stock j),
      'evidence',(select coalesce(jsonb_agg(to_jsonb(e) order by kind),'[]') from evidence e),
      'known_expense_cents',t.expenses::text,'known_refund_cents',t.refund::text,
      'expense_coverage',t.expense_kinds,'order_found',exists(select 1 from order_cost),
      'estimated_net_cents',(select case when environment='production' and status='paid'
         and complete and t.expense_kinds=4
         then (total_cents-round(cmv)-t.expenses-coalesce(t.refund,0))::text end from order_cost)
    ) into result from totals t;
    return result;
  end if;

  if p_action not in ('record_evidence','confirm_return') then
    raise exception 'shop_reconciliation_invalid_action' using errcode='22023';
  end if;
  request_id:=(p_input->>'request_key')::uuid;
  source:=btrim(p_input->>'source_ref');
  if request_id is null or target_order is null or coalesce(length(source),0) not between 1 and 160 then
    raise exception 'shop_reconciliation_invalid_reference' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(642917200);
  select * into strict o from neo_private.shop_orders where id=target_order for update;
  if o.environment<>'production' then
    raise exception 'shop_reconciliation_requires_real_order' using errcode='22023';
  end if;

  if p_action='record_evidence' then
    expense_kind:=p_input->>'kind';
    expense:=(p_input->>'amount_cents')::bigint;
    evidence_date:=(p_input->>'effective_on')::date;
    if expense_kind is null or expense_kind not in ('fee','shipping_cost','tax','other','refund')
       or expense is null or expense<0 or evidence_date is null or not isfinite(evidence_date)
       or evidence_date>local_today or (expense_kind='refund' and expense>o.total_cents) then
      raise exception 'shop_reconciliation_invalid_expense' using errcode='22023';
    end if;
    select * into recorded from neo_private.shop_reconciliation_evidence where request_key=request_id;
    if found then
      if row(recorded.order_id,recorded.kind,recorded.amount_cents,recorded.source_ref,recorded.actor_id,recorded.effective_on)
         is distinct from row(o.id,expense_kind,expense,source,actor,evidence_date) then
        raise exception 'shop_reconciliation_request_conflict' using errcode='23505';
      end if;
      return jsonb_build_object('ok',true);
    end if;
    insert into neo_private.shop_reconciliation_evidence
      (request_key,order_id,kind,amount_cents,source_ref,actor_id,effective_on)
      values(request_id,o.id,expense_kind,expense,source,actor,evidence_date);
    insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
      values(o.id,'financial_evidence',jsonb_build_object('kind',expense_kind,'amount_cents',expense,
        'reference',source,'effective_on',evidence_date,'actor',actor));
    return jsonb_build_object('ok',true);
  end if;

  line_no:=(p_input->>'line_position')::int;
  requested:=(p_input->>'units')::int;
  line:=o.items->(case when line_no>0 then line_no-1 end);
  if line is null or coalesce(requested,0)<=0 then
    raise exception 'shop_reconciliation_invalid_return' using errcode='22023';
  end if;
  select * into returned from neo_private.shop_physical_returns where request_key=request_id;
  if found then
    if row(returned.order_id,returned.line_position,returned.units,returned.source_ref)
       is distinct from row(o.id,line_no,requested,source)
       or not exists (select 1 from neo_private.shop_stock_movements
                      where request_key=request_id and actor_id=actor) then
      raise exception 'shop_reconciliation_request_conflict' using errcode='23505';
    end if;
    return jsonb_build_object('ok',true);
  end if;
  if o.status not in ('refunded','charged_back') or o.fulfillment not in ('dispatched','delivered')
     or o.stock_released or requested > (line->>'quantity')::int - (
       select coalesce(sum(r.units),0) from neo_private.shop_physical_returns r
       where r.order_id=o.id and r.line_position=line_no
     ) then
    raise exception 'shop_reconciliation_return_requires_review' using errcode='22023';
  end if;

  target_product:=(line->>'product_id')::uuid;
  select stock into strict stock_before from neo_private.shop_products where id=target_product for update;
  if stock_before::bigint+requested > 1000000 then
    raise exception 'shop_reconciliation_stock_limit' using errcode='22023';
  end if;
  insert into neo_private.shop_physical_returns values(request_id,o.id,line_no,requested,source);
  update neo_private.shop_products set stock=stock_before+requested,updated_at=clock_timestamp() where id=target_product;
  insert into neo_private.shop_stock_movements
    (request_key,product_id,order_id,kind,balance_before,balance_after,reason,actor_id)
    values(request_id,target_product,o.id,'return',stock_before,stock_before+requested,
      'Devolução física confirmada · 010.06',actor);
  insert into neo_private.shop_reconciliation_events(order_id,event_type,state)
    values(o.id,'physical_return',jsonb_build_object('line',line_no,'units',requested,'reference',source,'actor',actor));
  return jsonb_build_object('ok',true);
end
$$;

revoke all on function public.neo_shop_reconciliation_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_reconciliation_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
