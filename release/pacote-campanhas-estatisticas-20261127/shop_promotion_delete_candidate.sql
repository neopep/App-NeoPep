-- Candidata, NÃO aplicar antes da publicação consolidada.
begin;
set local lock_timeout='5s';
alter table neo_private.shop_promotions add column deleted_at timestamptz;
alter table neo_private.shop_promotions add constraint shop_promotions_deleted_inactive check(deleted_at is null or not active);
do $patch$
declare f regprocedure:='public.neo_shop_v27(text,jsonb)'::regprocedure; d text; a text; b text;
begin
 d:=pg_get_functiondef(f);
 if md5(d) not in ('656849b36a4243954f4e5a2cec08c980','b40c6dd55a45ceadd5b50232bd1ee290') then raise exception 'promotion_contract_changed';end if;
 a:=$a$('promotions','promotion_save','promotion_toggle','discount_settings')$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'promotion_actions_changed';end if;
 d:=replace(d,a,$b$('promotions','promotion_save','promotion_toggle','promotion_delete','discount_settings')$b$);
 a:=$a$from neo_private.shop_promotions p),'[]'))$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'promotion_list_changed';end if;
 d:=replace(d,a,$b$from neo_private.shop_promotions p where p.deleted_at is null),'[]'))$b$);
 a:=$a$elsif p_action='promotion_toggle' then$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'promotion_toggle_changed';end if;
 b:=$b$elsif p_action='promotion_delete' then
   if p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirme a exclusão da regra.' using errcode='22023';end if;
   update neo_private.shop_promotions set active=false,deleted_at=coalesce(deleted_at,now()),updated_at=now() where id=(p_payload->>'id')::uuid;
   if not found then raise exception 'Regra não encontrada.';end if;
   return '{"ok":true}';
  $b$;
 d:=replace(d,a,b||a);
 a:=$a$where id=(p_payload->>'id')::uuid;if not found then raise exception 'Regra não encontrada.'$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'promotion_update_changed';end if;
 d:=replace(d,a,$b$where id=(p_payload->>'id')::uuid and deleted_at is null;if not found then raise exception 'Regra não encontrada.'$b$);
 a:=$a$pid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());v_code:=$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'promotion_save_changed';end if;
 d:=replace(d,a,$b$pid:=coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid());
  if exists(select 1 from neo_private.shop_promotions where id=pid and deleted_at is not null) then raise exception 'Regra excluída.';end if;
  v_code:=$b$);
 execute d;
end;$patch$;
commit;
-- No physical delete, no change to orders, quotes, payments, stock, permissions or coupon uniqueness.
