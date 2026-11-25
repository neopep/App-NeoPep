-- Separate, versioned decision using the existing owner-readable consent history.
begin;
set local lock_timeout='5s';

create index if not exists neo_personalization_consent_history
 on public.neo_consent_events(user_id,id desc)
 where purpose='optional_personalization' and version='2026-11-personalization-v1';

create or replace function public.neo_personalization_consent(p_granted boolean default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  account uuid:=auth.uid();
  decision public.neo_consent_events%rowtype;
  purpose_key constant text:='optional_personalization';
  text_version constant text:='2026-11-personalization-v1';
begin
  if account is null or public.neo_has_consent('terms') is not true then
    raise exception 'Entre na conta e conclua o cadastro.' using errcode='42501';
  end if;

  if p_granted is not null then
    perform pg_advisory_xact_lock(hashtextextended('neo-personalization:'||account,0));
  end if;
  select * into decision from public.neo_consent_events
  where user_id=account and purpose=purpose_key and version=text_version
  order by id desc limit 1;

  if p_granted is not null and p_granted is distinct from decision.granted then
    if p_granted and not neo_private.take_limit('personalization_consent',20,3600) then
      raise exception 'Tente novamente mais tarde.' using errcode='P0001';
    end if;
    insert into public.neo_consent_events(user_id,purpose,version,granted)
    values(account,purpose_key,text_version,p_granted) returning * into decision;
  end if;

  return jsonb_build_object('purpose',purpose_key,'version',text_version,
    'decided',decision.id is not null,'granted',coalesce(decision.granted,false),
    'changed_at',decision.changed_at);
end $$;
revoke all on function public.neo_personalization_consent(boolean) from public,anon,authenticated;
grant execute on function public.neo_personalization_consent(boolean) to authenticated;

notify pgrst,'reload schema';
commit;
