-- Proposta para homologação. Mantém o escopo e as ACL da RPC já implantada.
CREATE OR REPLACE FUNCTION public.neo_connect_update_admin(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 v text:=p_data->>'version';
 r neo_private.connect_releases%rowtype;
 failure text;
begin
 if not neo_private.campaign_admin_allowed() then
  raise exception 'Administrador obrigatório.' using errcode='42501';
 end if;
 if p_action='list' then
  return jsonb_build_object(
   'approval_policy',1,
   'releases',(select coalesce(jsonb_agg(to_jsonb(rel) order by coalesce(rel.created_at,rel.approved_at) desc nulls last,rel.version),'[]')
    from neo_private.connect_releases rel),
   'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc,id desc),'[]') from (
    select * from neo_private.connect_update_events order by created_at desc,id desc limit 100
   ) e),
   'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc),'[]') from (
    select id,actor_id,event,release_version,release_result,created_at
    from neo_private.connect_audit where event in ('update_register','update_approve','update_block')
    order by id desc limit 100
   ) a)
  );
 end if;

 if p_action is null or p_action not in ('register','approve','block') then
  raise exception 'Operação inválida.';
 end if;
 if v is null or v !~ '^[0-9]{1,8}[.][0-9]{1,8}[.][0-9]{1,8}$' then
  raise exception 'Versão inválida.';
 end if;

 if p_action='register' then
  perform pg_advisory_xact_lock(208751192, 1);
  if nullif(p_data->>'artifact','') is null or nullif(p_data->>'signature','') is null then
   raise exception 'Artefato e assinatura obrigatórios.';
  end if;
  if coalesce(p_data->>'bytes','') !~ '^[1-9][0-9]{0,7}$' then raise exception 'Tamanho inválido.';end if;
  if (p_data->>'bytes')::bigint>52428800 then raise exception 'Tamanho excede o limite do bucket.';end if;
  select * into r from neo_private.connect_releases where version=v for update;
  if found then
   if r.distribution_state='draft' and r.profile='staging' and r.channel='stable'
      and r.path=v||'/NeoPepConnectSetup.exe' and r.bytes=(p_data->>'bytes')::bigint
      and r.sha256=p_data->>'sha256' and r.artifact=p_data->>'artifact'
      and r.release_signature=p_data->>'signature' then
    return jsonb_build_object('ok',true,'reused',true);
   end if;
   raise exception 'Versão já cadastrada com conteúdo ou estado diferente.' using errcode='23505';
  end if;
  if exists(select 1 from neo_private.connect_releases rel
     where string_to_array(rel.version,'.')::numeric[]>string_to_array(v,'.')::numeric[]) then
   return jsonb_build_object('ok',false,'code','release_version');
  end if;
  insert into neo_private.connect_releases(version,path,sha256,bytes,artifact,release_signature,notes,distribution_state)
  values(v,v||'/NeoPepConnectSetup.exe',p_data->>'sha256',(p_data->>'bytes')::bigint,p_data->>'artifact',
   p_data->>'signature',coalesce(p_data->>'notes',''),'draft');
 else
  select * into r from neo_private.connect_releases where version=v for update;
  if not found or r.distribution_state<>(case when p_action='approve' then 'draft' else 'approved' end) then
   failure:='release_state';
  elsif p_action='block' then
   update neo_private.connect_releases set distribution_state='blocked',required=false where version=v;
  elsif r.profile<>'staging' or r.channel<>'stable' or r.path<>v||'/NeoPepConnectSetup.exe'
     or r.bytes not between 1 and 52428800 or r.sha256 !~ '^[0-9a-f]{64}$'
     or coalesce(r.artifact,'') !~ '^[A-Za-z0-9._-]{1,120}$'
     or coalesce(r.release_signature,'') !~ '^[A-Za-z0-9+/]+={0,2}$'
     or length(r.release_signature) not between 344 and 1024 or length(r.release_signature)%4<>0
     or (p_data ? 'required' and jsonb_typeof(p_data->'required')<>'boolean') then
   failure:='release_manifest';
  elsif octet_length(decode(r.release_signature,'base64'))<256 then
   failure:='release_manifest';
  elsif not exists(
   select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id
   where b.id='neo-connect-releases' and b.public is false and o.name=r.path
    and o.metadata->>'size'=r.bytes::text
  ) then
   failure:='release_storage';
  else
   -- Metadata and syntax checks only. Verify the actual EXE and signed manifest outside SQL.
   update neo_private.connect_releases
   set distribution_state='approved',approved_at=now(),required=coalesce((p_data->>'required')::boolean,false)
   where version=v;
  end if;
 end if;

 insert into neo_private.connect_audit(actor_id,event,release_version,release_result)
 values(auth.uid(),'update_'||p_action,v,case when failure is null then 'ok' else 'rejected' end);
 if failure is not null then return jsonb_build_object('ok',false,'code',failure);end if;
 return jsonb_build_object('ok',true);
end $function$;
