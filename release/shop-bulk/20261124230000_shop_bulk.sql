begin;

create table neo_private.shop_bulk_batches (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  reason text not null,
  reference text,
  instructions jsonb not null,
  lines jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  applied_at timestamptz,
  reversed_at timestamptz,
  applied_revisions jsonb
);
create index shop_bulk_batches_applied on neo_private.shop_bulk_batches(applied_at desc,id) where applied_at is not null;
alter table neo_private.shop_bulk_batches enable row level security;
revoke all on neo_private.shop_bulk_batches from public,anon,authenticated,service_role;

-- xmin detects revisions made by all existing writers, including checkout.
create function neo_private.shop_bulk_products(p_filter jsonb)
returns table(id uuid,name text,category text,price_cents integer,stock integer,
 active boolean,visibility text,photo_path text,revision text)
language sql stable set search_path=pg_catalog as $$
  select p.id,p.name,p.category,p.price_cents,p.stock,p.active,coalesce(v.mode,'public'),
    p.photo_path,p.xmin::text
  from neo_private.shop_products p
  left join neo_private.shop_product_visibility v on v.product_id=p.id
  where p.deleted_at is null
    and (nullif(p_filter->>'category','') is null or p.category=p_filter->>'category')
    and (nullif(p_filter->>'status','') is null or case p_filter->>'status'
      when 'draft' then not p.active
      when 'published' then p.active
      when 'hidden' then p.active and v.mode='allowlist'
        and not exists(select 1 from neo_private.shop_product_visibility_members m
          where m.product_id=p.id and m.list='allowlist')
      when 'restricted' then coalesce(v.mode,'public')<>'public'
      else false end)
    and (nullif(btrim(p_filter->>'query'),'') is null
      or strpos(lower(p.name),lower(btrim(p_filter->>'query')))>0
      or strpos(p.id::text,lower(btrim(p_filter->>'query')))>0)
$$;

create function neo_private.shop_bulk_price(p_current integer,p_spec jsonb)
returns numeric language plpgsql immutable set search_path=pg_catalog as $$
declare
 op text:=p_spec->>'operation';
 rounding text:=coalesce(p_spec->>'rounding','cent');
 raw numeric;
 amount numeric;
 previous_fx numeric;
 next_fx numeric;
begin
 if p_spec is null or op is null or op='' then return p_current; end if;
 if op='fx' then
   previous_fx:=(p_spec->>'previous_fx')::numeric;
   next_fx:=(p_spec->>'next_fx')::numeric;
   if previous_fx is null or next_fx is null or previous_fx not between 0.0000000001 and 1000000
     or next_fx not between 0.0000000001 and 1000000 or scale(previous_fx)>10 or scale(next_fx)>10 then
     raise exception 'Informe duas taxas de câmbio positivas e válidas.' using errcode='22023';
   end if;
   raw:=(p_current*next_fx)::numeric(45,24)/previous_fx;
 else
   amount:=(p_spec->>'value')::numeric;
   if amount is null or amount not between 0 and 100000000 or scale(amount)>10
     or (op in ('set','add','subtract') and amount<>trunc(amount)) then
     raise exception 'Informe um valor válido para o preço.' using errcode='22023';
   end if;
   raw:=case op when 'set' then amount when 'add' then p_current+amount
     when 'subtract' then p_current-amount when 'percent_add' then p_current*(1+amount/100)
     when 'percent_subtract' then p_current*(1-amount/100) end;
 end if;
 if raw is null or raw<=0 or rounding not in ('cent','ten','whole','99') then
   raise exception 'Operação ou preço inválido.' using errcode='22023';
 end if;
 return case rounding when 'ten' then round(raw/10)*10
   when 'whole' then round(raw/100)*100
   when '99' then greatest(99,round((raw-99)/100)*100+99)
   else round(raw) end;
end
$$;

