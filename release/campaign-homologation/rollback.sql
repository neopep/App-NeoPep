begin;
update neo_private.campaign_test_config set enabled=false;
revoke execute on function public.neo_campaign_test_admin_v1(text,jsonb),public.neo_campaign_test_visit_v1(text,uuid) from authenticated;
notify pgrst,'reload schema';
commit;
