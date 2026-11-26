const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const root='release/pacote-campanhas-20261126-04/campaign_wa_auto_rebind_';
const env=fs.existsSync(root+'official.sql')?'official':'test';
const sql=fs.readFileSync(root+env+'.sql','utf8');
const issuer=sql.match(/https:\/\/[a-z]+\.supabase\.co\/auth\/v1/)[0];
const config='neo_private.campaign_wa_'+env+'_config';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('troca automática mantém administrador, dispositivo, escopo de grupos e fila; sem envio',async()=>{
 const db=new PGlite();
 try{
 await db.exec("create role anon;create role authenticated;create schema auth;create schema neo_private;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;create function neo_private.campaign_admin_allowed() returns boolean language sql stable as $$select current_setting('fixture.admin',true)='yes'$$;");
 await db.exec("create table "+config+"(singleton boolean primary key,enabled boolean,schedule_enabled boolean,owner_id uuid,connection_id uuid,group_jid text);"+
 "create table neo_private.connect_config(singleton boolean primary key,paused boolean);"+
 "create table neo_private.connect_devices(id uuid primary key,owner_id uuid,state text,version text,last_seen timestamptz);"+
 "create table neo_private.connect_wa_connections(id uuid primary key,owner_id uuid,device_id uuid,status text,created_at timestamptz,last_seen_at timestamptz,last_synced_at timestamptz,revision bigint);"+
 "create table neo_private.connect_wa_selected_groups(connection_id uuid,group_jid text);"+
 "create table neo_private.campaign_dispatch_presence(device_id uuid primary key,connection_id uuid,bridge_version text,session_ready boolean,seen_at timestamptz default now());"+
 "create table neo_private.campaign_wa_rich_messages(state text);create table neo_private.campaign_wa_publications(dispatch_state text);create table neo_private.campaign_manual_claims(state text);");
 // Synthetic heartbeat fixture: preserves the exact patch anchor; no real devices or credentials.
 await db.exec("create function public.neo_campaign_dispatch_device_v1(p_action text,p_device uuid,p_secret text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='pg_catalog' as $$ declare actor uuid:=auth.uid(); connection uuid:=(p_data->>'connection_id')::uuid;begin if p_action<>'heartbeat' or p_secret<>'fixture' or not neo_private.campaign_admin_allowed() then raise exception 'unauthorized';end if; if not exists(select 1 from neo_private.connect_wa_connections c where c.id=connection and c.owner_id=actor and c.device_id=p_device) then raise exception 'unauthorized';end if; insert into neo_private.campaign_dispatch_presence(device_id,connection_id,bridge_version,session_ready) values(p_device,connection,'wa-text-v1',(p_data->>'session_ready')::boolean) on conflict(device_id) do update set connection_id=excluded.connection_id,bridge_version=excluded.bridge_version,session_ready=excluded.session_ready,seen_at=now();return jsonb_build_object('ok',true);end;$$;revoke all on function public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb) from public,anon;grant execute on function public.neo_campaign_dispatch_device_v1(text,uuid,text,jsonb) to authenticated;");
 await db.exec(sql);
 const actor=uuid(1),device=uuid(2),old=uuid(3),fresh=uuid(4),other=uuid(5),extra=uuid(6);
 const pin=env==='test'?'123@g.us':null;
 await db.query('insert into '+config+' values(true,true,true,$1,$2,$3)',[actor,old,pin]);
 await db.exec("insert into neo_private.connect_config values(true,false)");
 await db.query("insert into neo_private.connect_devices values($1,$2,'approved','0.2.15',now())",[device,actor]);
 await db.query("insert into neo_private.connect_wa_connections values($1,$2,$3,'revoked',now()-interval '1 day',now(),now(),1),($4,$2,$3,'connected',now(),now(),now(),1)",[old,actor,device,fresh]);
 await db.query("insert into neo_private.connect_wa_selected_groups values($1,'123@g.us')",[fresh]);
 const setActor=async(id=actor,iss=issuer,admin='yes')=>{await db.query("select set_config('fixture.actor',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.admin',$3,false)",[id,JSON.stringify({iss}),admin]);};
 await setActor();
 const bound=async()=>(await db.query('select connection_id from '+config)).rows[0].connection_id;
 const heartbeat=async(ready=true)=>{await db.exec('set role authenticated');try{return await db.query("select public.neo_campaign_dispatch_device_v1('heartbeat',$1,'fixture',$2::jsonb)",[device,JSON.stringify({connection_id:fresh,session_ready:ready})]);}finally{await db.exec('reset role');}};
 const unchanged=async()=>assert.equal(await bound(),old);
 await heartbeat(false);await unchanged();
 await db.query("update neo_private.connect_wa_connections set status='disconnected' where id=$1",[old]);await heartbeat();await unchanged();
 await db.query("update neo_private.connect_wa_connections set status='revoked' where id=$1",[old]);
 await setActor(actor,'https://wrong.example/auth/v1');await heartbeat();await unchanged();await setActor();
 await db.exec("update neo_private.connect_config set paused=true");await heartbeat();await unchanged();await db.exec("update neo_private.connect_config set paused=false");
 await db.query("update neo_private.connect_wa_connections set last_synced_at=now()-interval '2 days' where id=$1",[fresh]);await heartbeat();await unchanged();await db.query("update neo_private.connect_wa_connections set last_synced_at=now() where id=$1",[fresh]);
 await db.query("insert into neo_private.connect_wa_connections values($1,$2,$3,'connected',now(),now(),now(),1)",[extra,actor,device]);await heartbeat();await unchanged();await db.query("delete from neo_private.connect_wa_connections where id=$1",[extra]);
 await db.query("update neo_private.connect_wa_connections set device_id=$2 where id=$1",[old,extra]);await heartbeat();await unchanged();await db.query("update neo_private.connect_wa_connections set device_id=$2 where id=$1",[old,device]);
 await db.query("delete from neo_private.connect_wa_selected_groups where connection_id=$1",[fresh]);await heartbeat();await unchanged();
 if(env==='test'){await db.query("insert into neo_private.connect_wa_selected_groups values($1,'456@g.us')",[fresh]);await heartbeat();await unchanged();}
 await db.query("insert into neo_private.connect_wa_selected_groups values($1,'123@g.us')",[fresh]);
 for(const state of ['waiting','leased','started','uncertain']){await db.query('insert into neo_private.campaign_wa_rich_messages values($1)',[state]);await heartbeat();await unchanged();await db.exec('delete from neo_private.campaign_wa_rich_messages');}
 await db.exec("insert into neo_private.campaign_wa_publications values('waiting')");await heartbeat();await unchanged();await db.exec('delete from neo_private.campaign_wa_publications');
 await db.exec("insert into neo_private.campaign_manual_claims values('reserved')");await heartbeat();await unchanged();await db.exec('delete from neo_private.campaign_manual_claims');
 await setActor(other);await assert.rejects(heartbeat(),/unauthorized/);await unchanged();await setActor();
 await heartbeat();assert.equal(await bound(),fresh);await heartbeat();assert.equal(await bound(),fresh);
 const row=(await db.query('select enabled,schedule_enabled,group_jid from '+config)).rows[0];assert.equal(row.enabled,true);assert.equal(row.schedule_enabled,true);assert.equal(row.group_jid,pin);
 const acl=(await db.query("select has_function_privilege('anon','neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid)','execute') a,has_function_privilege('authenticated','neo_private.campaign_wa_auto_rebind(uuid,uuid,uuid)','execute') b")).rows[0];assert.equal(acl.a,false);assert.equal(acl.b,false);
 }finally{await db.close();}
});
