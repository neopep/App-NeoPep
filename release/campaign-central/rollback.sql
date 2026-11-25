-- Revert the frontend first. Retain links, audit and the no-resend guards for prior occurrences.
begin;
revoke execute on function public.neo_campaign_central_v1(text,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;