create function public.neo_shop_bulk_v1(p_action text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 actor uuid:=auth.uid();
 filters jsonb;
 selection jsonb;
 overrides jsonb;
 page_no int;
 result jsonb;
 rows_out jsonb:='[]';
 selected_ids uuid[];
 excluded uuid[];
 requested_ids uuid[];
 batch_id uuid;
 batch neo_private.shop_bulk_batches;
 row_in jsonb;
 item record;
 product record;
 current_revision text;
 revision_map jsonb:='{}';
 errors jsonb:='[]';
 override_line jsonb;
 price_next numeric;
 stock_next numeric;
 stock_amount numeric;
 stock_op text;
 price_changed boolean;
 stock_changed boolean;
 reason_text text;
 reference_text text;
 row_error text;
 mode_name text;
begin
 if actor is null or not exists(select 1 from neo_private.admin_members where user_id=actor) then
   raise exception 'shop_bulk_admin_required' using errcode='42501';
 end if;
 if jsonb_typeof(p_input) is distinct from 'object' or p_action is null then
   raise exception 'shop_bulk_payload_required' using errcode='22023';
 end if;
 filters:=coalesce(p_input->'filters','{}');
 page_no:=coalesce((p_input->>'page')::int,1);
 if page_no not between 1 and 10000 or jsonb_typeof(filters)<>'object'
      or length(filters->>'query')>120 or length(filters->>'category')>40 then
   raise exception 'shop_bulk_invalid_filters' using errcode='22023';
 end if;

 if p_action='list' then
   with products as materialized (select * from neo_private.shop_bulk_products(filters)),
   page_rows as (select * from products order by name,id limit 20 offset (page_no-1)*20)
   select jsonb_build_object('total',(select count(*) from products),'page',page_no,
     'categories',(select coalesce(jsonb_agg(category order by category),'[]') from
       (select distinct category from neo_private.shop_products where deleted_at is null) categories),
     'rows',(select coalesce(jsonb_agg(to_jsonb(r) order by name,id),'[]') from page_rows r))
   into result;
   return result;
 end if;

 if p_action='history' then
   select coalesce(jsonb_agg(to_jsonb(h) order by applied_at desc,id),'[]') into result from (
     select id,actor_id,reason,reference,created_at,applied_at,reversed_at,jsonb_array_length(lines) as item_count,
       case when reversed_at is null then not exists(select 1 from jsonb_array_elements(lines) l
         where l->>'stock' is distinct from l->>'next_stock') else false end as price_only
     from neo_private.shop_bulk_batches where applied_at is not null
     order by applied_at desc,id limit 20 offset (page_no-1)*20
   ) h;
   return result;
 end if;

 if p_action='preview' then
   selection:=p_input->'selection';
   overrides:=coalesce(p_input->'overrides','{}');
   mode_name:=p_input->>'mode';
   stock_op:=p_input->'stock'->>'operation';
   reason_text:=btrim(coalesce(p_input->>'reason',''));
   reference_text:=nullif(btrim(p_input->>'reference'),'');
   if jsonb_typeof(selection) is distinct from 'object' or jsonb_typeof(overrides)<>'object'
     or mode_name is null or mode_name not in ('prices','stock','both')
     or length(reason_text) not between 1 and 500 or length(reference_text)>160
     or (stock_op is not null and stock_op not in ('set','add','subtract'))
     or (mode_name='stock' and p_input->'price' is not null)
     or (mode_name='prices' and stock_op is not null) then
     raise exception 'shop_bulk_invalid_instructions' using errcode='22023';
   end if;
   if selection->>'kind'='all' then
     excluded:=array(select value::uuid from jsonb_array_elements_text(coalesce(selection->'excluded','[]')));
     selected_ids:=array(select id from neo_private.shop_bulk_products(filters) where not(id=any(excluded)) order by id limit 1001);
     if cardinality(selected_ids)>1000 then
       raise exception 'shop_bulk_selection_limit' using errcode='22023';
     end if;
     if (selection->>'count')::int is distinct from cardinality(selected_ids) then
       raise exception 'shop_bulk_selection_changed' using errcode='40001';
     end if;
   elsif selection->>'kind'='explicit' then
     requested_ids:=array(select value::uuid from jsonb_array_elements_text(selection->'ids'));
     selected_ids:=array(select distinct id from unnest(requested_ids) u(id) order by id);
     if cardinality(selected_ids)<>cardinality(requested_ids) then
       raise exception 'shop_bulk_duplicate_products' using errcode='22023';
     end if;
   else
     raise exception 'shop_bulk_invalid_selection' using errcode='22023';
   end if;
   if cardinality(selected_ids) not between 1 and 1000 then
     raise exception 'shop_bulk_selection_limit' using errcode='22023';
   end if;

   for item in
     select chosen.id as selected_id,p.*
     from unnest(selected_ids) chosen(id)
     left join neo_private.shop_bulk_products('{}') p on p.id=chosen.id
     order by chosen.id
   loop
     price_next:=item.price_cents; stock_next:=item.stock; row_error:=null;
     override_line:=overrides->item.selected_id::text;
     begin
       if item.id is null then raise exception 'Produto indisponível.' using errcode='22023'; end if;
       if mode_name<>'stock' then
         if override_line ? 'price_cents' then
           price_next:=(override_line->>'price_cents')::numeric;
         else price_next:=neo_private.shop_bulk_price(item.price_cents,p_input->'price');
         end if;
       end if;
       if mode_name<>'prices' then
         if override_line ? 'stock' then
           stock_next:=(override_line->>'stock')::numeric;
         elsif stock_op is not null then
           stock_amount:=(p_input->'stock'->>'value')::numeric;
           if stock_amount is null or stock_amount<>trunc(stock_amount) or stock_amount not between 0 and 1000000 then
             raise exception 'Informe uma quantidade inteira válida.' using errcode='22023';
           end if;
           stock_next:=case stock_op when 'set' then stock_amount when 'add' then item.stock+stock_amount
             else item.stock-stock_amount end;
         end if;
       end if;
       if price_next is null or price_next<>trunc(price_next) or price_next not between 1 and 100000000 then
         raise exception 'Preço fora dos limites da Loja.' using errcode='22023';
       end if;
       if stock_next is null or stock_next<>trunc(stock_next) or stock_next not between 0 and 1000000 then
         raise exception 'Estoque insuficiente ou fora dos limites da Loja.' using errcode='22023';
       end if;
     exception when invalid_parameter_value or invalid_text_representation or numeric_value_out_of_range then
       get stacked diagnostics row_error=message_text;
       if sqlstate<>'22023' then row_error:='Valor inválido.'; end if;
       price_next:=null; stock_next:=null;
     end;
     rows_out:=rows_out||jsonb_build_array(jsonb_build_object('id',item.selected_id,'name',item.name,
       'revision',item.revision,'price_cents',item.price_cents,'stock',item.stock,
       'next_price_cents',price_next::int,'next_stock',stock_next::int,'error',row_error,
       'price_percent',case when item.price_cents>0 then round(100*(price_next-item.price_cents)/item.price_cents,2) end));
   end loop;
   if not exists(select 1 from jsonb_array_elements(rows_out) l where l->>'error' is not null
     or l->>'price_cents' is distinct from l->>'next_price_cents' or l->>'stock' is distinct from l->>'next_stock') then
     raise exception 'shop_bulk_no_changes' using errcode='22023';
   end if;
   -- Rejected previews are returned without writing a batch record.
   if exists(select 1 from jsonb_array_elements(rows_out) l where l->>'error' is not null) then
     return jsonb_build_object('status','invalid','rows',rows_out);
   end if;
   insert into neo_private.shop_bulk_batches(actor_id,reason,reference,instructions,lines)
     values(actor,reason_text,reference_text,p_input-'overrides',rows_out) returning id into batch_id;
   return jsonb_build_object('id',batch_id,'status','preview','rows',rows_out);
 end if;

 if p_action not in ('apply','undo','get') then raise exception 'shop_bulk_invalid_action' using errcode='22023'; end if;
 batch_id:=(p_input->>'id')::uuid;
 if p_action='get' then
   select * into strict batch from neo_private.shop_bulk_batches b
     where b.id=batch_id and (b.applied_at is not null or b.actor_id=actor);
   return to_jsonb(batch)-'applied_revisions';
 end if;

 -- Same lock as stock reservations, acquisitions and cancellations.
 perform pg_advisory_xact_lock(642917200);
 perform 1 from neo_private.admin_members a where a.user_id=actor for key share;
 if not found then raise exception 'shop_bulk_admin_required' using errcode='42501'; end if;
 select * into strict batch from neo_private.shop_bulk_batches b where b.id=batch_id for update;
 if batch.actor_id<>actor then raise exception 'shop_bulk_batch_owner_required' using errcode='42501'; end if;
 if p_action='apply' and batch.applied_at is not null then
   return jsonb_build_object('status',case when batch.reversed_at is null then 'applied' else 'reversed' end,'rows',batch.lines,'id',batch.id);
 end if;
 if p_action='undo' and batch.reversed_at is not null then
   return jsonb_build_object('status','reversed','rows',batch.lines,'id',batch.id);
 end if;
 if p_action='apply' and batch.created_at < clock_timestamp()-interval '30 minutes' then
   raise exception 'shop_bulk_preview_expired' using errcode='40001';
 end if;
 if p_action='undo' and (batch.applied_at is null or exists (
   select 1 from jsonb_array_elements(batch.lines) l where l->>'stock' is distinct from l->>'next_stock'
 )) then
   raise exception 'shop_bulk_undo_unavailable' using errcode='22023';
 end if;

 -- Lock and verify every changed row before writing any product.
 for row_in in select value from jsonb_array_elements(batch.lines) order by value->>'id' loop
   select p.price_cents,p.stock,p.xmin::text as revision into product from neo_private.shop_products p
     where p.id=(row_in->>'id')::uuid and p.deleted_at is null for update;
   if not found or product.revision is distinct from (case when p_action='apply' then row_in->>'revision'
     else batch.applied_revisions->>(row_in->>'id') end)
     or product.price_cents is distinct from ((case when p_action='apply' then row_in->>'price_cents' else row_in->>'next_price_cents' end)::numeric)
     or product.stock is distinct from ((case when p_action='apply' then row_in->>'stock' else row_in->>'next_stock' end)::numeric) then
     errors:=errors||jsonb_build_array(jsonb_build_object('id',row_in->'id','name',row_in->'name','error','Produto alterado depois da prévia.'));
   end if;
 end loop;
 if jsonb_array_length(errors)>0 then
   select jsonb_agg(line||jsonb_build_object('error',coalesce(failed->>'error','Não aplicado por conflito em outro produto.'))
     order by line->>'id') into rows_out
     from jsonb_array_elements(batch.lines) line
     left join jsonb_array_elements(errors) failed on failed->>'id'=line->>'id';
   return jsonb_build_object('id',batch.id,'status','conflict','rows',rows_out);
 end if;

 for row_in in select value from jsonb_array_elements(batch.lines) order by value->>'id' loop
   price_changed:=row_in->>'price_cents' is distinct from row_in->>'next_price_cents';
   stock_changed:=row_in->>'stock' is distinct from row_in->>'next_stock';
   if price_changed or stock_changed then
     update neo_private.shop_products set
       price_cents=(case when p_action='apply' then row_in->>'next_price_cents' else row_in->>'price_cents' end)::numeric::int,
       stock=(row_in->>'next_stock')::numeric::int,
       updated_at=clock_timestamp()
     where id=(row_in->>'id')::uuid returning xmin::text into current_revision;
     if stock_changed then
       insert into neo_private.shop_stock_movements(request_key,product_id,batch_id,kind,balance_before,balance_after,reason,actor_id)
       values(md5('shop-bulk:'||batch.id||':'||(row_in->>'id'))::uuid,(row_in->>'id')::uuid,batch.id,
         'adjustment',(row_in->>'stock')::int,(row_in->>'next_stock')::numeric::int,batch.reason,actor);
     end if;
   else current_revision:=row_in->>'revision';
   end if;
   revision_map:=revision_map||jsonb_build_object(row_in->>'id',current_revision);
 end loop;
 if p_action='apply' then
   update neo_private.shop_bulk_batches set applied_at=clock_timestamp(),applied_revisions=revision_map where id=batch.id;
 else
   update neo_private.shop_bulk_batches set reversed_at=clock_timestamp() where id=batch.id;
 end if;
 update public.neo_shop_visibility_events set revision=revision+1 where singleton;
 return jsonb_build_object('id',batch.id,'rows',batch.lines,'status',case when p_action='apply' then 'applied' else 'reversed' end);
end
$$;
revoke all on function neo_private.shop_bulk_products(jsonb),neo_private.shop_bulk_price(integer,jsonb),
 public.neo_shop_bulk_v1(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.neo_shop_bulk_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
