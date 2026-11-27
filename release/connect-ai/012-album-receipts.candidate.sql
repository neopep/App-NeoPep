-- Candidate, after 011. Keep the batch dispatch block in place.
-- Receipt data stays on the native attempt and shares its owner, fence and lifecycle.
begin;
alter table neo_private.campaign_wa_rich_messages
 add column album_items jsonb,
 add column album_receipt jsonb;

create function neo_private.campaign_validate_album_receipt()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare children jsonb; expected integer; parent_id text;
begin
 if tg_op='UPDATE' and old.album_receipt is not null and new.album_receipt is distinct from old.album_receipt then
  raise exception 'rich_album_receipt_immutable' using errcode='22023';
 end if;
 if new.album_receipt is null then
  if new.album_items is not null and new.state='accepted' then
   raise exception 'rich_album_receipt_required' using errcode='22023';
  end if;
  return new;
 end if;
 if new.album_items is null or jsonb_typeof(new.album_items)<>'array'
  or jsonb_typeof(new.album_receipt)<>'object'
  or new.album_receipt - array['message_id','media'] <> '{}'::jsonb
  or new.state not in ('accepted','uncertain') then
  raise exception 'rich_album_receipt_invalid' using errcode='22023';
 end if;
 if tg_op='UPDATE' and new.album_receipt is not distinct from old.album_receipt and new.state=old.state then return new;end if;
 if tg_op<>'UPDATE' then raise exception 'rich_album_receipt_invalid' using errcode='22023';end if;
 if old.state<>'started' or old.album_receipt is not null or new.fence is distinct from old.fence then
  raise exception 'rich_album_receipt_invalid' using errcode='22023';
 end if;
 expected:=jsonb_array_length(new.album_items);
 children:=coalesce(new.album_receipt->'media','[]'::jsonb);
 parent_id:=new.album_receipt->>'message_id';
 if expected not between 2 and 4 or jsonb_typeof(children)<>'array'
  or coalesce(length(parent_id),0)>160
  or (new.album_receipt->'message_id' is not null and jsonb_typeof(new.album_receipt->'message_id') not in ('string','null')) then
  raise exception 'rich_album_receipt_invalid' using errcode='22023';
 end if;
 if jsonb_array_length(children)>expected
  or (jsonb_array_length(children)>0 and coalesce(length(parent_id),0)=0)
  or (new.state='accepted' and (jsonb_array_length(children)<>expected
     or coalesce(length(parent_id),0)=0 or parent_id is distinct from new.receipt_id))
  or exists(select 1 from jsonb_array_elements(children) with ordinality as x(item,n)
   where jsonb_typeof(item)<>'object' or item-array['index','messageId']<>'{}'::jsonb
    or item->'index' is distinct from to_jsonb(n-1)
    or jsonb_typeof(item->'messageId') is distinct from 'string'
    or length(item->>'messageId') not between 1 and 160
    or item->>'messageId'=parent_id)
  or (select count(distinct item->>'messageId') from jsonb_array_elements(children) as x(item))<>jsonb_array_length(children)
 then raise exception 'rich_album_receipt_invalid' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function neo_private.campaign_validate_album_receipt() from public,anon,authenticated,service_role;
create trigger campaign_validate_album_receipt before insert or update of state,album_receipt
 on neo_private.campaign_wa_rich_messages for each row execute function neo_private.campaign_validate_album_receipt();

-- Attach receipt preservation to the existing authenticated, fenced finish operation.
do $patch$
declare definition text; marker constant text:=$token$sent_at=now(),lease_until=null where id=m.id;$token$;
begin
 definition:=pg_get_functiondef('public.neo_campaign_rich_device_v1(text,uuid,text,jsonb)'::regprocedure);
 if length(definition)-length(replace(definition,marker,''))<>length(marker) then
  raise exception 'rich_album_finish_contract_mismatch';
 end if;
 execute replace(definition,marker,$token$album_receipt=case when m.album_items is not null and jsonb_typeof(p_data->'album_receipt')='object'
    then jsonb_build_object('message_id',p_data->'album_receipt'->'message_id',
      'media',coalesce(p_data->'album_receipt'->'media','[]'::jsonb)) end,
   sent_at=now(),lease_until=null where id=m.id;$token$);
end $patch$;
commit;
