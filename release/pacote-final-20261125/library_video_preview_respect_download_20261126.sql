-- Applied to Teste and Produção after the 200 MiB capacity migration.
begin;
set local lock_timeout='5s';
do $guard$
declare def text:=pg_get_functiondef('neo_private.library_video_preview_current(neo_private.library_video_previews)'::regprocedure);
 anchor constant text:=$a$and f.size between 1 and 209715200$a$;
begin
 if md5(def) is distinct from 'e4200defbfe6857dc25855ce08632e26' or cardinality(string_to_array(def,anchor))<>2 then raise exception 'preview_source_contract_changed';end if;
 if exists(select 1 from neo_private.library_video_previews where state='processing') then raise exception 'preview_processing_in_progress';end if;
 execute replace(def,anchor,anchor||' and f.allow_download is true');
end$guard$;
commit;
