begin;
set local lock_timeout='5s';
do $patch$
declare
 editor text:=pg_get_functiondef(to_regprocedure('public.neo_campaign_editor_v1(text,jsonb)'));
 dispatch text:=pg_get_functiondef(to_regprocedure('public.neo_campaign_rich_admin_v1(text,jsonb)'));
 anchor text:=$a$b->>'type'<>'image'$a$;
begin
 if editor is null or (length(editor)-length(replace(editor,anchor,'')))<>length(anchor) then
  raise exception 'Contrato de referências do editor divergente';
 end if;
 execute replace(editor,anchor,$a$b->>'type' not in ('image','document')$a$);

 anchor:=$a$  if length(body)>2000 then raise exception 'rich_caption_exceeds_limit'$a$;
 if dispatch is null or (length(dispatch)-length(replace(dispatch,anchor,'')))<>length(anchor) then
  raise exception 'Contrato de mídia da fila divergente';
 end if;
 dispatch:=replace(dispatch,anchor,$new$
  -- The document branch above still resolves authorization and the canonical
  -- material URL. Deliver only the owner's JPEG through the image protocol.
  if kind='document' and bl->>'media_path' is not null then
   if not exists(select 1 from jsonb_array_elements(coalesce(
      public.neo_library('get',jsonb_build_object('id',bl->>'ref'))->'material'->'attachments','[]'::jsonb)) a
      where a->>'mime'='application/pdf' or a->>'mime' like 'video/%')
   then raise exception 'rich_reference_source_forbidden' using errcode='42501'; end if;
   image_path:=bl->>'media_path';
   if image_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$'
      or split_part(image_path,'/',1)<>actor::text
      or not exists(select 1 from storage.objects o where o.bucket_id='neo-campaign-images'
       and o.name=image_path and o.metadata->>'mimetype'='image/jpeg'
       and case when coalesce(o.metadata->>'size','') ~ '^[0-9]{1,9}$'
        then (o.metadata->>'size')::integer between 1 and 1048576 else false end)
   then raise exception 'rich_reference_jpeg_invalid' using errcode='22023'; end if;
   image_bucket:='neo-campaign-images';
   kind:='image';
  end if;
  if length(body)>2000 then raise exception 'rich_caption_exceeds_limit'$new$);
 execute dispatch;
end;
$patch$;
notify pgrst,'reload schema';
commit;
