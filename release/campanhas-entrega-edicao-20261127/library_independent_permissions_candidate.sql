-- Separar as permissões sem ampliar a autorização de arquivos antigos.
begin;
set local lock_timeout='5s';
lock table neo_private.library_uploads in share row exclusive mode;
update neo_private.library_uploads
set campaign_share_mode=case
 when material_id is not null and allow_download is true and mime in ('application/pdf','video/mp4','video/quicktime') and size between 1 and case when mime='application/pdf' then 5242880 else 26214400 end then 'original'
 when material_id is not null and allow_download is true and mime in ('video/mp4','video/webm','video/quicktime') and size between 1 and 209715200 then 'preview'
 else 'cover' end
where campaign_share_mode='inherit';
alter table neo_private.library_uploads alter column campaign_share_mode set default 'cover';
alter table neo_private.library_uploads drop constraint library_uploads_campaign_share_mode_check;
alter table neo_private.library_uploads add constraint library_uploads_campaign_share_mode_check check(campaign_share_mode in ('cover','preview','original'));
-- The old RPC and preview policy retain their existing owner checks; inherit is no longer a valid stored mode.
create or replace function neo_private.library_file_list(p_material uuid)
returns jsonb language sql stable set search_path to 'pg_catalog' as $$
 select coalesce(jsonb_agg(jsonb_build_object('path',path,'name',name,'mime',mime,'size',size,'allow_download',allow_download,
 'campaign_share_mode',case when public.neo_admin_access() then campaign_share_mode end,
 'can_manage_campaign',coalesce(user_id=auth.uid() and public.neo_admin_access() and neo_private.campaign_admin_allowed(),false)) order by created_at,path),'[]'::jsonb)
 from neo_private.library_uploads where material_id=p_material
$$;
create or replace function neo_private.library_campaign_save_attachment(p_entry jsonb,p_material uuid)
returns void language plpgsql security invoker set search_path to 'pg_catalog' as $$
declare item neo_private.library_uploads;
begin
 if not (p_entry ? 'campaign_share_mode') then return;end if;
 select * into item from neo_private.library_uploads where path=p_entry->>'path' and material_id=p_material for update;
 if not found or item.user_id is distinct from auth.uid() or not coalesce(public.neo_admin_access(),false) or not coalesce(neo_private.campaign_admin_allowed(),false) then raise exception 'campaign_library_owner_required' using errcode='42501';end if;
 perform public.neo_library_campaign_share('set',jsonb_build_object('material_id',p_material,'path',item.path,'mode',p_entry->>'campaign_share_mode','expected_mode',p_entry->>'expected_campaign_mode','confirmed',true));
end $$;
revoke all on function neo_private.library_campaign_save_attachment(jsonb,uuid) from public,anon,authenticated;
do $patch$
declare d text;a text;
begin
 d:=pg_get_functiondef('public.neo_library_campaign_share(text,jsonb)'::regprocedure);
 a:=$a$mode not in ('inherit','cover','preview','original')$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'library_mode_contract_changed';end if;
 execute replace(d,a,$a$mode not in ('cover','preview','original')$a$);
 d:=pg_get_functiondef('public.neo_library_v24(text,jsonb)'::regprocedure);
 a:=$a$else update neo_private.library_uploads set material_id=pid where path=any(seen);result:=jsonb_build_object('ok',true,'id',pid);end if;$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'library_create_contract_changed';end if;
 execute replace(d,a,a||$a$
  for item in select value from jsonb_array_elements(files) loop
   if jsonb_typeof(item)='object' then perform neo_private.library_campaign_save_attachment(item,pid);end if;
  end loop;$a$);
 d:=pg_get_functiondef('public.neo_library_v60(text,jsonb)'::regprocedure);
 a:=$a$update neo_private.library_uploads set material_id=pid,allow_download=(entry->>'allow_download')::boolean where path=entry->>'path';$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'library_update_contract_changed';end if;
 execute replace(d,a,a||$a$
   perform neo_private.library_campaign_save_attachment(entry,pid);$a$);
end;$patch$;
commit;
