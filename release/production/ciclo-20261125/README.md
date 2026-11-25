# Candidata do ciclo 25/11/2026

A candidata parte de `fc0ae22` e integra a revisão homologada `13d6346`. Usa o build oficial e mantém os arquivos Edge oficiais, o contrato de checkout e a prévia de notificações privadas. O código Windows, sua cadeia de confiança e seus testes permanecem na revisão oficial enquanto o port das mudanças de homologação é verificado.

## Banco

- Cadastros: `signup_notice_reads`, `signup_notice_rollout` e `neo_admin_signups` já existem. O lote histórico 01 é um artefato de ensaio anterior e fica fora deste ciclo. O preflight atual verifica presença, mantendo a proteção contra colisões no renderizador anterior.
- Os três arquivos versionados de personalização, prévias de atendimento e ordenação da Biblioteca são independentes da conciliação de pedidos.
- A fundação de custos vem do commit `dac605d4a2a5bf9a587cf09aea4041bdb1e01c14` da PR #50. O editor e o dashboard usam as fontes homologadas. A conciliação 010.06 cria gatilhos síncronos em produtos, pedidos e pagamentos. A homologação do catálogo e de criação de objetos, por si só, não comprova que esses gatilhos preservam as gravações financeiras oficiais. A gestão em massa depende dessa conciliação.
- A Central e o despacho rico ainda dependem da política oficial de emissão de JWT, destinos, autorização e distribuição Windows. Os arquivos SQL de Teste não são elegíveis para execução direta em Produção.

## Gate incremental

A PR #63 usa `release/incremental-readiness.json` para validar migrações, contratos financeiros, localização, campanhas, Connect e smoke autenticado. `release/web-readiness.json` continua servindo ao lançamento público e à mudança de audiência ou condições de cadastro. Este ciclo não altera essas condições nem muda a flag `cloudValidated`. Backup informado pelo proprietário e teste de restauração são evidências distintas.

A conciliação 010.06 e a gestão em massa foram instaladas juntas no ledger oficial `20261125145240`. SHA-256 do SQL executado: `cad075e415bb3fba23dc513a9d9b29427aecc23046f8905bd68c2c707376a215`. O ensaio recriou 39 funções do catálogo oficial em PostgreSQL isolado, testou o ciclo financeiro e comparou seus fingerprints após a aplicação.

A localização oficial usa `api/location-observe.js`, restrito à origem oficial e ao target Production. A configuração exige `NEO_PROD_GEO_ENABLED=1`, `NEO_PROD_SUPABASE_PUBLISHABLE_KEY` e `NEO_PROD_GEO_SERVER_SUPABASE_KEY` no servidor e `productionGeoEnabled: true` na configuração pública somente após comprovar consentimento e funcionamento. As chaves devem ficar no projeto oficial Vercel. Nenhuma coordenada do dispositivo é enviada. A RPC exige registro de consentimento existente e aplica intervalo mínimo entre observações.

A base de rascunhos e versões do editor foi instalada sob o ledger oficial `20261125145355`, SHA-256 `2d3ef567ac648b9b6ab61315f8def011c6d84db397bb1a7753a82d25b8e4f8a5`. O salvamento sob identidade administrativa foi ensaiado em transação revertida. O postflight verificou zero versões persistidas e execução anônima negada. O lote não inclui fila, mídia rica ou Central.

## Central 014 oficial

O renderizador `render-campaigns.cjs` compõe o lote a partir das fontes homologadas e substitui o emissor, a origem dos links e a allowlist. O lote cria a fila, heartbeat, mídia e Central em uma transação. Uma constraint mantém a fila legada desativada. O despacho rico exige habilitação, um titular, conexão e grupo selecionado próprios de Produção, dispositivo aprovado, sessão e presença recentes. Nenhum destino é preenchido na aplicação.

Aplicado no Supabase oficial no ledger `20261125150040`. SHA-256 do SQL: `35d104dd877a0bab4e0c5231b680cda79922128854b8b8629546dc8b5b4e41ad`. O ensaio revertido no servidor oficial criou e recuperou um rascunho, rejeitou outro emissor e confirmou zero lotes com o envio desligado. O ensaio PostgreSQL isolado testou propriedade, idempotência, agendamento e cancelamento. A reversão documentada mantém histórico e bloqueia execução.

O worker homologado contém uma guarda explícita que retorna antes do heartbeat quando o perfil é Produção. Um dispositivo reportando 0.2.12 não remove essa guarda e não prova execução. A operação real continua desativada até validar o binário oficial, o heartbeat, a allowlist e a cadeia de atualização com conta autorizada, sem disparar mensagens automaticamente.

As duas chaves de servidor da localização foram configuradas no target Production do projeto oficial. A flag de coleta não foi habilitada.


## Hotfix 25/11 — roteamento do worker para multigrupos na Produção

A migração **`campaign_multi_selected_groups_20261125`** implementa a seleção dinâmica de até 30 grupos e a PR #64 publica o editor e a Central correspondentes.

