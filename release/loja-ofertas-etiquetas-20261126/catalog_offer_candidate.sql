-- Add only read-only offer metadata to existing catalog responses.
-- Checkout, discounts, orders, stock, payments and accounting remain unchanged.
begin;
create or replace function neo_private.shop_catalog_offer_v1(p_actor uuid,p_item jsonb)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog
as $offer$
declare p neo_private.shop_products; r neo_private.shop_promotions;
 items jsonb; rule jsonb; combined jsonb:='[]'; best jsonb:='{"discount_cents":0,"discounts":[]}';
 plan jsonb; mode text; env text; uses bigint; own_uses bigint; cut bigint; ends timestamptz;
begin
 if p_actor is null or p_actor is distinct from auth.uid() or p_item is null or jsonb_typeof(p_item)<>'object' then return p_item; end if;
 select * into p from neo_private.shop_products where id=(p_item->>'id')::uuid and active and deleted_at is null and stock>0;
 if not found or p.price_cents<=1 or neo_private.shop_product_blocked(p_actor,p.id) then return p_item; end if;
 select discount_mode,payment_environment into mode,env from neo_private.shop_settings where singleton;
 items:=jsonb_build_array(jsonb_build_object('product_id',p.id,'quantity',1,'unit_price_cents',p.price_cents));
 for r in select * from neo_private.shop_promotions
  where active and code is null and kind in ('percent','fixed') and payment_method='any'
   and min_quantity<=1 and min_subtotal_cents<=p.price_cents
   and (cardinality(product_ids)=0 or p.id=any(product_ids))
   and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())
   and (not restricted_to_user or restricted_user_id=p_actor)
  order by created_at,id
 loop
  if r.max_uses is not null or r.per_user_limit is not null then
   select count(*),count(*) filter(where user_id=p_actor) into uses,own_uses
   from neo_private.shop_orders o
   where (o.discounts @> jsonb_build_array(jsonb_build_object('id',r.id::text)) or o.coupon_id=r.id)
     and o.environment=env
     and (o.status not in ('expired','rejected','cancelled','awaiting_payment','pending')
          or (o.status in ('awaiting_payment','pending') and o.expires_at>now()));
   if (r.max_uses is not null and uses>=r.max_uses) or (r.per_user_limit is not null and own_uses>=r.per_user_limit) then continue;end if;
  end if;
  rule:=jsonb_build_object('id',r.id,'name',r.name,'code',r.code,'kind',r.kind,'value',r.value,'product_ids',to_jsonb(r.product_ids),'max_discount_cents',r.max_discount_cents);
  plan:=neo_private.shop_discount_plan(items,jsonb_build_array(rule));
  if (plan->>'discount_cents')::bigint>(best->>'discount_cents')::bigint then best:=plan;end if;
  if r.stackable then combined:=combined||jsonb_build_array(rule);end if;
 end loop;
 if mode='combine' then
  plan:=neo_private.shop_discount_plan(items,combined);
  if (plan->>'discount_cents')::bigint>(best->>'discount_cents')::bigint then best:=plan;end if;
 end if;
 cut:=(best->>'discount_cents')::bigint;
 if cut<=0 or cut>=p.price_cents then return p_item; end if;
 select min(pr.ends_at) into ends from neo_private.shop_promotions pr
 where exists(select 1 from jsonb_array_elements(best->'discounts') d where d->>'id'=pr.id::text);
 -- Do not return rule IDs, eligibility internals or other users' data.
 return p_item||jsonb_build_object('offer',jsonb_build_object('original_price_cents',p.price_cents,
  'price_cents',p.price_cents-cut,'valid_until',ends));
end
$offer$;
revoke all on function neo_private.shop_catalog_offer_v1(uuid,jsonb) from public,anon,authenticated;
-- Retain the current production/staging wrapper, membership filtering, and grants.
-- Fail closed if its audited definition changed; never replace an unknown wrapper.
do $patch$
declare definition text; anchor text:=E'\n return result;\nend $function$'; replacement text;
begin
 definition:=pg_get_functiondef('public.neo_shop(text,jsonb)'::regprocedure);
 if position('neo_private.shop_catalog_offer_v1(actor' in definition)>0 then return;end if;
 if md5(definition)<>'8c37ba1b5bded7bebf742d015ab84076' then raise exception 'neo_shop changed: re-audit before applying offer metadata';end if;
 if position(anchor in definition)=0 then raise exception 'neo_shop return anchor missing';end if;
 replacement:=E'\n if p_action in (''catalog'',''featured'') and jsonb_typeof(result->''products'')=''array'' then\n  result:=jsonb_set(result,''{products}'',coalesce((select jsonb_agg(neo_private.shop_catalog_offer_v1(actor,i.item) order by i.pos) from jsonb_array_elements(result->''products'') with ordinality i(item,pos)),''[]''::jsonb));\n elsif p_action=''product_detail'' and jsonb_typeof(result->''product'')=''object'' then\n  result:=jsonb_set(result,''{product}'',neo_private.shop_catalog_offer_v1(actor,result->''product''));\n end if;\n return result;\nend $function$';
 execute replace(definition,anchor,replacement);
end
$patch$;
commit;
