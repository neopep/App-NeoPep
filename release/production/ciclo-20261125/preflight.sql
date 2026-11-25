begin read only;
select to_regclass('neo_private.signup_notice_reads') is not null
 and to_regclass('neo_private.signup_notice_rollout') is not null
 and to_regprocedure('public.neo_admin_signups(text,text,boolean,timestamptz,timestamptz,timestamptz,uuid,timestamptz)') is not null
 as signup_installed;
select to_regprocedure('public.neo_personalization_consent(boolean)') as consent_rpc,
 to_regprocedure('public.neo_support_inbox_v1()') as inbox_rpc,
 to_regprocedure('neo_private.library_pins(text,jsonb)') as pins_rpc;
select p.oid::regprocedure::text as signature,md5(pg_get_functiondef(p.oid)) as fingerprint
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','neo_private') and
 (p.proname in ('neo_shop','neo_shop_v36','shop_before_member_visibility','shop_expire')
 or p.proname like 'neo_shop_payment_event%')
 order by 1;
commit;
