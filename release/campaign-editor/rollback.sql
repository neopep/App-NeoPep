-- Preserve review versions and the constraint that prevents legacy activation.
begin;
revoke execute on function public.neo_campaign_editor_v1(text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
