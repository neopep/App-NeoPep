alter table neo_private.connect_config add constraint release_connect_paused check(paused);
alter table neo_private.connect_releases add constraint release_connect_no_approval check(distribution_state='draft');
revoke execute on function public.neo_connect_admin(text,jsonb),public.neo_connect_device(text,uuid,text,jsonb),
 public.neo_connect_update_admin(text,jsonb),public.neo_connect_update(text,uuid,text,text,text),
 public.neo_connect_release_stage(text,jsonb),public.neo_connect_release_allowed(text),
 public.neo_connect_wa_list_connections(),public.neo_connect_wa_list_groups(uuid,text,integer),
 public.neo_connect_wa_replace_selection(uuid,text,uuid,bigint,text,jsonb),public.neo_connect_wa_set_status(uuid,text,uuid,text)
 from public,anon,authenticated,service_role;
