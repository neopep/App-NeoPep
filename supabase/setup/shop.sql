-- NeoPeptídeos: loja e preparação de pagamentos. Não habilita cobranças.
begin;

create table if not exists neo_private.shop_settings(singleton boolean primary key default true check(singleton),seller_name text not null default '',seller_document text not null default '',business_address text not null default '',payment_environment text not null default 'test' check(payment_environment in ('test','production')),support_email text not null default '',shipping_ready boolean not null default false,shipping_cents int not null default 0 check(shipping_cents between 0 and 1000000),delivery_min int not null default 3 check(delivery_min between 1 and 90),delivery_max int not null default 10 check(delivery_max between delivery_min and 120),returns_policy text not null default '',payments_ready boolean not null default false);
insert into neo_private.shop_settings(singleton) values(true) on conflict do nothing;
create table if not exists neo_private.shop_photos(path text primary key,user_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table if not exists neo_private.shop_products(id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 3 and 120),description text not null check(length(description)<=5000),category text not null check(length(btrim(category)) between 1 and 40),price_cents int not null check(price_cents between 1 and 100000000),stock int not null check(stock between 0 and 1000000),active boolean not null default false,photo_path text references neo_private.shop_photos(path),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists neo_private.shop_carts(user_id uuid primary key references auth.users(id) on delete cascade,items jsonb not null default '[]',updated_at timestamptz not null default now());
create table if not exists neo_private.shop_orders(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,request_key uuid not null,items jsonb not null,address jsonb not null,subtotal_cents bigint not null,shipping_cents int not null,total_cents bigint not null check(total_cents between 1 and 100000000),status text not null default 'awaiting_payment' check(status in ('awaiting_payment','pending','paid','paid_review','expired','rejected','cancelled','refunded','charged_back')),stock_released boolean not null default false,environment text not null default 'test' check(environment in ('test','production')),expires_at timestamptz not null default now()+interval '30 minutes',preference_id text,init_point text,payment_id text unique,payment_lease timestamptz,fulfillment text not null default 'processing' check(fulfillment in ('processing','dispatched','delivered')),tracking text not null default '',created_at timestamptz not null default now(),unique(user_id,request_key));
alter table neo_private.shop_settings enable row level security;
alter table neo_private.shop_photos enable row level security;
alter table neo_private.shop_products enable row level security;
alter table neo_private.shop_carts enable row level security;
alter table neo_private.shop_orders enable row level security;
revoke all on neo_private.shop_settings,neo_private.shop_photos,neo_private.shop_products,neo_private.shop_carts,neo_private.shop_orders from public,anon,authenticated;
create index if not exists neo_shop_orders_owner on neo_private.shop_orders(user_id,created_at desc);
create or replace function neo_private.shop_expire() returns void language plpgsql set search_path=pg_catalog as $$
declare o record;i jsonb;
begin
 perform pg_advisory_xact_lock(642917200);
 for o in select * from neo_private.shop_orders where status in ('awaiting_payment','pending') and expires_at<now() and not stock_released for update loop
  for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;
  update neo_private.shop_orders set status='expired',stock_released=true where id=o.id;
 end loop;
end $$;
create or replace function neo_private.shop_quote(u uuid) returns jsonb language plpgsql stable set search_path=pg_catalog as $$
declare cart jsonb;items jsonb:='[]';i jsonb;p neo_private.shop_products;cfg neo_private.shop_settings;subtotal bigint:=0;qty int;
begin
 select * into cfg from neo_private.shop_settings where singleton;
 select c.items into cart from neo_private.shop_carts c where user_id=u;
 for i in select value from jsonb_array_elements(coalesce(cart,'[]')) loop
  qty:=(i->>'quantity')::int;select * into p from neo_private.shop_products where id=(i->>'product_id')::uuid and active;
  if not found then raise exception 'Um produto não está mais disponível. Atualize o carrinho.';end if;
  if qty>p.stock then raise exception 'Estoque insuficiente para %.',p.name;end if;
  subtotal:=subtotal+p.price_cents::bigint*qty;
  items:=items||jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',qty,'unit_price_cents',p.price_cents));
 end loop;
 if subtotal+cfg.shipping_cents>100000000 then raise exception 'Valor máximo do pedido excedido.';end if;
 return jsonb_build_object('items',items,'subtotal_cents',subtotal,'shipping_cents',case when cfg.shipping_ready then cfg.shipping_cents else null end,'total_cents',case when cfg.shipping_ready then subtotal+cfg.shipping_cents else null end,'shipping_ready',cfg.shipping_ready,'payments_ready',cfg.payments_ready,'seller_name',cfg.seller_name,'support_email',cfg.support_email,'seller_document',cfg.seller_document,'business_address',cfg.business_address,'payment_environment',cfg.payment_environment,'returns_policy',cfg.returns_policy,'delivery_min',cfg.delivery_min,'delivery_max',cfg.delivery_max);
end $$;
create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();a boolean;items jsonb;i jsonb;ids uuid[]:='{}';pid uuid;qty int;result jsonb;cfg neo_private.shop_settings;q jsonb;o neo_private.shop_orders;address jsonb;key uuid;v_path text;
begin
 if u is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;
 a:=public.neo_admin_access();
 if p_action='catalog' then
  select * into cfg from neo_private.shop_settings where singleton;
  return jsonb_build_object('can_manage',a,'settings',to_jsonb(cfg)-'singleton','products',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from(select pr.* from neo_private.shop_products pr where pr.active or a or exists(select 1 from neo_private.shop_carts c cross join lateral jsonb_array_elements(c.items) ci where c.user_id=u and ci->>'product_id'=pr.id::text) order by exists(select 1 from neo_private.shop_carts c cross join lateral jsonb_array_elements(c.items) ci where c.user_id=u and ci->>'product_id'=pr.id::text) desc,pr.created_at desc limit 230)p),'[]'::jsonb),'cart',coalesce((select c.items from neo_private.shop_carts c where user_id=u),'[]'::jsonb));
 elsif p_action='cart' then
  items:=p_payload->'items';if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)>30 then raise exception 'Carrinho inválido.';end if;
  result:='[]';
  for i in select value from jsonb_array_elements(items) loop
   pid:=(i->>'product_id')::uuid;qty:=(i->>'quantity')::int;
   if pid is null or qty is null or qty not between 1 and 20 or pid=any(ids) or not exists(select 1 from neo_private.shop_products where id=pid) then raise exception 'Item do carrinho inválido.';end if;
   ids:=array_append(ids,pid);result:=result||jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',qty));
  end loop;
  perform neo_private.take_limit('shop_cart',120,60);
  insert into neo_private.shop_carts(user_id,items) values(u,result) on conflict(user_id) do update set items=excluded.items,updated_at=now();return result;
 elsif p_action='quote' then return neo_private.shop_quote(u);
 elsif p_action='order' then
  perform pg_advisory_xact_lock(642917200);
  key:=(p_payload->>'request_key')::uuid;address:=p_payload->'address';
  select * into o from neo_private.shop_orders where user_id=u and request_key=key;
  if found then if o.address<>address then raise exception 'O pedido já foi criado com outro endereço.';end if;return jsonb_build_object('id',o.id,'status',o.status);end if;
  if not public.neo_has_consent('terms') or p_payload->'accept_terms' is distinct from 'true'::jsonb then raise exception 'Confirme as condições da compra.';end if;
  perform neo_private.shop_expire();select * into cfg from neo_private.shop_settings where singleton;
  if not cfg.shipping_ready or not cfg.payments_ready or cfg.seller_name='' or cfg.support_email='' or cfg.returns_policy='' or cfg.seller_document='' or cfg.business_address='' then raise exception 'O checkout ainda está em configuração pela loja.';end if;
  q:=neo_private.shop_quote(u);
  if key is null or jsonb_array_length(q->'items')=0 then raise exception 'Adicione produtos ao carrinho.';end if;
  if (p_payload->>'expected_total_cents')::bigint is distinct from (q->>'total_cents')::bigint then raise exception 'Os valores mudaram. Confira o total novamente.';end if;
  if jsonb_typeof(address) is distinct from 'object' or octet_length(address::text)>4000 or length(btrim(coalesce(address->>'name',''))) not between 2 and 100 or coalesce(address->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or coalesce(address->>'phone','') !~ '^[0-9]{10,11}$' or coalesce(address->>'postal_code','') !~ '^[0-9]{8}$' or length(btrim(coalesce(address->>'street',''))) not between 2 and 150 or length(btrim(coalesce(address->>'number',''))) not between 1 and 20 or length(coalesce(address->>'complement',''))>100 or length(btrim(coalesce(address->>'district',''))) not between 2 and 100 or length(btrim(coalesce(address->>'city',''))) not between 2 and 100 or coalesce(address->>'state','') !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' then raise exception 'Confira os dados de contato e o endereço de entrega.';end if;
  address:=jsonb_build_object('name',address->>'name','email',address->>'email','phone',address->>'phone','postal_code',address->>'postal_code','street',address->>'street','number',address->>'number','complement',coalesce(address->>'complement',''),'district',address->>'district','city',address->>'city','state',address->>'state');
  perform neo_private.take_limit('shop_order',10,3600);
  for i in select value from jsonb_array_elements(q->'items') loop update neo_private.shop_products set stock=stock-(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;
  insert into neo_private.shop_orders(user_id,request_key,items,address,subtotal_cents,shipping_cents,total_cents) values(u,key,q->'items',address,(q->>'subtotal_cents')::bigint,(q->>'shipping_cents')::int,(q->>'total_cents')::bigint) returning * into o;
  delete from neo_private.shop_carts where user_id=u;
  return jsonb_build_object('id',o.id,'status',o.status);
 elsif p_action in ('orders','manage_orders') then
  if p_action='manage_orders' and not a then raise exception 'Autorização da loja obrigatória.' using errcode='42501';end if;
  perform neo_private.shop_expire();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from(select s.id,s.items,s.address,s.subtotal_cents,s.shipping_cents,s.total_cents,s.status,s.environment,s.fulfillment,s.tracking,s.created_at,s.expires_at from neo_private.shop_orders s where s.user_id=u or (a and p_action='manage_orders') order by s.created_at desc limit 100)x),'[]'::jsonb);
 elsif p_action in ('product','settings','reserve_photo','fulfill') then
  if not a then raise exception 'Autorização da loja obrigatória.' using errcode='42501';end if;
  perform neo_private.take_limit('shop_manage',120,3600);
  if p_action='reserve_photo' then
   v_path:=u::text||'/'||gen_random_uuid()::text||'.jpg';insert into neo_private.shop_photos(path,user_id) values(v_path,u);return jsonb_build_object('path',v_path);
  elsif p_action='product' then
   perform pg_advisory_xact_lock(642917200);
   pid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());v_path:=nullif(p_payload->>'photo_path','');
   if v_path is not null and not exists(select 1 from neo_private.shop_photos f join storage.objects s on s.name=f.path and s.bucket_id='neo-shop-products' where f.path=v_path) then raise exception 'Envie uma foto válida do produto.';end if;
   if p_payload->'active'='true'::jsonb and v_path is null then raise exception 'Adicione a foto antes de publicar o produto.';end if;
   insert into neo_private.shop_products(id,name,description,category,price_cents,stock,active,photo_path) values(pid,btrim(p_payload->>'name'),coalesce(p_payload->>'description',''),btrim(p_payload->>'category'),(p_payload->>'price_cents')::int,(p_payload->>'stock')::int,coalesce((p_payload->>'active')::boolean,false),v_path) on conflict(id) do update set name=excluded.name,description=excluded.description,category=excluded.category,price_cents=excluded.price_cents,stock=excluded.stock,active=excluded.active,photo_path=excluded.photo_path,updated_at=now();return jsonb_build_object('id',pid);
  elsif p_action='settings' then
   if coalesce(p_payload->>'seller_document','') !~ '^([0-9]{11}|[0-9]{14})$' or length(btrim(coalesce(p_payload->>'business_address',''))) not between 10 and 250 or length(btrim(coalesce(p_payload->>'seller_name',''))) not between 2 and 120 or coalesce(p_payload->>'support_email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(btrim(coalesce(p_payload->>'returns_policy',''))) not between 10 and 4000 then raise exception 'Informe a identificação da loja, contato e condições de troca.';end if;
   update neo_private.shop_settings set seller_name=btrim(p_payload->>'seller_name'),seller_document=p_payload->>'seller_document',business_address=btrim(p_payload->>'business_address'),support_email=btrim(p_payload->>'support_email'),returns_policy=p_payload->>'returns_policy',shipping_ready=(p_payload->>'shipping_ready')::boolean,shipping_cents=(p_payload->>'shipping_cents')::int,delivery_min=(p_payload->>'delivery_min')::int,delivery_max=(p_payload->>'delivery_max')::int where singleton;return '{"ok":true}';
  else
   if coalesce(p_payload->>'fulfillment','') not in ('processing','dispatched','delivered') or length(coalesce(p_payload->>'tracking',''))>150 then raise exception 'Dados de envio inválidos.';end if;
   update neo_private.shop_orders set fulfillment=p_payload->>'fulfillment',tracking=coalesce(p_payload->>'tracking','') where id=(p_payload->>'id')::uuid and status='paid';if not found then raise exception 'O pagamento deve estar aprovado antes do envio.';end if;return '{"ok":true}';
  end if;
 else raise exception 'Operação da loja inválida.';end if;
end $$;
-- Photo storage contains only catalogue images, never health photographs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neo-shop-products','neo-shop-products',false,5242880,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.neo_shop_photo(p_path text,p_upload boolean default false) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid() is not null and (case when p_upload then public.neo_admin_access() and exists(select 1 from neo_private.shop_photos where path=p_path and user_id=auth.uid() and created_at>now()-interval '1 hour') else public.neo_admin_access() or exists(select 1 from neo_private.shop_products where active and photo_path=p_path) end)
$$;
drop policy if exists neo_shop_photo_read on storage.objects;
create policy neo_shop_photo_read on storage.objects for select to authenticated using(bucket_id='neo-shop-products' and public.neo_shop_photo(name,false));
drop policy if exists neo_shop_photo_insert on storage.objects;
create policy neo_shop_photo_insert on storage.objects for insert to authenticated with check(bucket_id='neo-shop-products' and public.neo_shop_photo(name,true));
revoke all on function neo_private.shop_quote(uuid),neo_private.shop_expire() from public,anon,authenticated;
revoke all on function public.neo_shop(text,jsonb),public.neo_shop_photo(text,boolean) from public,anon;
grant execute on function public.neo_shop(text,jsonb),public.neo_shop_photo(text,boolean) to authenticated;


alter table neo_private.shop_settings add column if not exists payment_environment text not null default 'test' check(payment_environment in ('test','production'));
alter table neo_private.shop_orders add column if not exists environment text not null default 'test' check(environment in ('test','production'));
alter table neo_private.shop_orders drop constraint if exists shop_orders_status_check;
alter table neo_private.shop_orders add constraint shop_orders_status_check check(status in ('awaiting_payment','pending','paid','test_paid','paid_review','expired','rejected','cancelled','refunded','charged_back'));
create table if not exists neo_private.shop_payments(payment_id text primary key,order_id uuid not null references neo_private.shop_orders(id),status text not null,amount_cents bigint not null,updated_at timestamptz not null default now());
alter table neo_private.shop_payments enable row level security;
revoke all on neo_private.shop_payments from public,anon,authenticated;
create or replace function neo_private.shop_order_environment() returns trigger language plpgsql set search_path=pg_catalog as $$
begin select payment_environment into new.environment from neo_private.shop_settings where singleton;return new;end $$;
drop trigger if exists neo_shop_environment on neo_private.shop_orders;
create trigger neo_shop_environment before insert on neo_private.shop_orders for each row execute function neo_private.shop_order_environment();
create or replace function public.neo_shop_payment_claim(p_order uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;
begin
 select * into o from neo_private.shop_orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'Pedido não encontrado.';end if;
 if not exists(select 1 from neo_private.shop_settings where singleton and payments_ready) then raise exception 'Pagamento ainda não ativado.';end if;
 if o.status not in ('awaiting_payment','pending') or o.expires_at<now() then raise exception 'Pedido encerrado ou expirado.';end if;
 if o.init_point is not null then return jsonb_build_object('id',o.id,'payment_url',o.init_point,'environment',o.environment);end if;
 if o.payment_lease>now() then raise exception 'Pagamento sendo preparado. Aguarde e tente novamente.';end if;
 update neo_private.shop_orders set payment_lease=now()+interval '2 minutes' where id=o.id;
 return jsonb_build_object('id',o.id,'items',o.items,'total_cents',o.total_cents,'shipping_cents',o.shipping_cents,'email',o.address->>'email','expires_at',o.expires_at,'environment',o.environment);
end $$;
create or replace function public.neo_shop_payment_link(p_order uuid,p_preference text,p_url text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_url !~ '^https://(www\.|sandbox\.)?mercadopago\.com(\.br)?/' or length(p_url)>4000 or length(p_preference) not between 1 and 200 then raise exception 'Link de pagamento inválido.';end if;
 update neo_private.shop_orders set preference_id=p_preference,init_point=p_url,payment_lease=null where id=p_order and init_point is null and status in ('awaiting_payment','pending');
end $$;
create or replace function public.neo_shop_payment_event(p_order uuid,p_payment text,p_status text,p_amount bigint,p_environment text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare o neo_private.shop_orders;i jsonb;available boolean:=true;new_status text;
begin
 perform pg_advisory_xact_lock(642917200);
 select * into o from neo_private.shop_orders where id=p_order for update;
 if not found or o.total_cents<>p_amount or o.environment<>p_environment or p_payment !~ '^[0-9]{1,30}$' then raise exception 'Confirmação de pagamento incompatível com o pedido.';end if;
 if o.status='paid_review' and p_status='approved' then return '{"review":true}';end if;
 if o.status in ('refunded','charged_back') and p_status not in ('refunded','charged_back') then return '{"ignored":true}';end if;
 if p_status not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back','in_mediation','partially_refunded') then raise exception 'Estado de pagamento desconhecido.';end if;
 if exists(select 1 from neo_private.shop_payments where payment_id=p_payment and order_id<>p_order) then raise exception 'Pagamento já associado a outro pedido.';end if;
 insert into neo_private.shop_payments(payment_id,order_id,status,amount_cents) values(p_payment,p_order,p_status,p_amount) on conflict(payment_id) do update set status=excluded.status,updated_at=now();
 if o.status in ('paid','test_paid','paid_review') and o.payment_id is not null and o.payment_id<>p_payment and p_status='approved' then update neo_private.shop_orders set status='paid_review' where id=o.id;return '{"review":true,"reason":"multiple_payments"}';end if;
 if o.payment_id is not null and o.payment_id<>p_payment and p_status<>'approved' then return '{"ignored":true}';end if;
 if o.status in ('paid','test_paid','paid_review','refunded','charged_back') and p_status not in ('approved','refunded','charged_back','in_mediation','partially_refunded') then return '{"ignored":true}';end if;
 if p_status='approved' then
  new_status:=case when p_environment='test' then 'test_paid' else 'paid' end;
  if o.stock_released and p_environment='production' then
   for i in select value from jsonb_array_elements(o.items) loop if not exists(select 1 from neo_private.shop_products where id=(i->>'product_id')::uuid and stock>=(i->>'quantity')::int) then available:=false;end if;end loop;
   if available then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock-(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;else new_status:='paid_review';end if;
  end if;
  if p_environment='test' and not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;end if;
  update neo_private.shop_orders set status=new_status,payment_id=p_payment,stock_released=case when p_environment='test' then true when available then false else true end where id=o.id;
 elsif p_status in ('rejected','cancelled') then
  if not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;end if;
  update neo_private.shop_orders set status=p_status,payment_id=p_payment,stock_released=true where id=o.id;
 elsif p_status in ('refunded','charged_back','in_mediation','partially_refunded') then
  if p_status='refunded' and o.fulfillment='processing' and not o.stock_released then for i in select value from jsonb_array_elements(o.items) loop update neo_private.shop_products set stock=stock+(i->>'quantity')::int where id=(i->>'product_id')::uuid;end loop;update neo_private.shop_orders set stock_released=true where id=o.id;end if;
  update neo_private.shop_orders set status=case when p_status in ('in_mediation','partially_refunded') then 'paid_review' else p_status end,payment_id=p_payment where id=o.id;
 else update neo_private.shop_orders set status='pending',payment_id=p_payment where id=o.id and status not in ('expired','cancelled');end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.neo_shop_export() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'items',items,'address',address,'status',status,'total_cents',total_cents,'fulfillment',fulfillment,'tracking',tracking,'created_at',created_at) order by created_at) from neo_private.shop_orders where user_id=auth.uid()),'[]'::jsonb);
end $$;
create or replace function public.neo_shop_deletion_check(p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform neo_private.shop_expire();
 return jsonb_build_object('allowed',not exists(select 1 from neo_private.shop_orders where user_id=p_user and (status in ('awaiting_payment','pending','paid_review') or (status='paid' and fulfillment<>'delivered'))));
end $$;
create or replace function neo_private.shop_account_delete() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from neo_private.shop_orders where user_id=old.id and (status in ('awaiting_payment','pending','paid_review') or (status='paid' and fulfillment<>'delivered'))) then raise exception 'Conclua o atendimento dos pedidos em aberto antes de excluir a conta.';end if;
 update neo_private.shop_orders set user_id=null,address='{}'::jsonb where user_id=old.id;return old;
end $$;
drop trigger if exists neo_shop_account_delete on auth.users;
create trigger neo_shop_account_delete before delete on auth.users for each row execute function neo_private.shop_account_delete();
revoke all on function neo_private.shop_order_environment(),neo_private.shop_account_delete() from public,anon,authenticated;
revoke all on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_link(uuid,text,text),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_deletion_check(uuid) from public,anon,authenticated;
revoke all on function public.neo_shop_export() from public,anon;
grant execute on function public.neo_shop_export() to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.neo_shop_payment_claim(uuid,uuid),public.neo_shop_payment_link(uuid,text,text),public.neo_shop_payment_event(uuid,text,text,bigint,text),public.neo_shop_deletion_check(uuid) to service_role';end if;end $$;

commit;
