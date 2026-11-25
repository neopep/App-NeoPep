-- Supabase Teste: rich outbox accepts verified internal library and community references.
-- Keep same RLS, idempotency, order and confirmation gates; never touch existing receipts.
alter table neo_private.campaign_wa_rich_messages
 drop constraint if exists campaign_wa_rich_messages_kind_check;
alter table neo_private.campaign_wa_rich_messages
 add constraint campaign_wa_rich_messages_kind_check
 check (kind in ('text','image','link','product','document','community'));
