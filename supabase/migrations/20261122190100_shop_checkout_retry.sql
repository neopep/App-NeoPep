-- Correção dirigida ao wrapper de frete; preserva OID, grants e funções externas.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
set local search_path=pg_catalog;
do $migration$
declare
 routine regprocedure:=to_regprocedure('public.neo_shop_v36(text,jsonb)');
 body_hash text;
 definition text;
 old_fragment constant text:=$fragment$ elsif p_action='order' then
$fragment$;
 new_fragment constant text:=$fragment$ elsif p_action='order' then
  declare
   caller uuid := auth.uid();
   checkout_key uuid;
   existing neo_private.shop_orders%rowtype;
   submitted_address jsonb := p_payload->'address';
   saved_address jsonb;
  begin
   if caller is null then raise exception 'Entre na conta para acessar a loja.' using errcode='42501';end if;
   checkout_key := (p_payload->>'request_key')::uuid;
   -- Same transaction lock already used by the order and payment routines.
   perform pg_advisory_xact_lock(642917200);
   select * into existing from neo_private.shop_orders
    where user_id=caller and request_key=checkout_key for update;
   if found then
    saved_address:=jsonb_build_object(
     'name',submitted_address->>'name','email',submitted_address->>'email','phone',submitted_address->>'phone',
     'postal_code',submitted_address->>'postal_code','street',submitted_address->>'street','number',submitted_address->>'number',
     'complement',coalesce(submitted_address->>'complement',''),'district',submitted_address->>'district',
     'city',submitted_address->>'city','state',submitted_address->>'state');
    if jsonb_typeof(submitted_address) is distinct from 'object' or saved_address is distinct from existing.address
     or (existing.billing_document_type is not null and existing.billing_document_type is distinct from upper(coalesce(submitted_address->>'document_type','')))
     or (existing.billing_document_number is not null and existing.billing_document_number is distinct from regexp_replace(coalesce(submitted_address->>'document_number',''),'\D','','g')) then
     raise exception 'O pedido já foi criado com outro endereço ou faturamento.' using errcode='22023';
    end if;
    if (p_payload->>'expected_total_cents')::bigint is distinct from existing.total_cents then
     raise exception 'O pedido já foi criado com outro total.' using errcode='22023';
    end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'billing_document_type',existing.billing_document_type);
   end if;
  end;
$fragment$;
begin
 select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') into body_hash from pg_proc where oid=routine;
 if body_hash='cba1a27d4d54e0cb050877b3434003440a3ba9493cd27dad43b4a4ebd1038521' then return;end if;
 if body_hash is distinct from '2ce19e73bcb43f0d86793b99155143ef841c9559d665129278dd6749cbb222c9' then
  raise exception 'neo_shop_v36 difere da definição auditada; suspenda a operação';
 end if;
 definition:=replace(pg_get_functiondef(routine),E'\r\n',E'\n');
 if strpos(definition,old_fragment)=0 then raise exception 'Trecho esperado ausente';end if;
 execute replace(definition,old_fragment,new_fragment);
 select encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') into body_hash from pg_proc where oid=routine;
 if body_hash is distinct from 'cba1a27d4d54e0cb050877b3434003440a3ba9493cd27dad43b4a4ebd1038521' then raise exception 'Fingerprint posterior inesperado';end if;
end
$migration$;
commit;
