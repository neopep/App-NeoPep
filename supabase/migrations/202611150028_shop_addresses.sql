-- Agenda privada de enderecos e dados de faturamento do checkout.
create table if not exists neo_private.shop_addresses(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Principal', name text not null, email text not null, phone text not null,
 document_type text not null check(document_type in ('CPF','CNPJ')), document_number text not null check(document_number ~ '^\d{11}(\d{3})?$'),
 postal_code text not null, street text not null, number text not null, complement text not null default '', district text not null,
 city text not null, state text not null check(state ~ '^[A-Z]{2}$'), is_default boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists shop_addresses_user_idx on neo_private.shop_addresses(user_id,is_default desc,updated_at desc);
alter table neo_private.shop_addresses enable row level security;
revoke all on neo_private.shop_addresses from public,anon,authenticated;

create or replace function public.neo_shop_address(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid();a neo_private.shop_addresses;aid uuid;make_default boolean;t text:=upper(coalesce(p_payload->>'document_type',''));n text:=regexp_replace(coalesce(p_payload->>'document_number',''),'\D','','g');
begin
 if u is null then raise exception 'Entre na sua conta para continuar.';end if;
 if p_action='list' then return coalesce((select jsonb_agg(to_jsonb(x) order by x.is_default desc,x.updated_at desc) from neo_private.shop_addresses x where x.user_id=u),'[]'::jsonb);end if;
 if p_action='save' then
  if not public.neo_valid_br_document(t,n) then raise exception 'Informe um CPF ou CNPJ valido.';end if;
  if length(trim(coalesce(p_payload->>'name',''))) not between 2 and 100 or length(trim(coalesce(p_payload->>'email',''))) not between 5 and 254 or trim(coalesce(p_payload->>'email','')) not like '%@%'
   or length(regexp_replace(coalesce(p_payload->>'phone',''),'\D','','g')) not between 10 and 13 or length(regexp_replace(coalesce(p_payload->>'postal_code',''),'\D','','g'))<>8
   or length(trim(coalesce(p_payload->>'street',''))) not between 2 and 150 or length(trim(coalesce(p_payload->>'number',''))) not between 1 and 20
   or length(trim(coalesce(p_payload->>'district',''))) not between 2 and 100 or length(trim(coalesce(p_payload->>'city',''))) not between 2 and 100 or upper(coalesce(p_payload->>'state','')) !~ '^[A-Z]{2}$'
  then raise exception 'Revise os dados do endereco antes de salvar.';end if;
  if (select count(*) from neo_private.shop_addresses where user_id=u)>=10 and nullif(p_payload->>'id','') is null then raise exception 'Voce pode salvar ate 10 enderecos.';end if;
  make_default:=coalesce((p_payload->>'is_default')::boolean,false) or not exists(select 1 from neo_private.shop_addresses where user_id=u);
  if make_default then update neo_private.shop_addresses set is_default=false where user_id=u;end if;
  aid:=nullif(p_payload->>'id','')::uuid;
  if aid is null then
   insert into neo_private.shop_addresses(user_id,label,name,email,phone,document_type,document_number,postal_code,street,number,complement,district,city,state,is_default)
   values(u,left(coalesce(nullif(trim(p_payload->>'label'),''),'Principal'),40),trim(p_payload->>'name'),lower(trim(p_payload->>'email')),trim(p_payload->>'phone'),t,n,regexp_replace(p_payload->>'postal_code','\D','','g'),trim(p_payload->>'street'),trim(p_payload->>'number'),left(trim(coalesce(p_payload->>'complement','')),100),trim(p_payload->>'district'),trim(p_payload->>'city'),upper(p_payload->>'state'),make_default) returning * into a;
  else
   update neo_private.shop_addresses set label=left(coalesce(nullif(trim(p_payload->>'label'),''),label),40),name=trim(p_payload->>'name'),email=lower(trim(p_payload->>'email')),phone=trim(p_payload->>'phone'),document_type=t,document_number=n,postal_code=regexp_replace(p_payload->>'postal_code','\D','','g'),street=trim(p_payload->>'street'),number=trim(p_payload->>'number'),complement=left(trim(coalesce(p_payload->>'complement','')),100),district=trim(p_payload->>'district'),city=trim(p_payload->>'city'),state=upper(p_payload->>'state'),is_default=case when make_default then true else is_default end,updated_at=now() where id=aid and user_id=u returning * into a;
   if a.id is null then raise exception 'Endereco nao encontrado.';end if;
  end if;
  return to_jsonb(a);
 end if;
 if p_action='delete' then aid:=nullif(p_payload->>'id','')::uuid;delete from neo_private.shop_addresses where id=aid and user_id=u returning * into a;if a.id is null then raise exception 'Endereco nao encontrado.';end if;if a.is_default then update neo_private.shop_addresses set is_default=true where id=(select id from neo_private.shop_addresses where user_id=u order by updated_at desc limit 1);end if;return '{"ok":true}'::jsonb;end if;
 raise exception 'Acao invalida.';
end$$;
revoke all on function public.neo_shop_address(text,jsonb) from public,anon,authenticated;
grant execute on function public.neo_shop_address(text,jsonb) to authenticated;
