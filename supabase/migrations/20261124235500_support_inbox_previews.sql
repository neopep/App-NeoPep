begin;
set local lock_timeout='5s';

-- Preserve the existing inbox authorization and response. Add only display metadata.
create function public.neo_support_inbox_v1() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb; viewer uuid:=auth.uid();
begin
 if viewer is null then raise exception 'Sessão obrigatória.' using errcode='42501';end if;
 result:=public.neo_support('list','{}'::jsonb);
 return jsonb_set(result,'{threads}',coalesce((
  select jsonb_agg(items.row || case when message.id is null then '{}'::jsonb else
   jsonb_build_object('last_message',jsonb_build_object(
    'text',case when message.body='Anexo' then '' else left(message.body,120) end,
    'media',coalesce(media.items,'[]'::jsonb))) end order by items.ordinal)
  from jsonb_array_elements(coalesce(result->'threads','[]')) with ordinality items(row,ordinal)
  left join neo_private.support_threads thread on thread.id=(items.row->>'id')::uuid
    and (thread.user_id=viewer or thread.assigned_to=viewer)
    and public.neo_support_access(thread.id)
  left join lateral (
   select m.id,m.body from neo_private.support_messages m
   where m.thread_id=thread.id and m.deleted_at is null
   order by m.seq desc limit 1
  ) message on true
  left join lateral (
   select jsonb_agg(jsonb_build_object('mime',a.mime,'name',a.name) order by a.created_at,a.path) as items
   from neo_private.support_attachments a where a.message_id=message.id and a.thread_id=thread.id
  ) media on message.id is not null
 ),'[]'::jsonb),true);
end $$;
revoke all on function public.neo_support_inbox_v1() from public,anon,authenticated;
grant execute on function public.neo_support_inbox_v1() to authenticated;
notify pgrst,'reload schema';
commit;
