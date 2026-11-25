insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into neo_private.admin_members(user_id) select id from auth.users;
do $$
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 perform public.neo_campaign_editor_v1('save','{"editor_id":"00000000-0000-0000-0000-000000000301","request_id":"00000000-0000-0000-0000-000000000302","channel":"whatsapp","revision":0,"draft":{"title":"Anterior","blocks":[],"groups":[],"timezone":"America/Sao_Paulo","audience":"all"}}');
end;
$$;
