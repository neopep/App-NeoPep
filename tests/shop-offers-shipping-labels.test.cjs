'use strict';
const test=require('node:test');
const fs=require('node:fs');
function verify(source,css,sql){
 const check=(x,m)=>{if(!x)throw Error(m)};
 const get=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+1);check(i>=0&&j>i,'anchors '+a);return source.slice(i,j)};
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 new Function(source);
 const api=new Function('C','e',get(' function activeOffer(p){'," document.addEventListener('click'")+get(' const offerBadge=',' function catalogue(){')+'return {activeOffer,displayPrice,offerBadge,offerPrice};')({money:v=>'R$ '+(v/100).toFixed(2)},e);
 const p={active:true,stock:5,price_cents:99700,offer:{original_price_cents:99700,price_cents:79760,valid_until:'2099-01-01T00:00:00Z'}};
 check(api.activeOffer(p).percent==='20'&&api.displayPrice(p)===79760,'percent and price');
 check(api.offerPrice(p).includes('<del>R$ 997.00</del>')&&api.offerPrice(p).includes('R$ 797.60'),'original and sale');
 check(api.offerBadge(p).includes('OFERTA'),'offer badge');
 for(const invalid of [{...p,offer:null},{...p,stock:0},{...p,active:false},{...p,shop_store_hidden:true},{...p,offer:{...p.offer,valid_until:'2020-01-01'}},{...p,price_cents:99800},{...p,offer:{...p.offer,price_cents:100000}}])check(!api.activeOffer(invalid)&&!api.offerBadge(invalid)&&!api.offerPrice(invalid).includes('<del>'),'invalid offer must be absent');
 const labels=new Function('e','formatCEP','window',get(' function shippingLabelAllowed(o){',' const ordersAdmin=')+'return {shippingLabelAllowed,shippingLabelHTML};')(e,v=>String(v).replace(/^(\d{5})(\d{3})$/,'$1-$2'),{NeoOrderQR:{svg:()=>'<svg class="shop-label-qr"></svg>'}});
 const real={id:'12345678-0000-0000-0000-000000000001',environment:'production',status:'paid',cancellation_status:'none',fulfillment:'processing',address:{name:'Cliente & teste',street:'Rua Exemplo',number:'100',complement:'Apto 12',district:'Centro',city:'Cidade',state:'SC',postal_code:'88220000',phone:'47999999999',email:'omit@example.com',document_number:'11111111111'}};
 const sender={seller_name:'NeoPep',business_address:'Rua do remetente, 50 — CEP 88000-000'};
 const label=labels.shippingLabelHTML(real,sender);
 for(const t of ['12345678','Cliente &amp; teste','Rua Exemplo','Apto 12','Centro','Cidade / SC','88220-000','47999999999','Rua do remetente'])check(label.includes(t),'shipping field '+t);
 check(labels.shippingLabelAllowed({...real,fulfillment:'delivered'}),'paid order can be reprinted');
 check(label.includes('shop-label-qr'),'QR printed');
 check(!label.includes('omit@example.com')&&!label.includes('11111111111'),'no exposed CPF/email');
 for(const o of [{...real,environment:'test'},{...real,status:'test_paid'},{...real,status:'paid_review'},{...real,status:'pending'},{...real,cancellation_status:'approved'},{...real,cancellation_status:'requested'}])check(!labels.shippingLabelAllowed(o),'label must be blocked');
 let failed=false;try{labels.shippingLabelHTML({...real,address:{...real.address,postal_code:''}},sender)}catch{failed=true}check(failed,'incomplete address blocked');
 const scope=new Function('orders','orderEnvironment',get(' const operationalOrders=',' function newOrderCount(){')+'return {operationalOrders,orderStats};');
 const all=[real,{...real,id:'test',environment:'test',status:'test_paid'}];check(scope([...all,{...all[1],id:'archived',test_archived:true}],'archived').operationalOrders()[0].id==='archived','archive isolated');
 check(scope(all,'production').orderStats().total===1&&scope(all,'test').operationalOrders()[0].id==='test','test history isolated');
 for(const f of ['catalogue','detail','home']){const l=source.split('\n').find(x=>x.includes('function '+f+'('));check(l.includes('${offerBadge(p)}')&&l.includes('${offerPrice(p)}'),'offer rendered '+f);}
 check(css.includes('size:100mm 150mm')&&css.includes('body:has(.shop-label-dialog[open])'),'print size and isolation');
 for(const q of ["code is null","payment_method='any'","min_quantity<=1","min_subtotal_cents<=p.price_cents","shop_discount_plan(items","shop_product_blocked(p_actor,p.id)","revoke all on function","p_action in (''catalog'',''featured'')"])check(sql.includes(q),'database guard '+q);
 check(!/\b(?:update|delete from|insert into)\s+neo_private\.shop_orders/i.test(sql),'orders must not be modified');
 return {offers:'passed',expiredAndHidden:'passed',label:'passed',invalidLabel:'passed',orderSeparation:'passed',threeViews:'passed',print:'passed',sqlContract:'passed'};
}

test('ofertas, pedidos de teste isolados e etiquetas de pedidos reais pagos',()=>verify(fs.readFileSync('dist/shop.js','utf8'),fs.readFileSync('dist/style.css','utf8'),fs.readFileSync('release/loja-ofertas-etiquetas-20261126/catalog_offer_candidate.sql','utf8')));

test('QR local: gerar matriz e decodificar o identificador integral do pedido',()=>{
 const qrcode=require('../dist/vendor/qr/qrcode.js'),jsQR=require('../dist/vendor/qr/jsQR.js'),w={qrcode,jsQR};
 new Function('window',fs.readFileSync('dist/shop-order-qr.js','utf8'))(w);
 const id='12345678-1234-4abc-8def-1234567890ab',payload=w.NeoOrderQR.encode(id),qr=qrcode(0,'M');qr.addData(payload,'Byte');qr.make();
 const n=qr.getModuleCount(),scale=6,width=(n+8)*scale,rgba=new Uint8ClampedArray(width*width*4);rgba.fill(255);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const k=(((y+4)*scale+a)*width+(x+4)*scale+b)*4;rgba[k]=rgba[k+1]=rgba[k+2]=0;}
 if(jsQR(rgba,width,width)?.data!==payload||w.NeoOrderQR.parse(payload)!==id||w.NeoOrderQR.parse('https://example.com')!==null||!w.NeoOrderQR.svg(id).includes('shop-label-qr'))throw Error('QR roundtrip failed');
});
