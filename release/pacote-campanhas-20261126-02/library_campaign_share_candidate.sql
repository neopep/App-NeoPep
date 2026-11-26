-- Candidata: autorização de compartilhamento externo por anexo, distinta de allow_download.
-- Não aplicar sem CI, ensaio integral e autorização de implantação.
begin;
set local lock_timeout='5s';
alter table neo_private.library_uploads add column campaign_share_mode text not null default 'inherit'
 check(campaign_share_mode in ('inherit','cover','preview','original'));

create function public.neo_library_campaign_share(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $share$
declare actor uuid:=auth.uid(); item neo_private.library_uploads; target uuid; mode text; own boolean; preview_ok boolean; original_ok boolean;
begin
 if actor is null or not coalesce(public.neo_admin_access(),false) or not coalesce(neo_private.campaign_admin_allowed(),false)
 then raise exception 'campaign_library_admin_required' using errcode='42501';end if;
 if p_action not in ('get','set','authorize') or jsonb_typeof(p_data) is distinct from 'object'
 then raise exception 'campaign_library_invalid' using errcode='22023';end if;
 target:=nullif(p_data->>'material_id','')::uuid;
 select * into item from neo_private.library_uploads f where f.material_id=target and f.path=p_data->>'path' for update;
 if not found or not coalesce(public.neo_library_media_access(item.path,false),false) then
  raise exception 'campaign_library_unavailable' using errcode='42501';end if;
 own:=item.user_id=actor;
 if p_action='set' then
  mode:=p_data->>'mode';
  if not own or p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'campaign_library_owner_required' using errcode='42501';end if;
  if mode is null or mode not in ('inherit','cover','preview','original') or p_data->>'expected_mode' is distinct from item.campaign_share_mode
   then raise exception 'campaign_library_permission_changed' using errcode='40001';end if;
  if mode='preview' and (item.mime not in ('video/mp4','video/webm','video/quicktime') or item.size not between 1 and 209715200)
    or mode='original' and (item.mime not in ('application/pdf','video/mp4') or item.size not between 1 and 5242880)
   then raise exception 'campaign_library_format_or_size' using errcode='22023';end if;
  update neo_private.library_uploads set campaign_share_mode=mode where path=item.path and material_id=target and user_id=actor returning * into item;
  if mode in ('preview','original') and item.mime like 'video/%' then perform neo_private.library_video_preview_enqueue(actor,item.path);end if;
 end if;
 -- Explicit permission applies only to the attachment owner; inherited download access keeps the existing contract.
 preview_ok:=item.mime in ('video/mp4','video/webm','video/quicktime') and item.size between 1 and 209715200 and own
  and (item.campaign_share_mode in ('preview','original') or item.campaign_share_mode='inherit' and item.allow_download is true);
 original_ok:=item.mime in ('application/pdf','video/mp4') and item.size between 1 and 5242880
  and ((own and item.campaign_share_mode='original') or item.campaign_share_mode='inherit' and item.allow_download is true);
 if p_action='authorize' and not case p_data->>'mode' when 'preview' then preview_ok when 'original' then original_ok else false end
 then raise exception 'campaign_library_share_not_allowed' using errcode='42501';end if;
 return jsonb_build_object('mode',item.campaign_share_mode,'can_manage',own,'preview',preview_ok,'original',original_ok,'member_download',item.allow_download);
end;$share$;
revoke all on function public.neo_library_campaign_share(text,jsonb) from public,anon;
grant execute on function public.neo_library_campaign_share(text,jsonb) to authenticated;

-- Both environments use the same current predicate. Preserve source identity, private output,
-- approved owner/device, admin/consent checks, size, fence and lease in all existing RPCs.
do $patch$
declare d text; a constant text:='and f.allow_download is true';
begin
 if exists(select 1 from neo_private.library_video_previews where state='processing') then raise exception 'campaign_preview_processing_in_progress';end if;
 d:=pg_get_functiondef('neo_private.library_video_preview_current(neo_private.library_video_previews)'::regprocedure);
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'campaign_preview_contract_changed';end if;
 execute replace(d,a,'and (f.campaign_share_mode in (''preview'',''original'') or (f.campaign_share_mode=''inherit'' and f.allow_download is true))');
end;$patch$;
commit;
