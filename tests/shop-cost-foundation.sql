do $$
declare
  admin constant uuid := '00000000-0000-0000-0000-000000000001';
  member constant uuid := '00000000-0000-0000-0000-000000000002';
  product constant uuid := '00000000-0000-0000-0000-000000000010';
  request constant uuid := '00000000-0000-0000-0000-000000000011';
  sale constant uuid := '00000000-0000-0000-0000-000000000020';
  simulation constant uuid := '00000000-0000-0000-0000-000000000030';
  reversal constant uuid := '00000000-0000-0000-0000-000000000013';
  movement uuid;
  reversed uuid;
  rate uuid;
  role_name text;
  relation_name text;
begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach relation_name in array array['shop_fx_rates','shop_acquisitions','shop_stock_movements',
        'shop_sale_cost_snapshots','shop_acquisition_costs'] loop
      assert not has_table_privilege(role_name, 'neo_private.' || relation_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE');
    end loop;
    assert not has_function_privilege(role_name,
      'neo_private.shop_record_stock_adjustment(uuid,uuid,integer,integer,text,uuid,uuid)', 'EXECUTE');
  end loop;

  select id into strict movement from neo_private.shop_stock_movements
    where request_key = request and batch_id = product and balance_before = 3 and delta = -2;
  perform set_config('request.jwt.claim.sub', member::text, true);
  begin
    perform neo_private.shop_record_stock_adjustment(product, request, 3, -2, 'inventário', product);
    raise exception 'member authorized';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  begin
    perform neo_private.shop_record_stock_adjustment(product, request, 3, -2, 'changed', product);
    raise exception 'different payload accepted';
  exception when unique_violation then null;
  end;
  begin
    perform neo_private.shop_record_stock_adjustment(product, reversal, 1, -2147483648, 'invalid');
    raise exception 'negative balance accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform neo_private.shop_record_stock_adjustment(product, reversal, 1, 1, 'invalid', null, movement);
    raise exception 'wrong inverse accepted';
  exception when invalid_parameter_value then null;
  end;
  reversed := neo_private.shop_record_stock_adjustment(product, reversal, 1, 2, 'reversal', null, movement);
  assert reversed = neo_private.shop_record_stock_adjustment(product, reversal, 1, 2, 'reversal', null, movement);
  assert exists (select 1 from neo_private.shop_stock_movements where id = reversed and reverses_id = movement and delta = 2);
  begin
    perform neo_private.shop_record_stock_adjustment(product, request, 3, -2, 'inventário', product);
    assert (select stock from neo_private.shop_products where id = product) = 3;
  end;

  -- A future batch runner can roll back all prior lines on any conflict.
  begin
    perform neo_private.shop_record_stock_adjustment(product, gen_random_uuid(), 3, 1, 'batch line 1', product);
    perform neo_private.shop_record_stock_adjustment(product, gen_random_uuid(), 3, 1, 'batch stale line', product);
    raise exception 'stale batch line accepted';
  exception when serialization_failure then null;
  end;
  assert (select stock from neo_private.shop_products where id = product) = 3;
  assert (select count(*) from neo_private.shop_stock_movements) = 2;

  delete from neo_private.admin_members where user_id = admin;
  begin
    perform neo_private.shop_record_stock_adjustment(product, gen_random_uuid(), 3, 1, 'revoked admin');
    raise exception 'revoked admin authorized';
  exception when insufficient_privilege then null;
  end;
  insert into neo_private.admin_members(user_id) values (admin);

  insert into neo_private.shop_fx_rates(brl_per_usd,quoted_at,source)
    values (5.1234567891,'2026-11-01T12:00Z','Fixture') returning id into rate;
  insert into neo_private.shop_acquisitions(product_id,request_key,quantity,currency,unit_cost_minor,fx_rate_id,acquired_at,actor_id)
    values (product,gen_random_uuid(),5,'USD',100.123456,rate,now(),admin),
           (product,gen_random_uuid(),10,'BRL',0,null,now(),admin);
  assert (select unit_cost_brl_cents from neo_private.shop_acquisition_costs where currency = 'USD')
    = 512.9782003913551296;
  assert (select unit_cost_brl_cents from neo_private.shop_acquisition_costs where currency = 'BRL') = 0;
  begin
    update neo_private.shop_fx_rates set brl_per_usd = 6 where id = rate;
    raise exception 'historical exchange rate overwritten';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    insert into neo_private.shop_acquisitions(product_id,request_key,quantity,currency,unit_cost_minor,acquired_at,actor_id)
      values (product,gen_random_uuid(),1,'USD',10,now(),admin);
    raise exception 'USD without FX accepted';
  exception when check_violation then null;
  end;
  insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version,unit_cost_brl_cents)
    values (sale,1,1,null);
  assert (select unit_cost_brl_cents is null from neo_private.shop_sale_cost_snapshots where order_id = sale);
  begin
    insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version)
      values (simulation,1,1);
    raise exception 'simulation accepted';
  exception when check_violation then null;
  end;
  begin
    insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version)
      values (sale,2,1);
    raise exception 'nonexistent item accepted';
  exception when check_violation then null;
  end;
  begin
    insert into neo_private.shop_sale_cost_snapshots(order_id,line_position,policy_version,unit_cost_brl_cents)
      values (sale,1,1,0);
    raise exception 'duplicate snapshot accepted';
  exception when unique_violation then null;
  end;
  begin
    delete from neo_private.shop_sale_cost_snapshots where order_id = sale;
    raise exception 'snapshot deleted';
  exception when object_not_in_prerequisite_state then null;
  end;
end $$;
\echo OK: ACL, auditoria, replays, reversão, câmbio decimal e snapshots
