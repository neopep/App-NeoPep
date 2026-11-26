'use strict';
const test=require('node:test');
const fs=require('node:fs');
async function verify(source,css){
 const eq=(x,y,msg)=>{if(JSON.stringify(x)!==JSON.stringify(y))throw Error(msg+': '+JSON.stringify(x)+' != '+JSON.stringify(y));};
 const ok=(x,msg)=>{if(!x)throw Error(msg);};
 const reject=async(fn,msg)=>{let failed=false;try{await fn()}catch{failed=true}ok(failed,msg);};
 const between=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+1);ok(start>=0&&end>start,'source anchors');return source.slice(start,end);};
 new Function(source);
 const keyboard=between("  const viewport=window.visualViewport;","  viewport?.addEventListener('resize',resize);");
 const props={},classes=new Set(),viewport={height:800,offsetTop:0,scale:1},win={visualViewport:viewport,innerHeight:844},doc={documentElement:{clientHeight:844,clientWidth:390},activeElement:{matches:()=>true}},dialog={contains:()=>true,style:{setProperty:(k,v)=>props[k]=v},classList:{contains:k=>classes.has(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
 const resize=new Function('window','document','dialog','readOnly',keyboard+'\nreturn resize;')(win,doc,dialog,false);
 resize();eq(props['--structured-frame-height'],'800px','closed frame');viewport.height=460;viewport.offsetTop=30;resize();eq(props['--structured-frame-height'],'800px','preview remains stable');eq(props['--structured-keyboard'],'340px','composer shift');eq(props['--structured-top'],'30px','viewport offset compensation');viewport.height=800;viewport.offsetTop=0;resize();eq(props['--structured-frame-height'],'800px','frame restored');eq(props['--structured-keyboard'],'0px','composer restored');ok(css.includes('margin-bottom:0;transform:translateY(calc(-1 * var(--structured-keyboard,0px)))'),'footer must move independently');
 const origin='https://example.supabase.co';let fetches=0;
 class MockURL{constructor(s){const m=/^(https?):\/\/([^/]+)(\/[^?]*)(?:\?.*)?$/.exec(s);if(!m)throw Error('invalid URL');this.protocol=m[1]+':';this.origin=m[1]+'://'+m[2];this.pathname=m[3];this.href=s;this.username='';this.password='';}}
 const image={type:'image/jpeg',size:20};
 const fakeFetch=async(url,options)=>{fetches++;eq(options.credentials,'omit','no credentials');eq(options.redirect,'error','redirects rejected');return{ok:true,headers:{get:()=>null},blob:async()=>image};};
 const helpers=new Function('URL','fetch','window','e',between(" async function communityPhotoBlob"," function validLink")+'\nreturn {communityPhotoBlob,communityTextBlocks,communitySummaryCard};')(MockURL,fakeFetch,{NeoCore:{formatWeight:v=>String(v)}},v=>String(v).replace(/</g,'&lt;'));
 const photoCloud={communityPhotoURL:async path=>origin+'/storage/v1/object/sign/neo-community/'+path+'?token=synthetic'};
 eq(await helpers.communityPhotoBlob(photoCloud,'shared.jpg',{aborted:false},origin),image,'shared community JPEG');
 await reject(()=>helpers.communityPhotoBlob({communityPhotoURL:async()=>origin+'/storage/v1/object/sign/neo-comparisons/private.jpg' },'private.jpg',{aborted:false},origin),'must reject personal comparison bucket');eq(fetches,1,'no private comparison download');
 await reject(()=>helpers.communityPhotoBlob({communityPhotoURL:async()=> 'https://other.example/storage/v1/object/sign/neo-community/shared.jpg'},'shared.jpg',{aborted:false},origin),'wrong environment rejected');eq(fetches,1,'no other environment fetch');
 const text='a'.repeat(1999)+'😀'+'b'.repeat(100);const chunks=helpers.communityTextBlocks(text);ok(chunks.every(x=>x.text.length<=2000),'text block length');eq(chunks.map(x=>x.text).join(''),text,'no truncated surrogate or text');
 const html=helpers.communitySummaryCard({change_kg:-5,days:15,as_of:'2026-11-01'});ok(html.includes('Variação de peso')&&html.includes('15 dias'),'summary renders without community module');
 const published={id:'post',status:'published',alias:'Autor',body:'Texto original completo',photo_path:'shared.jpg'};
 const rowCode=between("  function communityRows(){","  function referenceCard(block){");
 const getRows=new Function('cloud','let communityFeed=null;'+rowCode+'\nreturn communityRows;')({communityInboxV2:async()=>({posts:[published,{id:'pending',status:'pending',body:'Não aprovado'}]})});
 eq((await getRows()).map(x=>x.id),['post'],'only published posts selectable');
 const recoveredRows=new Function('cloud','let communityFeed=null;'+rowCode+'\nreturn communityRows;')({communityInboxV2:async()=>({posts:[{id:'legacy',status:'published',own:true,body:'Foto compartilhada'}]}),community:async()=>({posts:[{id:'legacy',photo_path:'own-shared.jpg'}]})});
 eq((await recoveredRows())[0].photo_path,'own-shared.jpg','authorized own legacy photo');
 const importer=between('async function importCommunity(){','async function chooseLibraryShare(row,trigger){');
 async function attempt({confirm=true,post=published,mediaError=false,active=true}={}){
  const draft={blocks:[{id:'existing',type:'text',text:'Antes'}]},status={},button={},session={post:published,row:{id:'post'},busy:false};let i=0,saved=0,stored=0,deleted=0;
  const run=new Function('env',`const {communityShare,communityShareActive,$,window,communityRows,communityTextBlocks,communitySummaryCard,communityPhotoBlob,cloud,previewAbort,draft,uuid,storeMedia,mediaKey,commitEdit,render,changed,closeSheet,saveLocal,tell,linkFor}=env;let communityFeed=null,editing=null,captionTarget=null;${importer}\nreturn importCommunity;`);
  await run({communityShare:session,communityShareActive:()=>active,$:s=>s.includes('status')?status:button,window:{confirm:()=>confirm,NEO_CONFIG:{supabaseUrl:origin}},communityRows:async()=>post?[post]:[],communityTextBlocks:helpers.communityTextBlocks,communitySummaryCard:helpers.communitySummaryCard,communityPhotoBlob:async()=>{if(mediaError)throw Error('media unavailable');return image;},cloud:photoCloud,previewAbort:{signal:{aborted:false}},draft,uuid:()=>`id${++i}`,storeMedia:async(mode,fn)=>fn({put:()=>{stored++},delete:()=>{deleted++}}),mediaKey:id=>id,commitEdit:()=>true,render:()=>{},changed:()=>{},closeSheet:()=>{},saveLocal:()=>{saved++;return true},tell:()=>{},linkFor:()=> 'https://example.com/#comunidade'})();
  return {draft,status,saved,stored,deleted};
 }
 const imported=await attempt();eq(imported.draft.blocks.map(x=>x.type),['text','image','text'],'photo and text independent blocks');eq(imported.draft.blocks[2].text,published.body,'original text');eq(imported.stored,1,'local original stored');eq(imported.saved,1,'draft persisted');
 const canceled=await attempt({confirm:false});eq(canceled.draft.blocks.length,1,'no import without explicit authorization');eq(canceled.stored,0,'no image copy after cancel');
 const failed=await attempt({mediaError:true});eq(failed.draft.blocks.length,1,'atomic failure preserves draft');eq(failed.saved,0,'failed import not saved');
 const missing=await attempt({post:null});eq(missing.draft.blocks.length,1,'removed post cannot be copied');
 ok(source.includes("else localImage=await readDraftMedia(block.id)")&&source.includes('block.media_path=stored'),'ordinary authorized image upload remains in use');
 return {keyboard:'pass',photo:'pass',isolation:'pass',summary:'pass',text:'pass',published:'pass',legacy:'pass',import:'pass',cancel:'pass',failure:'pass',removed:'pass'};
}

test('editor independente e importacao autorizada de publicacoes da comunidade',async()=>{
 await verify(fs.readFileSync('dist/admin/campaign-editor.js','utf8'),fs.readFileSync('dist/style.css','utf8'));
});
