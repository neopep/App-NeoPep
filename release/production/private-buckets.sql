-- Apenas para o lote Storage autorizado. A configuração já existente é conferida.
-- As policies específicas devem ser revisadas no lote de cada módulo.
\set ON_ERROR_STOP on
\if :{?production_storage_approved}
\else
 \echo 'Defina production_storage_approved somente na janela autorizada e com o projeto confirmado.'
 \quit
\endif
\if :production_storage_approved
\else
 \quit
\endif
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
do $$
declare
 expected record;
 actual storage.buckets%rowtype;
begin
 for expected in select * from (values
  ('neo-campaign-images',5242880,array['image/jpeg','image/png','image/webp']::text[]),
  ('neo-connect-releases',52428800,array['application/octet-stream','application/vnd.microsoft.portable-executable']::text[])
 ) as requested(id,max_bytes,mime)
 loop
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values(expected.id,expected.id,false,expected.max_bytes,expected.mime)
  on conflict(id) do nothing;
  select * into strict actual from storage.buckets where id=expected.id for update;
  if actual.name is distinct from expected.id or actual.public is distinct from false
   or actual.file_size_limit is distinct from expected.max_bytes
   or actual.allowed_mime_types is null
   or not (actual.allowed_mime_types <@ expected.mime and actual.allowed_mime_types @> expected.mime) then
   raise exception 'Configuração divergente no bucket %', expected.id;
  end if;
 end loop;
end $$;
commit;
