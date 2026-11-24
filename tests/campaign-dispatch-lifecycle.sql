select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare
 lease jsonb;
 key constant uuid:='00000000-0000-0000-0000-000000000021';
 selected uuid;
 started jsonb;
 revoked_group neo_private.connect_wa_selected_groups;
begin
 select jsonb_build_object('id',id,'fence',dispatch_fence) into strict lease
 from neo_private.campaign_wa_publications where dispatch_state='leased';
 -- Pre-start crash: new lease, no increment and stale fence is rejected.
 update neo_private.campaign_wa_publications set dispatch_lease=now()-interval '1 second' where id=(lease->>'id')::uuid;
 started:=fixture_dispatch('claim');
 assert started->>'id'=lease->>'id' and started->>'fence'<>lease->>'fence';
 begin
   perform fixture_dispatch('start',lease);
   raise exception 'expired fence authorized';
 exception when insufficient_privilege then null;
 end;
 lease:=started;
 started:=fixture_dispatch('start',lease);
 assert started->>'text'='Mensagem sintética';
 assert fixture_dispatch('start',lease) is null;
 assert fixture_dispatch('finish',lease||'{"outcome":"accepted","receipt_id":"fixture-receipt"}') @> '{"state":"accepted"}';
 assert fixture_dispatch('finish',lease||'{"outcome":"accepted","receipt_id":"fixture-receipt"}') is null;
 assert exists(select 1 from neo_private.campaign_dispatch_audit where event='accepted' and receipt_id='fixture-receipt');
 assert fixture_dispatch('claim') is null;

 -- A selection revoked after scheduling fails independently before text is returned.
 update neo_private.campaign_dispatch_audit set recorded_at=now()-interval '31 seconds' where event='started';
 select id into selected from neo_private.campaign_wa_publications where dispatch_due>now() and dispatch_state='waiting' limit 1;
 update neo_private.campaign_wa_publications set dispatch_due=now()-interval '1 day' where id=selected;
 delete from neo_private.connect_wa_selected_groups g using neo_private.campaign_wa_publications p
   where p.id=selected and p.dispatch_connection=g.connection_id and p.dispatch_jid=g.group_jid returning g.* into revoked_group;
 lease:=fixture_dispatch('claim');
 assert lease->>'id'=selected::text and fixture_dispatch('start',lease) is null;
 assert exists(select 1 from neo_private.campaign_wa_publications where id=selected and dispatch_state='failed' and dispatch_attempts=0);
 insert into neo_private.connect_wa_selected_groups select (revoked_group).*;

 -- A second destination is independent. Simulate elapsed rate window and crash after start.
 update neo_private.campaign_dispatch_audit set recorded_at=now()-interval '11 seconds' where event='started';
 lease:=fixture_dispatch('claim');
 assert lease is not null;
 selected:=(lease->>'id')::uuid;
 assert fixture_dispatch('start',lease) is not null;
 assert fixture_dispatch('finish',lease||'{"outcome":"refused"}') @> '{"state":"waiting"}';
 assert exists(select 1 from neo_private.campaign_wa_publications where id=selected and dispatch_due>now() and dispatch_attempts=1);
 update neo_private.campaign_dispatch_audit set recorded_at=now()-interval '31 seconds' where event='started';
 update neo_private.campaign_wa_publications set dispatch_due=now() where id=selected;
 lease:=fixture_dispatch('claim');
 assert lease->>'id'=selected::text and fixture_dispatch('start',lease) is not null;
 perform public.neo_campaign_dispatch_admin_v1('cancel',jsonb_build_object('batch_id',key));
 assert exists(select 1 from neo_private.campaign_wa_publications where id=selected
   and dispatch_state='started' and dispatch_cancel_requested);
 update neo_private.campaign_wa_publications set dispatch_lease=now()-interval '1 second' where id=selected;
 assert fixture_dispatch('claim') is null;
 assert exists(select 1 from neo_private.campaign_wa_publications where id=selected
   and dispatch_state='uncertain' and dispatch_attempts=2);
 assert (select count(*) from neo_private.campaign_wa_publications where dispatch_state='accepted')=1;
 assert (select count(*) from neo_private.campaign_wa_publications where dispatch_state='cancelled')=1;
 assert exists(select 1 from neo_private.campaigns where popup_enabled and status='paused' and title='Revisão');
end $$;