A migração complementar **`rich_worker_heartbeat_route_no_legacy_20261125`** foi aplicada no Supabase de Produção. O heartbeat do worker agora habilita a sondagem da fila rica quando há dispositivo oficial 0.2.13 aprovado, sessão e heartbeat recentes, conexão autorizada e `campaign_wa_rich_control.enabled=true`. A constraint `campaign_dispatch_legacy_off` e o campo `campaign_dispatch_config.whatsapp_enabled=false` **permanecem inalterados**. A fila antiga não é ativada; `claim` legado retorna sem lote e o Windows consulta a fila nova.

A configuração oficial ativada permanece com `campaign_wa_official_config.group_jid=NULL`, permitindo **apenas os grupos explicitamente selecionados e sincronizados** no Connect. Cada revisão da campanha indica os destinos desejados. Confirmação explícita e validações de JWT, titular, idempotência, worker e mídia permanecem obrigatórias. Esta liberação não criou lotes e não enviou mensagens.

Snapshot exato da função oficial após a migração (para recuperação e manutenção):

~~~sql
CREATE OR REPLACE FUNCTION public.neo_campaign_dispatch_device_v1(p_action text, p_device uuid, p_secret text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
 actor uuid:=auth.uid();
 c neo_private.connect_wa_connections;
 p neo_private.campaign_wa_publications;
 presence neo_private.campaign_dispatch_presence;
 selected uuid;
 connection uuid;
 payload text;
 outcome text;
 receipt text;
 ready boolean;
 fence uuid;
begin
 if actor is null or not coalesce(neo_private.campaign_admin_allowed(),false)
    or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_data) is distinct from 'object' then
  raise exception 'campaign_device_unauthorized' using errcode='42501';
 end if;
 -- Serialize start/rhythm per device, including concurrent pollers.
 perform 1 from neo_private.connect_devices d where d.id=p_device and d.owner_id=actor
  and d.state='approved' and d.secret_hash=sha256(convert_to(p_secret,'UTF8')) for update;
 if not found then raise exception 'campaign_device_unauthorized' using errcode='42501'; end if;
 if p_action='heartbeat' then
  connection:=(p_data->>'connection_id')::uuid;
  select * into c from neo_private.connect_wa_connections where id=connection and device_id=p_device and owner_id=actor;
  if not found then raise exception 'campaign_connection_unauthorized' using errcode='42501'; end if;
  if coalesce(p_data->>'bridge_version','')<>'wa-text-v1' then
   raise exception 'campaign_bridge_unsupported' using errcode='22023';
  end if;
  insert into neo_private.campaign_dispatch_presence(device_id,connection_id,bridge_version,session_ready)
    values(p_device,connection,'wa-text-v1',coalesce((p_data->>'session_ready')::boolean,false))
  on conflict(device_id) do update set connection_id=excluded.connection_id,bridge_version=excluded.bridge_version,
    session_ready=excluded.session_ready,seen_at=now();
  -- A fila legado permanece permanentemente desativada.
  -- Desbloqueia apenas a sondagem da fila rica, sob opt-in no Windows, JWT,
  -- versao oficial, presenca e allowlist validados no servidor.
  return jsonb_build_object('capabilities',jsonb_build_array('text','rich'),
    'enabled',not coalesce((select paused from neo_private.connect_config),true)
      and (coalesce((select whatsapp_enabled from neo_private.campaign_dispatch_config),false)
        or (coalesce((select enabled from neo_private.campaign_wa_rich_control where singleton),false)
          and neo_private.campaign_wa_official_ready(actor,connection,null)
          and exists(select 1 from neo_private.connect_devices d
            where d.id=p_device and d.version='0.2.13'))));
 end if;
 if p_action is null or p_action not in ('claim','start','finish') then
  raise exception 'campaign_device_action_unavailable' using errcode='22023';
 end if;

 -- A lost lease before start is retryable. Once started, expiry is uncertain.
 -- Limit reaping per poll and skip locked rows to avoid blocking active workers.
 if p_action='claim' then
  with stale as (
   select j.id from neo_private.campaign_wa_publications j
   where dispatch_batch is not null and dispatch_state in ('leased','started') and dispatch_lease<=now()
   order by dispatch_lease limit 50 for update skip locked
  ), updated as (
   update neo_private.campaign_wa_publications j set dispatch_state=case when j.dispatch_state='started' then 'uncertain'
      when j.dispatch_cancel_requested then 'cancelled' else 'waiting' end
   from stale where j.id=stale.id returning j.id,j.dispatch_fence,j.dispatch_device,j.dispatch_state
  )
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event)
  select id,dispatch_device,dispatch_fence,case dispatch_state when 'waiting' then 'lease_expired' else dispatch_state end from updated;
 end if;

 select * into presence from neo_private.campaign_dispatch_presence where device_id=p_device;
 select * into c from neo_private.connect_wa_connections where id=presence.connection_id and device_id=p_device and owner_id=actor;
 ready:=(presence.seen_at>now()-interval '90 seconds' and presence.bridge_version='wa-text-v1'
  and presence.session_ready and c.status='connected' and c.last_seen_at>now()-interval '90 seconds'
  and c.last_synced_at>now()-interval '24 hours'
  and exists(select 1 from neo_private.connect_devices d where d.id=p_device and d.last_seen>now()-interval '90 seconds')
  and (select whatsapp_enabled from neo_private.campaign_dispatch_config)
  and not (select paused from neo_private.connect_config)) is true;

 if p_action='claim' then
  if not ready or exists(select 1 from neo_private.campaign_dispatch_audit a where a.device_id=p_device
       and a.event='started' and a.recorded_at>now()-interval '10 seconds')
      or exists(select 1 from neo_private.campaign_wa_publications j
    where j.dispatch_device=p_device and j.dispatch_state in ('leased','started') and j.dispatch_lease>now()) then return null; end if;
  select j.id into selected from neo_private.campaign_wa_publications j
    join neo_private.campaign_dispatch_batch b on b.id=j.dispatch_batch and b.owner_id=actor
    where j.dispatch_connection=presence.connection_id and j.dispatch_state='waiting'
      and not j.dispatch_cancel_requested and j.dispatch_due<=now()
    order by j.dispatch_due,j.id limit 1 for update of j skip locked;
  if not found then return null; end if;
  update neo_private.campaign_wa_publications set dispatch_state='leased',dispatch_device=p_device,
    dispatch_fence=gen_random_uuid(),dispatch_lease=now()+interval '30 seconds'
    where id=selected returning * into p;
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
    values(p.id,p_device,p.dispatch_fence,'leased',actor);
  return jsonb_build_object('id',p.id,'fence',p.dispatch_fence);
 end if;

 selected:=(p_data->>'id')::uuid;
 fence:=(p_data->>'fence')::uuid;
 select * into p from neo_private.campaign_wa_publications j
 where j.id=selected and j.dispatch_device=p_device and j.dispatch_fence=fence and j.dispatch_batch is not null
 for update;
 if not found then raise exception 'campaign_lease_unauthorized' using errcode='42501'; end if;

 if p_action='start' then
  if p.dispatch_state<>'leased' or p.dispatch_lease<=now() or p.dispatch_cancel_requested then return null; end if;
  if not ready or p.dispatch_connection<>presence.connection_id
     or exists(select 1 from neo_private.campaign_dispatch_audit a where a.device_id=p_device
       and a.event='started' and a.recorded_at>now()-interval '10 seconds') then return null; end if;
  if not exists(select 1 from neo_private.connect_wa_selected_groups g
   where g.connection_id=p.dispatch_connection and g.group_jid=p.dispatch_jid) then
   update neo_private.campaign_wa_publications set dispatch_state='failed' where id=p.id;
   insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
    values(p.id,p_device,p.dispatch_fence,'destination_revoked',actor);
   return null;
  end if;
  -- A synchronized group may appear on more than one authorized device.
  perform pg_advisory_xact_lock(hashtextextended('campaign-group:'||p.dispatch_jid,0));
  if exists(select 1 from neo_private.campaign_dispatch_audit a
    join neo_private.campaign_wa_publications prior on prior.id=a.publication_id
    where prior.dispatch_jid=p.dispatch_jid and a.event='started' and a.recorded_at>now()-interval '30 seconds') then
   return null;
  end if;
  select btrim(string_agg(x.block->>'text',E'\n\n' order by x.pos)) into payload
   from neo_private.campaign_dispatch_batch b join neo_private.campaign_editor_versions v
    on v.editor_id=b.editor_id and v.revision=b.revision
   cross join lateral jsonb_array_elements(v.draft->'blocks') with ordinality x(block,pos)
   where b.id=p.dispatch_batch;
  update neo_private.campaign_wa_publications set dispatch_state='started',dispatch_attempts=dispatch_attempts+1,
    dispatch_lease=now()+interval '60 seconds' where id=p.id;
  insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id)
   values(p.id,p_device,p.dispatch_fence,'started',actor);
  return jsonb_build_object('id',p.id,'fence',p.dispatch_fence,'group_jid',p.dispatch_jid,'text',payload);
 end if;

 outcome:=p_data->>'outcome';
 if outcome is null or outcome not in ('accepted','uncertain','refused') then
  raise exception 'campaign_invalid_outcome' using errcode='22023';
 end if;
 if p.dispatch_state<>'started' or p.dispatch_lease<=now() then return null; end if;
 receipt:=nullif(btrim(p_data->>'receipt_id'),'');
 if outcome='accepted' and (receipt is null or length(receipt)>160) then outcome:='uncertain'; end if;
 update neo_private.campaign_wa_publications set dispatch_state=case
   when outcome='refused' and p.dispatch_cancel_requested then 'cancelled'
   when outcome='refused' and p.dispatch_attempts<3 then 'waiting'
   when outcome='refused' then 'failed' else outcome end,
   dispatch_due=case when outcome='refused' then now()+p.dispatch_attempts*interval '2 minutes' else dispatch_due end
 where id=p.id returning * into p;
 insert into neo_private.campaign_dispatch_audit(publication_id,device_id,fence,event,actor_id,receipt_id)
   values(p.id,p_device,p.dispatch_fence,outcome,actor,case when outcome='accepted' then receipt end);
 return jsonb_build_object('state',p.dispatch_state);
end
$function$;
~~~
