-- Candidata: aplicar somente em ambiente verificado e antes de habilitar get_publication_content.
-- Adiciona marcador de exclusão, sem mudar regras, permissões ou registros de campanha.
do $patch$
declare sig regprocedure; d text; needle text:=$a$'archived_at',parent.archived_at,'paused_at',parent.paused_at,$a$;
begin
 foreach sig in array array['public.neo_campaign_central_v1(text,jsonb)'::regprocedure,'neo_private.campaign_app_central(text,jsonb)'::regprocedure] loop
  d:=pg_get_functiondef(sig);
  if (length(d)-length(replace(d,needle,'')))<>length(needle) then raise exception 'connect_ai_deleted_marker_mismatch';end if;
  execute replace(d,needle,needle||$a$'deleted_at',parent.deleted_at,$a$);
 end loop;
end
$patch$;
