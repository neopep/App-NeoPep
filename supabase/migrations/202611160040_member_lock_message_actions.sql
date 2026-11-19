-- Member moderation and private-message actions.
begin;

alter table neo_private.community_members
 add column if not exists moderation_locked boolean not null default false;

create or replace function neo_private.community_auto_approve() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.user_id=auth.uid()
    and not exists(select 1 from neo_private.community_members m where m.user_id=new.user_id and m.moderation_locked)
    and (public.neo_is_moderator() or exists(select 1 from neo_private.community_settings where singleton and not require_approval))
 then new.status:='published';
 end if;
 return new;
end $$;

do $$begin
 if to_regprocedure('public.neo_community_members_v40(text,jsonb)') is null then
  alter function public.neo_community_members(text,jsonb) rename to neo_community_members_v40;
 end if;
end $$;
revoke all on function public.neo_community_members_v40(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_community_members(p_action text default 'list',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();target uuid;result jsonb;
begin
 if u is null then raise exception 'Entre na conta para continuar.' using errcode='42501';end if;
 target:=nullif(p_payload->>'user_id','')::uuid;
 if p_action in ('lock','unlock') then
  if not public.neo_is_moderator() then raise exception 'Acesso de moderador obrigatório.' using errcode='42501';end if;
  if target is null or target=u or not exists(select 1 from neo_private.community_members where user_id=target)
     or exists(select 1 from neo_private.admin_members where user_id=target)
     or exists(select 1 from neo_private.community_moderators where user_id=target)
  then raise exception 'Este participante não pode ser bloqueado.';end if;
  perform neo_private.take_limit('community_member_lock',60,3600);
  update neo_private.community_members set moderation_locked=(p_action='lock') where user_id=target;
  return jsonb_build_object('ok',true,'locked',p_action='lock');
 end if;
 result:=public.neo_community_members_v40(p_action,p_payload);
 if p_action in ('list','profile') then
  result:=jsonb_set(result,'{members}',coalesce((select jsonb_agg(x.value||jsonb_build_object('moderation_locked',coalesce(m.moderation_locked,false)))
    from jsonb_array_elements(coalesce(result->'members','[]')) x(value)
    left join neo_private.community_members m on m.user_id=(x.value->>'user_id')::uuid),'[]'));
  result:=result||jsonb_build_object('can_moderate_members',public.neo_is_moderator());
 end if;
 return result;
end $$;
revoke all on function public.neo_community_members(text,jsonb) from public,anon;
grant execute on function public.neo_community_members(text,jsonb) to authenticated;

alter table neo_private.support_messages add column if not exists edited_at timestamptz;
alter table neo_private.support_messages add column if not exists deleted_at timestamptz;
create table if not exists neo_private.support_message_reports(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references neo_private.support_messages(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(length(reason) between 3 and 500),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references auth.users(id),
 unique(message_id,reporter_id)
);
alter table neo_private.support_message_reports enable row level security;
revoke all on neo_private.support_message_reports from public,anon,authenticated;

do $$begin
 if to_regprocedure('public.neo_support_v40(text,jsonb)') is null then
  alter function public.neo_support(text,jsonb) rename to neo_support_v40;
 end if;
end $$;
revoke all on function public.neo_support_v40(text,jsonb) from public,anon,authenticated;

create or replace function public.neo_support(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();mid uuid;msg neo_private.support_messages;result jsonb;body_text text;reason_text text;
begin
 if u is null then raise exception 'Entre na conta para continuar.' using errcode='42501';end if;
 if p_action in ('edit_message','delete_message','report_message','resolve_report') then
  mid:=nullif(p_payload->>'message_id','')::uuid;
  if p_action='resolve_report' then
   if not public.neo_is_moderator() then raise exception 'Acesso de moderador obrigatório.' using errcode='42501';end if;
   update neo_private.support_message_reports set resolved_at=now(),resolved_by=u
    where id=(p_payload->>'report_id')::uuid and resolved_at is null;
   return jsonb_build_object('ok',true);
  end if;
  select m.* into msg from neo_private.support_messages m where m.id=mid for update;
  if msg.id is null or not public.neo_support_access(msg.thread_id) then raise exception 'Mensagem indisponível.' using errcode='42501';end if;
  if p_action='edit_message' then
   if msg.sender_id is distinct from u or msg.deleted_at is not null then raise exception 'Você só pode editar suas próprias mensagens.' using errcode='42501';end if;
   body_text:=btrim(coalesce(p_payload->>'body',''));
   if length(body_text) not between 1 and 4000 then raise exception 'A mensagem deve ter entre 1 e 4.000 caracteres.';end if;
   update neo_private.support_messages set body=body_text,edited_at=now() where id=mid;
  elsif p_action='delete_message' then
   if msg.sender_id is distinct from u or msg.deleted_at is not null then raise exception 'Você só pode excluir suas próprias mensagens.' using errcode='42501';end if;
   update neo_private.support_messages set body='Mensagem excluída',deleted_at=now(),edited_at=null where id=mid;
  else
   if msg.sender_id=u then raise exception 'Não é possível denunciar sua própria mensagem.';end if;
   reason_text:=btrim(coalesce(p_payload->>'reason','Conteúdo inadequado'));
   if length(reason_text) not between 3 and 500 then raise exception 'Descreva o motivo em até 500 caracteres.';end if;
   perform neo_private.take_limit('support_message_report',20,3600);
   insert into neo_private.support_message_reports(message_id,reporter_id,reason)
    values(mid,u,reason_text) on conflict(message_id,reporter_id) do update set reason=excluded.reason,created_at=now(),resolved_at=null,resolved_by=null;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 result:=public.neo_support_v40(p_action,p_payload);
 if p_action='open' then
  result:=jsonb_set(result,'{messages}',coalesce((select jsonb_agg(x.value||jsonb_build_object(
    'edited_at',m.edited_at,'deleted_at',m.deleted_at,'can_edit',m.sender_id=u,
    'attachments',case when m.deleted_at is null then coalesce(x.value->'attachments','[]') else '[]'::jsonb end
   ) order by (x.value->>'seq')::bigint)
   from jsonb_array_elements(coalesce(result->'messages','[]')) x(value)
   join neo_private.support_messages m on m.id=(x.value->>'id')::uuid),'[]'));
 elsif p_action='list' and public.neo_is_moderator() then
  result:=result||jsonb_build_object('reports',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r.id,'message_id',m.id,'thread_id',m.thread_id,'sender_alias',m.sender_alias,
   'body',m.body,'reason',r.reason,'created_at',r.created_at
  ) order by r.created_at desc) from neo_private.support_message_reports r
   join neo_private.support_messages m on m.id=r.message_id
   where r.resolved_at is null and public.neo_support_access(m.thread_id)),'[]'));
 end if;
 return result;
end $$;
revoke all on function public.neo_support(text,jsonb) from public,anon;
grant execute on function public.neo_support(text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
