create or replace function public.neo_connect_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare target uuid; account uuid; group_id_value uuid; task uuid;
begin
 if not neo_private.campaign_admin_allowed() then raise exception 'Administrador obrigatório.' using errcode='42501';end if;
 target:=(p_data->>'id')::uuid;
 if p_action='snapshot' then
  perform neo_private.connect_mark_uncertain();
  return jsonb_build_object('paused',(select paused from neo_private.connect_config),
   'devices',(select coalesce(jsonb_agg(to_jsonb(d)-'secret_hash'),'[]') from (select * from neo_private.connect_devices order by priority desc,last_seen desc nulls last limit 100)d),
   'accounts',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from neo_private.connect_accounts order by identity limit 100)a),
   'sessions',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select * from neo_private.connect_sessions order by last_seen desc limit 100)s),
   'groups',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select * from neo_private.connect_group_accounts order by group_id,priority desc limit 100)g),
   'tasks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from neo_private.connect_tasks order by occurrence desc limit 100)t),
   'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from neo_private.connect_audit order by id desc limit 100)a),
   'releases',(select coalesce(jsonb_agg(to_jsonb(r) order by approved_at desc),'[]') from neo_private.connect_releases r));
 elsif p_action='pause' then
  if (p_data->>'paused')::boolean is null then raise exception 'Estado obrigatório.';end if;
  update neo_private.connect_config set paused = (p_data->>'paused')::boolean where singleton = true;
 elsif p_action in ('approve','revoke','priority') then
  if p_action='approve' then
   update neo_private.connect_devices set state='approved' where id=target and state='pending';
  elsif p_action='revoke' then
   update neo_private.connect_devices set state='revoked' where id=target;
  else
   update neo_private.connect_devices set priority=(p_data->>'priority')::int where id=target;
  end if;
  if not found then raise exception 'Computador indisponível.';end if;
 elsif p_action='create_account' then
  insert into neo_private.connect_accounts(owner_id,identity) values(auth.uid(),p_data->>'identity') returning id into target;
 elsif p_action='disable_account' then
  update neo_private.connect_accounts set enabled=false where id=target and owner_id=auth.uid();
  if not found then raise exception 'Conta indisponível.'; end if;
 elsif p_action='associate' then
  account:=(p_data->>'account')::uuid;group_id_value:=(p_data->>'group')::uuid;
  if not exists(select 1 from neo_private.connect_accounts where id=account and enabled) then raise exception 'Conta indisponível.';end if;
  insert into neo_private.connect_group_accounts(group_id,account_id,verified,may_publish,priority)
   values(group_id_value,account,coalesce((p_data->>'verified')::boolean,false),coalesce((p_data->>'may_publish')::boolean,false),coalesce((p_data->>'priority')::int,0))
   on conflict(group_id,account_id) do update set verified=excluded.verified,may_publish=excluded.may_publish,priority=excluded.priority;
  target:=group_id_value;
 elsif p_action='queue' then
  account:=(p_data->>'account')::uuid;
  insert into neo_private.connect_tasks(publication_id,occurrence,mode,preferred_account)
   select p.id,p.scheduled_at,p_data->>'mode',account
   from neo_private.campaign_wa_publications p join neo_private.campaigns c on c.id=p.campaign_id
   join neo_private.campaign_wa_groups g on g.id=p.group_id and g.active
   join neo_private.connect_group_accounts a on a.group_id=g.id and a.account_id=account and a.verified and a.may_publish
   join neo_private.connect_accounts n on n.id=a.account_id and n.enabled
   where p.id=target and p.status='pending' and p.scheduled_at is not null and c.status='active' and c.whatsapp_enabled
   on conflict(publication_id,occurrence) do nothing returning id into task;
  if task is null then raise exception 'Ocorrência indisponível ou já enfileirada.';end if;
  target:=task;
 else raise exception 'Operação inválida.';
 end if;
 insert into neo_private.connect_audit(actor_id,event,subject) values(auth.uid(),p_action,target);
 return jsonb_build_object('id',target);
end $$;
