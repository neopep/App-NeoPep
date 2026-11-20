-- Permite que a funcao legada insira o produto antes de o wrapper gravar payment_name.
begin;
alter table neo_private.shop_products alter column payment_name set default 'Produto';
update neo_private.shop_products set payment_name=name where payment_name='Produto' and name is not null;
commit;
