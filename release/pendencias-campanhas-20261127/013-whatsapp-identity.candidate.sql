-- Apply after the existing Connect WhatsApp group-sync contract.
begin;
alter table neo_private.connect_wa_connections
 add column account_name text check (char_length(account_name) between 1 and 120),
 add column account_number text check (account_number ~ '^[0-9]{6,15}$');

create function public.neo_connect_wa_update_identity(p_device uuid,p_secret text,p_connection uuid,p_name text,p_number text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=neo_private.connect_wa_assert_device(p_device,p_secret);
begin
 if p_number is null or p_number !~ '^[0-9]{6,15}$' or char_length(coalesce(p_name,''))>120
  or coalesce(p_name,'') ~ '[[:cntrl:]]' then
  raise exception 'connect_wa_invalid_identity' using errcode='22023';
 end if;
 update neo_private.connect_wa_connections c
 set account_name=nullif(btrim(p_name),''),account_number=p_number
 where c.id=p_connection and c.owner_id=actor and c.device_id=p_device and c.status<>'revoked'
   and (c.account_number is null or c.account_number=p_number);
 if not found then raise exception 'connect_wa_identity_unavailable' using errcode='42501';end if;
 return true;
end $$;

create function public.neo_campaign_wa_admin_identities()
returns table(id uuid,account_name text,account_number text,state text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false) then
  raise exception 'campaign_wa_admin_required' using errcode='42501';
 end if;
 return query select c.id,c.account_name,c.account_number,
  case when d.state<>'approved' then 'unavailable'
   when c.status='connected' and c.last_seen_at<statement_timestamp()-interval '5 minutes' then 'stale'
   else c.status end
 from neo_private.connect_wa_connections c
 join neo_private.connect_devices d on d.id=c.device_id and d.owner_id=c.owner_id
 where c.owner_id=actor and c.status<>'revoked'
 order by c.last_seen_at desc,c.id limit 100;
end $$;

revoke all on function public.neo_connect_wa_update_identity(uuid,text,uuid,text,text),
 public.neo_campaign_wa_admin_identities() from public,anon,authenticated,service_role;
grant execute on function public.neo_connect_wa_update_identity(uuid,text,uuid,text,text),
 public.neo_campaign_wa_admin_identities() to authenticated;
notify pgrst,'reload schema';
commit;
