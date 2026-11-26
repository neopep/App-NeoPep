const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('src/app.js','utf8');
const dist=fs.readFileSync('dist/app.js','utf8');
const css=fs.readFileSync('dist/style.css','utf8');
const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8');

test('calculadora mostra previsão do frasco depois do resultado e reaproveita SVG original',()=>{
 assert.equal(src,dist,'build não deve reintroduzir a calculadora anterior');
 const form=src.indexOf('function calculator(forVial=false){');
 const done=src.indexOf('function calcSliderConfig(id)',form);
 const html=src.slice(form,done);
 assert.ok(html.indexOf('card calc-result')<html.indexOf('card calc-vial-overview',html.indexOf('card calc-result')));
 assert.ok(src.includes("calcVial('balance')"));
 assert.ok(src.includes('[data-calc-fill="balance"]'));
 assert.ok(src.includes("fill.setAttribute('height',height)"));
 assert.match(css,/\.calc-vial-overview \.calc-vial-art \.calc-vial/);
 assert.match(css,/\[data-theme=light\] \.calc-vial-overview/);
});

test('cálculo funciona sem frasco físico e usa última dosagem salva por padrão',()=>{
 assert.ok(src.includes("Cálculo atual (automático)"));
 assert.ok(src.includes("const selected=saved.items[0]||null;"));
 assert.ok(src.includes("calcVialFormulaSelection=selected?.id||'';"));
 assert.ok(src.includes("const enteredMass=valid?Number($('#mass').value):0;"));
 assert.ok(src.includes("const vial=stored.items.find(item=>item.id===stored.active);"));
 assert.ok(src.includes("if(event.target.id==='calc-vial-select')"));
 assert.ok(src.includes("if(selected)applyCalcSaved(selected);"));
 assert.ok(src.includes("updateCalcVial();"));
 assert.ok(src.includes("Dosagem acompanhada<select id=\"calc-vial-select\""));
 assert.ok(!src.includes('calc-vial-tracked-select'));
 assert.ok(!src.includes('data-calc-vial-action'));
 assert.match(src,/const mass=enteredMass;\s*const remaining=mass;/);
});

test('capa de vídeo procura frame após início antes de gerar JPEG, com alternativa na falha',()=>{
 assert.ok(editor.includes("video.currentTime=offset"));
 assert.ok(editor.includes("await until('seeked',8000"));
 assert.ok(editor.includes("[.15,.38,.63].map(fraction"));
 assert.ok(editor.includes("canvas.toDataURL('image/jpeg',.82)"));
 assert.ok(editor.includes("Capa automática indisponível: escolher imagem alternativa"));
});

function vialHarness(){
 const state={doses:[]};
 const vial={id:'v1',name:'Produto A',product:'Produto A',mass:10,volume:2};
 let stored={items:[vial],links:{},active:vial.id};
 const functions=src.slice(src.indexOf('function vialDoseMass('),src.indexOf("document.addEventListener('click',event=>{\n if(!event.target.closest('[data-diary-vial-save]')"));
 const api=new Function('state','readCalcVials','saveCalcVials',functions+';return {vialBalance,activeDiaryVial,prepareDiaryVialLink};')(state,()=>stored,next=>{stored=next});
 return {state,stored,vial,...api};
}
test('diário vincula automaticamente, desconta somente registros existentes e preserva o histórico',()=>{
 const h=vialHarness(),a={id:'d1',product:'Produto A',unit:'mg',amount:2};
 h.prepareDiaryVialLink(a,null,'v1');
 assert.equal(h.stored.links.d1,'v1');
 assert.equal(h.vialBalance(h.vial,h.stored.links).mass,10);
 h.state.doses.push(a);
 assert.deepEqual(h.vialBalance(h.vial,h.stored.links),{mass:8,volume:1.6,percent:80});
 const b={id:'d2',product:'Produto A',unit:'mcg',amount:2000};
 h.prepareDiaryVialLink(b,null,'v1');h.state.doses.push(b);
 const c={id:'d3',product:'Produto A',unit:'mL',amount:1.2};
 h.prepareDiaryVialLink(c,null,'v1');h.state.doses.push(c);
 assert.equal(h.vialBalance(h.vial,h.stored.links).mass,0);
 assert.equal(h.activeDiaryVial(h.stored),null);
 assert.throws(()=>h.prepareDiaryVialLink({...a,id:'d4'},null,'v1'),/novo frasco/);
 const next={id:'v2',product:'Produto A',name:'Produto A',mass:10,volume:2};
 h.stored.items.unshift(next);h.stored.active=next.id;
 h.prepareDiaryVialLink({...a,amount:1},a,'v1');h.state.doses[0]={...a,amount:1};
 assert.equal(h.stored.links.d1,'v1');assert.equal(h.vialBalance(h.vial,h.stored.links).mass,1);
 assert.equal(h.vialBalance(next,h.stored.links).mass,10);
 h.state.doses=h.state.doses.filter(r=>r.id!=='d2');
 assert.equal(h.vialBalance(h.vial,h.stored.links).mass,3);
});
test('diário impede vínculo incompatível, saldo insuficiente e mudança de frasco',()=>{
 const h=vialHarness(),r={id:'d1',product:'Produto A',unit:'mg',amount:1};
 assert.throws(()=>h.prepareDiaryVialLink(r,null,'outro'),/frasco mudou/);
 assert.throws(()=>h.prepareDiaryVialLink({...r,product:'Produto B'},null,'v1'),/não corresponde/);
 assert.throws(()=>h.prepareDiaryVialLink({...r,amount:11},null,'v1'),/excede/);
 assert.deepEqual(h.stored.links,{});
 h.prepareDiaryVialLink(r,r,'');assert.deepEqual(h.stored.links,{});
});
test('diário usa os cards originais e separa acompanhamento físico da calculadora',()=>{
 assert.match(src,/\$\{diaryVials\(\)\}<section class="card"><div class="card-head"><h2>Histórico de aplicações/);
 assert.match(src,/frasco:\(\)=>calculator\(true\)/);
 assert.match(src,/\$\{calcField\('mass'\)\}\$\{calcField\('volume'\)\}\$\{calcCapacity\(\)\}\$\{calcField\('dose'\)\}/);
 assert.match(src,/data-diary-vial-save/);
 assert.match(src,/Histórico de frascos/);
 assert.match(src,/Frasco vinculado:/);
});
