-- Staging only: push wake functions are inert and push triggers are disabled.
-- Push imediato para novos materiais e atualizacoes do pedido do cliente.
begin;

create table if not exists neo_private.event_push_jobs(
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references neo_private.push_devices(id) on delete cascade,
 event_key text not null,
 kind text not null check(kind in ('library','shop')),
 title text not null check(length(title) between 1 and 100),
 body text not null check(length(body) between 1 and 180),
 sent boolean not null default false,
 attempts int not null default 0,
 lease_until timestamptz,
 created_at timestamptz not null default now(),
 unique(device_id,event_key)
);
alter table neo_private.event_push_jobs enable row level security;
revoke all on neo_private.event_push_jobs from public,anon,authenticated;

create or replace function neo_private.push_dispatch_wake() returns void language plpgsql security definer set search_path=pg_catalog,extensions as $$
begin
 return;
end $$;
revoke all on function neo_private.push_dispatch_wake() from public,anon,authenticated;

create or replace function neo_private.library_push_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 insert into neo_private.event_push_jobs(device_id,event_key,kind,title,body)
 select d.id,'library:'||new.id,'library','Novo material na Biblioteca',left(new.title,180)
 from neo_private.push_devices d join neo_private.community_members m on m.user_id=d.user_id
 where d.created_at<=new.created_at on conflict do nothing;
 perform neo_private.push_dispatch_wake();return new;
end $$;
revoke all on function neo_private.library_push_event() from public,anon,authenticated;
drop trigger if exists neo_library_push_event on neo_private.community_materials;
create trigger neo_library_push_event after insert on neo_private.community_materials for each row execute function neo_private.library_push_event();
alter table neo_private.community_materials disable trigger neo_library_push_event;

create or replace function neo_private.shop_push_event() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare event_key text;event_title text;event_body text;short_id text:=upper(left(replace(new.id::text,'-',''),8));
begin
 if new.user_id is null then return new;end if;
 if new.fulfillment is distinct from old.fulfillment then
  event_key:='shop:'||new.id||':fulfillment:'||new.fulfillment;
  if new.fulfillment='dispatched' then event_title:='Seu pedido foi enviado';event_body:='Pedido '||short_id||case when new.tracking<>'' then ' · confira o rastreamento no aplicativo.' else ' · acompanhe os detalhes no aplicativo.' end;
  elsif new.fulfillment='delivered' then event_title:='Pedido entregue';event_body:='O pedido '||short_id||' foi marcado como entregue.';
  else event_title:='Pedido em preparação';event_body:='Estamos preparando o pedido '||short_id||'.';end if;
 elsif new.status is distinct from old.status then
  event_key:='shop:'||new.id||':status:'||new.status;
  if new.status in ('paid','test_paid') then event_title:='Pagamento confirmado';event_body:='O pagamento do pedido '||short_id||' foi confirmado.';
  elsif new.status='paid_review' then event_title:='Pedido em análise';event_body:='Confira uma atualização do pedido '||short_id||'.';
  elsif new.status='refunded' then event_title:='Pagamento reembolsado';event_body:='O pedido '||short_id||' recebeu uma atualização de reembolso.';
  elsif new.status='cancelled' then event_title:='Pedido cancelado';event_body:='O pedido '||short_id||' foi cancelado.';
  elsif new.status in ('rejected','charged_back') then event_title:='Atualização no pagamento';event_body:='Confira os detalhes do pedido '||short_id||' no aplicativo.';
  else return new;end if;
 elsif new.tracking is distinct from old.tracking and new.fulfillment='dispatched' then
  event_key:='shop:'||new.id||':tracking:'||md5(new.tracking);event_title:='Rastreamento atualizado';event_body:='Confira o rastreamento do pedido '||short_id||' no aplicativo.';
 else return new;end if;
 insert into neo_private.event_push_jobs(device_id,event_key,kind,title,body)
 select d.id,event_key,'shop',event_title,event_body from neo_private.push_devices d where d.user_id=new.user_id on conflict do nothing;
 perform neo_private.push_dispatch_wake();return new;
end $$;
revoke all on function neo_private.shop_push_event() from public,anon,authenticated;
drop trigger if exists neo_shop_push_event on neo_private.shop_orders;
create trigger neo_shop_push_event after update of status,fulfillment,tracking on neo_private.shop_orders for each row execute function neo_private.shop_push_event();
alter table neo_private.shop_orders disable trigger neo_shop_push_event;

create or replace function public.neo_event_push_claim() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(642917127);
 delete from neo_private.event_push_jobs where created_at<now()-interval '7 days';
 with candidates as(select id from neo_private.event_push_jobs where not sent and attempts<3 and (lease_until is null or lease_until<now()) and created_at>=now()-interval '1 day' order by created_at,id limit 40),claimed as(update neo_private.event_push_jobs j set attempts=attempts+1,lease_until=now()+interval '5 minutes' from candidates c where j.id=c.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'endpoint',d.endpoint,'keys',d.keys,'kind',j.kind,'title',j.title,'body',j.body)),'[]') into result from claimed j join neo_private.push_devices d on d.id=j.device_id;
 return result;
end $$;
create or replace function public.neo_event_push_finish(p_id uuid,p_outcome text) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_outcome='gone' then delete from neo_private.push_devices where id=(select device_id from neo_private.event_push_jobs where id=p_id);
 elsif p_outcome='sent' then update neo_private.event_push_jobs set sent=true where id=p_id;
 elsif p_outcome<>'retry' then raise exception 'invalid outcome';end if;
end $$;
revoke all on function public.neo_event_push_claim(),public.neo_event_push_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.neo_event_push_claim(),public.neo_event_push_finish(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
