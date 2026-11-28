// Interoperability with the exact browser decoder and patched Windows bridge.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const album=require('./apply-album-windows-028.cjs'),members=require('./apply-group-members-windows-028.cjs'),messages=require('./apply-group-messages-windows-028.cjs'),broker=require('./apply-group-view-broker-windows-028.cjs');
async function main(root,webroot){
 const input={};for(const [p,sha] of Object.entries(album.hashes)){const b=fs.readFileSync(path.join(root,p));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),sha);input[p]=b.toString('utf8');}
 const out=broker.patchBroker(messages.patchMessages(members.patchMembers(album.patch(input))));
 const bridge=out['connect/whatsapp-lab/windows-bridge.mjs'];
 const i=bridge.indexOf('export function encryptGroupView('),j=bridge.indexOf('export function createBridge(',i);
 assert.ok(i>=0&&j>i);
 const encrypt=new Function('createPublicKey','publicEncrypt','randomBytes','createCipheriv','constants',bridge.slice(i,j).replace('export ','')+';return encryptGroupView;')(crypto.createPublicKey,crypto.publicEncrypt,crypto.randomBytes,crypto.createCipheriv,crypto.constants);
 const editor=fs.readFileSync(path.join(webroot,'dist/admin/campaign-editor.js'),'utf8');
 const a=editor.indexOf('  const groupViewBytes='),b=editor.indexOf('  function closeGroupView()',a);assert.ok(a>=0&&b>a);
 const {groupViewDecode,groupViewBase64}=new Function('crypto',editor.slice(a,b)+';return {groupViewDecode,groupViewBase64};')(crypto.webcrypto);
 const subtle=crypto.webcrypto.subtle,keys=await subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['encrypt','decrypt']);
 const key=groupViewBase64(await subtle.exportKey('spki',keys.publicKey)),id='00000000-0000-4000-8000-000000000001';
 const rows=[{name:'Pessoa fictícia',phone:'12025550123',role:'admin',id:'private'},{name:'Sem número',phone:'123@lid',role:'member'}];
 const envelope=encrypt(key,id,'members',rows);
 assert.equal(envelope.wrapped_key.length,344);assert.equal(envelope.iv.length,16);assert.ok(!JSON.stringify(envelope).includes('Pessoa fictícia'));
 assert.deepEqual(await groupViewDecode(envelope,keys.privateKey,id,'members'),[{name:'Pessoa fictícia',phone:'12025550123',role:'admin'},{name:'Sem número',phone:'',role:'member'}]);
 await assert.rejects(()=>groupViewDecode(envelope,keys.privateKey,id,'messages'));
 await assert.rejects(()=>groupViewDecode(envelope,keys.privateKey,'00000000-0000-4000-8000-000000000002','members'));
 const message=encrypt(key,id,'messages',[{text:'Texto fictício',sender:'private'}]);
 assert.deepEqual(await groupViewDecode(message,keys.privateKey,id,'messages'),[{text:'Texto fictício'}]);
 assert.throws(()=>encrypt(key,id,'messages',Array(51).fill({text:'x'})));
 assert.throws(()=>encrypt('A'.repeat(392),id,'members',[]));
 const win=out['connect/windows/WhatsApp.cs'],connect=out['connect/windows/Connect.cs'];
 assert.ok(win.includes('DialogResult.Yes||!GroupViewAvailable'));assert.ok(win.includes('CancelRemoteGroupView();}'));assert.ok(connect.includes('if(profile.IsProduction||groupViewBusy'));assert.ok(connect.includes('sessionOwner!=owner'));
 assert.ok(bridge.includes('reason!==\'complete\''));assert.ok(bridge.includes('message.confirmed!==true'));
 console.log('Windows/browser encrypted group view interoperable; scope, size and request binding passed.');
}
if(!process.argv[2]||!process.argv[3])throw Error('Provide exact 0.2.28 and web candidate worktrees');
main(path.resolve(process.argv[2]),path.resolve(process.argv[3])).catch(e=>{console.error(e);process.exitCode=1});
