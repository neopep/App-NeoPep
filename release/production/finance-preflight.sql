-- Consulta somente de catálogo. Saída sem pedidos, valores, endereços ou segredos.
begin transaction isolation level repeatable read read only;
set local search_path=pg_catalog;
set local statement_timeout='15s';
set local lock_timeout='3s';

with required(signature) as (values
 ('public.neo_shop(text,jsonb)'),
 ('public.neo_shop_v36(text,jsonb)'),
 ('public.neo_shop_v34(text,jsonb)'),
 ('public.neo_shop_payment_claim_v2(uuid,uuid)'),
 ('public.neo_shop_payment_link(uuid,text,text)'),
 ('public.neo_shop_payment_event_v2(uuid,text,text,bigint,text,text)'),
 ('public.neo_shop_payment_event_v22(uuid,text,text,bigint,text)')
)
select signature,p.oid is not null as present,p.prosecdef as security_definer,
 encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex') as fingerprint,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') as raw_fingerprint,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 case when signature='public.neo_shop_v36(text,jsonb)' then
  case encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
   when '2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9' then 'baseline_git'
   when 'cba1a27d4d54e0cb050877b3434003440a3ba9493cd27dad43b4a4ebd1038521' then 'patched_git'
   else 'divergent_or_missing'
  end
 end as checkout_status
from required left join pg_proc p on p.oid=to_regprocedure(required.signature)
order by signature;

select
 exists(select 1 from pg_constraint where conrelid=to_regclass('neo_private.shop_orders')
  and contype='u' and pg_get_constraintdef(oid)='UNIQUE (user_id, request_key)') as unique_checkout_key,
 exists(select 1 from pg_constraint where conrelid=to_regclass('neo_private.shop_orders')
  and contype='u' and pg_get_constraintdef(oid)='UNIQUE (payment_id)') as unique_order_payment,
 exists(select 1 from pg_constraint where conrelid=to_regclass('neo_private.shop_payments')
  and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (payment_id)') as payment_event_key;
rollback;
