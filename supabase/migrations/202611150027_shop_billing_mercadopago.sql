-- Dados fiscais do pedido e credenciais Mercado Pago protegidas no servidor.
alter table neo_private.shop_orders add column if not exists billing_document_type text check(billing_document_type in ('CPF','CNPJ'));
alter table neo_private.shop_orders add column if not exists billing_document_number text check(billing_document_number ~ '^\d{11}(\d{3})?$');

create table if not exists neo_private.shop_payment_integrations(
 singleton boolean primary key default true check(singleton),
 environment text not null default 'test' check(environment in ('test','production')),
 encrypted_access jsonb,
 encrypted_webhook jsonb,
 collector_id text,
 validated_at timestamptz,
 updated_at timestamptz not null default now()
);
insert into neo_private.shop_payment_integrations(singleton) values(true) on conflict do nothing;
alter table neo_private.shop_payment_integrations enable row level security;
revoke all on neo_private.shop_payment_integrations from public,anon,authenticated;

do $$begin
 if to_regprocedure('public.neo_shop_v27(text,jsonb)') is null then
  alter function public.neo_shop(text,jsonb) rename to neo_shop_v27;
 end if;
end$$;

create or replace function public.neo_valid_br_document(p_type text,p_number text) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare d text:=regexp_replace(coalesce(p_number,''),'\D','','g');s int;c int;i int;w int[];
begin
 if p_type='CPF' then
  if d!~ '^\d{11}$' or d~ '^([0-9])\1{10}$' then return false;end if;
  s:=0;for i in 1..9 loop s:=s+substr(d,i,1)::int*(11-i);end loop;c:=(s*10)%11;if c=10 then c:=0;end if;if c<>substr(d,10,1)::int then return false;end if;
  s:=0;for i in 1..10 loop s:=s+substr(d,i,1)::int*(12-i);end loop;c:=(s*10)%11;if c=10 then c:=0;end if;return c=substr(d,11,1)::int;
 elsif p_type='CNPJ' then
  if d!~ '^\d{14}$' or d~ '^([0-9])\1{13}$' then return false;end if;
  w:=array[5,4,3,2,9,8,7,6,5,4,3,2];s:=0;for i in 1..12 loop s:=s+substr(d,i,1)::int*w[i];end loop;c:=case when s%11<2 then 0 else 11-s%11 end;if c<>substr(d,13,1)::int then return false;end if;
  w:=array[6,5,4,3,2,9,8,7,6,5,4,3,2];s:=0;for i in 1..13 loop s:=s+substr(d,i,1)::int*w[i];end loop;c:=case when s%11<2 then 0 else 11-s%11 end;return c=substr(d,14,1)::int;
 end if;return false;
end$$;

create or replace function public.neo_shop(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;t text:=upper(coalesce(p_payload#>>'{address,document_type}',''));n text:=regexp_replace(coalesce(p_payload#>>'{address,document_number}',''),'\D','','g');oid uuid;
begin
 if p_action='order' then
  if not public.neo_valid_br_document(t,n) then raise exception 'Informe um CPF ou CNPJ válido.';end if;
  result:=public.neo_shop_v27(p_action,jsonb_set(p_payload,'{address}',(p_payload->'address')-'document_type'-'document_number'));
  oid:=(result->>'id')::uuid;
  update neo_private.shop_orders set billing_document_type=t,billing_document_number=n where id=oid and user_id=auth.uid();
  return result||jsonb_build_object('billing_document_type',t);
 end if;
 return public.neo_shop_v27(p_action,p_payload);
end$$;

do $$begin
 if to_regprocedure('public.neo_shop_payment_claim_v27(uuid,uuid)') is null then
  alter function public.neo_shop_payment_claim_v2(uuid,uuid) rename to neo_shop_payment_claim_v27;
 end if;
end$$;
create or replace function public.neo_shop_payment_claim_v2(p_order uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb;o neo_private.shop_orders;begin
 r:=public.neo_shop_payment_claim_v27(p_order,p_user);select * into o from neo_private.shop_orders where id=p_order and user_id=p_user;
 if o.billing_document_number is null then raise exception 'Dados de faturamento ausentes.';end if;
 return r||jsonb_build_object('document_type',o.billing_document_type,'document_number',o.billing_document_number);
end$$;

create or replace function public.neo_shop_payment_integration(p_actor uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare i neo_private.shop_payment_integrations;env text;
begin
 perform public.neo_integration_admin(p_actor);select * into i from neo_private.shop_payment_integrations where singleton;
 if p_action='status' then return jsonb_build_object('configured',i.encrypted_access is not null and i.encrypted_webhook is not null,'environment',i.environment,'collector_id',i.collector_id,'validated_at',i.validated_at,'webhook_url',current_setting('app.settings.supabase_url',true)||'/functions/v1/mercadopago-webhook');end if;
 if p_action='save' then
  env:=p_payload->>'environment';if env not in ('test','production') then raise exception 'Ambiente inválido.';end if;
  update neo_private.shop_payment_integrations set environment=env,encrypted_access=coalesce(p_payload->'encrypted_access',encrypted_access),encrypted_webhook=coalesce(p_payload->'encrypted_webhook',encrypted_webhook),collector_id=null,validated_at=null,updated_at=now() where singleton;
  update neo_private.shop_settings set payment_environment=env,payments_ready=false where singleton;return '{"ok":true}';
 end if;
 if p_action='validated' then
  update neo_private.shop_payment_integrations set collector_id=p_payload->>'collector_id',validated_at=now(),updated_at=now() where singleton;
  update neo_private.shop_settings set payment_environment=i.environment,payments_ready=true where singleton;return '{"ok":true}';
 end if;
 raise exception 'Ação inválida.';
end$$;

create or replace function public.neo_shop_payment_credentials() returns jsonb language sql security definer set search_path=pg_catalog as $$select jsonb_build_object('id','mercadopago','environment',environment,'encrypted_access',encrypted_access,'encrypted_webhook',encrypted_webhook,'collector_id',collector_id,'validated_at',validated_at) from neo_private.shop_payment_integrations where singleton$$;

revoke all on function public.neo_valid_br_document(text,text),public.neo_shop_v27(text,jsonb),public.neo_shop(text,jsonb),public.neo_shop_payment_claim_v27(uuid,uuid),public.neo_shop_payment_claim_v2(uuid,uuid),public.neo_shop_payment_integration(uuid,text,jsonb),public.neo_shop_payment_credentials() from public,anon,authenticated;
grant execute on function public.neo_valid_br_document(text,text),public.neo_shop(text,jsonb) to authenticated;
grant execute on function public.neo_shop_payment_claim_v2(uuid,uuid),public.neo_shop_payment_integration(uuid,text,jsonb),public.neo_shop_payment_credentials() to service_role;
