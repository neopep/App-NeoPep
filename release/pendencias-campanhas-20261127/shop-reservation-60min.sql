-- Increase reservation for new NeoPep shop orders to one hour; existing orders and provider links remain unchanged.
alter table neo_private.shop_orders alter column expires_at set default (now()+interval '1 hour');
