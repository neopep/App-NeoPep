insert into auth.users(id)
select ('00000000-0000-0000-0000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.neo_consents(user_id,purpose,granted)
select id,'terms',true from auth.users;
insert into neo_private.admin_members(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into neo_private.community_moderators(user_id) values ('00000000-0000-0000-0000-000000000004');
update neo_private.shop_settings set seller_name='Teste',seller_document='11144477735',
  business_address='Endereço comercial de teste',support_email='s@example.test',returns_policy='Condições de teste',
  shipping_ready=true,shipping_by_state='{}'::jsonb,shipping_cents=0,payments_ready=true,payment_environment='production';

insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active)
values ('00000000-0000-0000-0000-000000000010','Produto teste','','Teste',1000,0,true),
       ('00000000-0000-0000-0000-000000000011','Produto legado','','Teste',1000,1,true);

create function shop_fixture_buy(customer int, product uuid default '00000000-0000-0000-0000-000000000010')
returns uuid language plpgsql as $$
declare buyer uuid:=('00000000-0000-0000-0000-00000000000'||customer)::uuid;
begin
  perform set_config('request.jwt.claim.sub',buyer::text,true);
  perform public.neo_shop('cart',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1))));
  return (public.neo_shop('order',jsonb_build_object('request_key',gen_random_uuid(),'expected_total_cents',1000,
    'accept_terms',true,'address','{"name":"Pessoa Teste","email":"a@example.test","phone":"11999999999","document_type":"CPF","document_number":"11144477735","postal_code":"01001000","street":"Rua Teste","number":"10","complement":"","district":"Centro","city":"São Paulo","state":"SP"}'::jsonb))->>'id')::uuid;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select neo_shop_costs_v1('register','{"product_id":"00000000-0000-0000-0000-000000000010",
 "request_key":"00000000-0000-0000-0000-000000000031","expected_stock":0,"entry_kind":"acquisition",
 "currency":"BRL","unit_cost":"0","quantity":1,"acquired_on":"2026-01-01"}');
