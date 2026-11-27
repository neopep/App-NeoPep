-- Hotfix applied to Production then Teste on 2026-11-27.
-- Avoid PL/pgSQL record m shadowing the UPDATE target alias.
begin;
set local lock_timeout='5s';
do $patch$
declare def text; before_block text; after_block text; first_pos int; next_pos int;
begin
 def:=pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure);
 first_pos:=strpos(def,$a$ if p_action='delivery_receipt' then$a$);
 next_pos:=strpos(def,$a$ if p_action='claim' then$a$);
 if first_pos=0 or next_pos<=first_pos then raise exception 'receipt_branch_missing';end if;
 before_block:=substr(def,first_pos,next_pos-first_pos);
 if strpos(before_block,'update neo_private.campaign_wa_rich_messages m set')=0 or strpos(before_block,'where m.owner_id=actor')=0 then raise exception 'receipt_alias_contract_changed';end if;
 after_block:=replace(replace(before_block,'update neo_private.campaign_wa_rich_messages m set','update neo_private.campaign_wa_rich_messages as receipt_row set'),'m.','receipt_row.');
 execute overlay(def placing after_block from first_pos for next_pos-first_pos);
end;$patch$;
commit;
