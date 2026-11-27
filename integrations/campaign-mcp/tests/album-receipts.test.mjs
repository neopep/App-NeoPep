import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {createBaileysProvider} from '../../../connect/whatsapp-lab/whatsapp-provider.mjs';
import {EventEmitter} from 'node:events';

test('partial Baileys result is retained on the native attempt across executor restart',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role;create schema neo_private;
   create table neo_private.campaign_wa_rich_messages(id uuid primary key,fence uuid,state text,receipt_id text,sent_at timestamptz,lease_until timestamptz);
   create function public.neo_campaign_rich_device_v1(p_action text,p_device uuid,p_secret text,p_data jsonb)
   returns jsonb language plpgsql as $fn$
   declare m neo_private.campaign_wa_rich_messages; outcome text;
   begin
    if p_action='claim' then
     update neo_private.campaign_wa_rich_messages set state='uncertain' where state in ('leased','started') and lease_until<now();
     select * into m from neo_private.campaign_wa_rich_messages where state='waiting';
     if not found then return null; end if;
     return to_jsonb(m);
    end if;
    select * into strict m from neo_private.campaign_wa_rich_messages
     where id=(p_data->>'id')::uuid and fence=(p_data->>'fence')::uuid and state='started' for update;
    outcome:=p_data->>'outcome';
    update neo_private.campaign_wa_rich_messages set state=outcome,receipt_id=p_data->>'receipt_id',
    sent_at=now(),lease_until=null where id=m.id;
    return '{"ok":true}'::jsonb;
   end $fn$;
  `);
  await db.exec(readFileSync(new URL('../../../release/connect-ai/012-album-receipts.candidate.sql',import.meta.url),'utf8'));
  const id='11111111-1111-4111-8111-111111111111',fence='22222222-2222-4222-8222-222222222222';
  await db.query("insert into neo_private.campaign_wa_rich_messages(id,fence,state,album_items) values($1,$2,'started','[{},{},{},{}]')",[id,fence]);
  const events=new EventEmitter();
  let calls=0;
  const provider=await createBaileysProvider({onState(){},onQr(){}},{load:async()=>[{
   BufferJSON:{},initAuthCreds:()=>({}),default:()=>({
    ev:events,end(){},
    groupFetchAllParticipating:async()=>({group:{id:'123@g.us'}}),
    async sendMessage(){
     calls++;
     if(calls>2)throw Error('network interrupted');
     return {key:{id:calls===1?'parent':'child-0'}};
    }
   })
  },{default:()=>({})}]});
  provider.start();events.emit('connection.update',{connection:'open'});
  const images=Array.from({length:4},()=>({image:Buffer.from([255,216,255,255,217]),caption:''}));
  const receipt=await provider.sendAlbum('123@g.us',images);
  provider.close();
  assert.equal(receipt.status,'uncertain');
  const run=async(action,payload)=>(await db.query('select public.neo_campaign_rich_device_v1($1,null,null,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;
  const finish={id,fence,outcome:'uncertain',album_receipt:{message_id:receipt.messageId,media:receipt.media}};
  await assert.rejects(run('finish',{...finish,outcome:'accepted',receipt_id:'parent'}),{code:'22023'});
  assert.deepEqual(await run('finish',finish),{ok:true});
  const row=(await db.query('select state,album_receipt from neo_private.campaign_wa_rich_messages where id=$1',[id])).rows[0];
  assert.deepEqual(row,{state:'uncertain',album_receipt:finish.album_receipt});
  assert.equal(await run('claim',{}),null);
  await assert.rejects(run('finish',finish));
  assert.equal(calls,3);
  // A second attempt lost its finish response when the process stopped.
  const interrupted='33333333-3333-4333-8333-333333333333';
  await db.query("insert into neo_private.campaign_wa_rich_messages(id,fence,state,album_items,lease_until) values($1,$2,'started','[{},{},{},{}]',now()-interval '1 second')",[interrupted,fence]);
  assert.equal(await run('claim',{}),null);
  assert.deepEqual((await db.query('select state,album_receipt from neo_private.campaign_wa_rich_messages where id=$1',[interrupted])).rows[0],
   {state:'uncertain',album_receipt:null});
 }finally{await db.close();}
});
