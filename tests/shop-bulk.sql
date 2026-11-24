insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active)
select gen_random_uuid(),'Lote '||i,'','Série',1000,3,true from generate_series(1,20) i;
create table shop_bulk_test_batches(label text primary key,id uuid not null);

do $$
declare
 admin constant uuid:='00000000-0000-0000-0000-000000000001';
 product constant uuid:='00000000-0000-0000-0000-000000000011';
 result jsonb;
 single jsonb:=jsonb_build_object('kind','explicit','ids',jsonb_build_array(product));
 selection jsonb:='{"kind":"all","count":20}';
 filters jsonb:='{"category":"Série"}';
 bad_product uuid;
 batch uuid;
 operation text;
 price_only uuid;
 copy_product uuid;
begin
 perform set_config('request.jwt.claim.sub',admin::text,true);
 assert not has_function_privilege('anon','public.neo_shop_bulk_v1(text,jsonb)','EXECUTE');
 assert not has_function_privilege('service_role','public.neo_shop_bulk_v1(text,jsonb)','EXECUTE');
 assert not has_table_privilege('authenticated','neo_private.shop_bulk_batches','SELECT,UPDATE,INSERT');
 assert neo_private.shop_bulk_price(1000,'{"operation":"set","value":1500}')=1500;
 assert neo_private.shop_bulk_price(1000,'{"operation":"add","value":52,"rounding":"ten"}')=1050;
 assert neo_private.shop_bulk_price(1000,'{"operation":"subtract","value":35}')=965;
 assert neo_private.shop_bulk_price(1000,'{"operation":"percent_subtract","value":"19.5"}')=805;
 assert neo_private.shop_bulk_price(1000,'{"operation":"percent_add","value":"5.1","rounding":"whole"}')=1100;

 result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','stock','reason','Estoque insuficiente',
  'selection',single,'stock','{"operation":"subtract","value":10}'::jsonb));
 assert result->>'status'='invalid' and result->'rows'->0->>'error' like 'Estoque insuficiente%';
 select id into bad_product from neo_private.shop_products where name='Lote 20';
 result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','both','reason','Fixture',
  'filters',filters,'selection',selection,'price','{"operation":"percent_add","value":10}'::jsonb,
  'stock','{"operation":"subtract","value":1}'::jsonb,
  'overrides',jsonb_build_object(bad_product::text,jsonb_build_object('stock','-1'))));
 assert result->>'status'='invalid' and jsonb_array_length(result->'rows')=20;
 assert (select count(*) from jsonb_array_elements(result->'rows') l where l->>'error' is not null)=1;
 assert (select count(*) from neo_private.shop_bulk_batches)=0;
 assert (select sum(stock) from neo_private.shop_products where category='Série')=60;

 result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','both','reason','Inventário',
  'reference','Ficha 1','filters',filters,'selection',selection,
  'price','{"operation":"percent_add","value":10}'::jsonb,
  'stock','{"operation":"subtract","value":1}'::jsonb));
 batch:=(result->>'id')::uuid;
 assert result->'rows'->0 @> '{"next_price_cents":1100,"next_stock":2}';
 assert public.neo_shop_bulk_v1('apply',jsonb_build_object('id',batch))->>'status'='applied';
 assert public.neo_shop_bulk_v1('apply',jsonb_build_object('id',batch))->>'status'='applied';
 assert (select count(*) from neo_private.shop_stock_movements where batch_id=batch)=20;
 assert (select sum(stock) from neo_private.shop_products where category='Série')=40;
 assert (select count(*) from neo_private.shop_stock_journal j join neo_private.shop_products p on p.id=j.product_id
   where p.category='Série' and j.balance_before=3 and j.balance_after=2)=20;
 begin
  perform public.neo_shop_bulk_v1('undo',jsonb_build_object('id',batch));
  raise exception 'unsafe inventory undo';
 exception when invalid_parameter_value then null;
 end;
 assert public.neo_shop_bulk_v1('history','{}')->0 @> '{"reason":"Inventário","reference":"Ficha 1","item_count":20}';

 insert into neo_private.shop_product_visibility(product_id,mode) values(product,'allowlist');
 result:=public.neo_shop_bulk_v1('list','{"filters":{"status":"hidden"}}');
 assert result->>'total'='1';
 copy_product:=(public.neo_shop('duplicate_product',jsonb_build_object('id',product,'request_key',gen_random_uuid()))->>'id')::uuid;
 assert public.neo_shop_bulk_v1('list',jsonb_build_object('filters',jsonb_build_object('query',copy_product::text,'status','draft')))->>'total'='1';
 result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','prices','reason','Câmbio',
  'selection',single,'price','{"operation":"fx","previous_fx":"5","next_fx":"6","rounding":"99"}'::jsonb));
 price_only:=(result->>'id')::uuid;
 assert result->'rows'->0->>'next_price_cents'='1199';
 assert public.neo_shop_bulk_v1('apply',jsonb_build_object('id',price_only))->>'status'='applied';
 assert public.neo_shop_bulk_v1('undo',jsonb_build_object('id',price_only))->>'status'='reversed';
 assert public.neo_shop_bulk_v1('undo',jsonb_build_object('id',price_only))->>'status'='reversed';
 assert (select mode from neo_private.shop_product_visibility where product_id=product)='allowlist';

 -- Create immutable previews to submit in independent sessions.
 foreach operation in array array['a','b'] loop
  result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','prices','reason',operation,
   'selection',single,'overrides',jsonb_build_object(product::text,jsonb_build_object('price_cents',
   case operation when 'a' then 1050 else 1150 end))));
  insert into shop_bulk_test_batches values(operation,(result->>'id')::uuid);
 end loop;
 result:=public.neo_shop_bulk_v1('preview',jsonb_build_object('mode','stock','reason','Disputa com venda',
  'selection',jsonb_build_object('kind','explicit','ids',jsonb_build_array('00000000-0000-0000-0000-000000000010')),
  'stock','{"operation":"subtract","value":1}'::jsonb));
 insert into shop_bulk_test_batches values('sale',(result->>'id')::uuid);
 delete from neo_private.admin_members where user_id=admin;
 set local role authenticated;
 foreach operation in array array['list','preview','apply','undo','history'] loop
  begin
   perform public.neo_shop_bulk_v1(operation,jsonb_build_object('id',price_only));
   raise exception 'revoked admin permitted';
  exception when insufficient_privilege then null;
  end;
 end loop;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin
  perform public.neo_shop_bulk_v1('list','{}');
  raise exception 'member permitted';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
 begin
  perform public.neo_shop_bulk_v1('history','{}');
  raise exception 'moderator permitted';
 exception when insufficient_privilege then null;
 end;
 reset role;
 insert into neo_private.admin_members(user_id) values(admin);
end $$;
\echo OK: lote de 20, atomicidade, operação dupla, revisão, idempotência, visibilidade e permissões
