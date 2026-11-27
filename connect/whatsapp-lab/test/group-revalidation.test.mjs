import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../windows-bridge.mjs';
const jid='123-1@g.us',request='12345678-1234-1234-1234-123456789012';
test('bridge revalidation requires confirmation; blocked request has no receipt and is not uncertain',async()=>{
 const events=[];let checks=0;
 const bridge=createBridge({emit:e=>events.push(e),providerFactory:async args=>({start(){args.onState('conectado');},close(){},account(){return {};},async revalidateGroupAvailability(id,confirmed){assert.equal(id,jid);assert.equal(confirmed,true);checks++;return {code:'local_pause_cleared'};},async sendText(){return {blocked:'previous_421'};}})});
 await bridge.receive({action:'connect'});
 await bridge.receive({action:'revalidate_group_availability',group_jid:jid});assert.equal(checks,0);
 await bridge.receive({action:'revalidate_group_availability',group_jid:jid,official_confirmed:true});assert.equal(checks,1);
 assert.equal(events.at(-1).value.code,'local_pause_cleared');
 await bridge.receive({action:'send_text',group_jid:jid,request_id:request,text:'test'});
 const result=events.at(-1).value;assert.equal(result.status,'rejected');assert.equal(result.reason_code,'previous_421');assert.equal(result.message_id,undefined);
 assert.equal(events.some(e=>e.type==='group_send_stage'&&e.value.stage==='paused_previous_421'),true);
 await bridge.close();
});
