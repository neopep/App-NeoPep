const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('dist/shop.js','utf8'),fn=new Function(s.slice(s.indexOf(' function installmentRows('),s.indexOf(' let installmentState='))+'return installmentRows')();
const evidence=JSON.parse(fs.readFileSync('release/pendencias-campanhas-20261127/installments-probe-evidence.json','utf8'));
const now=Date.parse('2026-11-28T00:00:00Z');
const quotes=[10000,99700].map(amount_cents=>({amount_cents,expires_at:new Date(now+60000).toISOString(),rows:evidence.queries.filter(q=>q.amount_cents===amount_cents&&q.http===200).flatMap(q=>q.options.map(o=>({...o,method:q.method})))}));
test('parcelamento exato preserva valor retornado pelo provedor',()=>{const r=fn(99700,quotes,now);assert.equal(r.estimated,false);const v=r.rows.find(x=>x.method==='visa'&&x.installments===12);assert.equal(v.total_cents,121744);assert.equal(v.installment_cents,10145);});
test('não interpola, extrapola nem reutiliza cotação vencida',()=>{assert.deepEqual(fn(50000,quotes,now),{rows:[],estimated:false});assert.equal(fn(99999,quotes,now).rows.length,0);assert.equal(fn(99700,quotes,now+120000).rows.length,0);});
test('sem cotação atual não anuncia números',()=>{assert.deepEqual(fn(99700,[],now),{rows:[],estimated:false});assert.match(s,/Consulte o parcelamento no Mercado Pago/);assert.match(s,/Confirme as condições no Mercado Pago/);});
test('worker usa bandeiras verificadas e limita chamadas',()=>{const w=fs.readFileSync('supabase/functions/shop-integrations/installment-sync.ts','utf8');assert.match(w,/claim.amounts.slice\(0,6\)/);assert.match(w,/\['visa','master'\]/);assert.match(w,/set\('payment_method_id',method\)/);assert.match(w,/Retry-After/);});

test('cron de parcelas isolado ao projeto e desativado por padrão',()=>{const sql=fs.readFileSync('release/pendencias-campanhas-20261127/shop-installments-cron.candidate.sql','utf8');assert.ok(sql.includes("cfg.environment is distinct from 'test'"));assert.ok(sql.includes("coalesce(endpoint,'') <> 'https://qnuluspqfazdppciermw.supabase.co/functions/v1/shop-integrations'"));assert.ok(!sql.includes('cpslafpzjtbpmoxxysaa'));assert.ok(sql.includes('active:=false'));assert.ok(sql.includes("mod((h+20),cfg.frequency_hours)<>0"));});

test('operações financeiras exigem administrador efetivo e não moderador',()=>{const edge=fs.readFileSync('supabase/functions/shop-integrations/index.ts','utf8'),sql=fs.readFileSync('release/pendencias-campanhas-20261127/shop-financial-admin.candidate.sql','utf8');assert.ok(edge.includes("admin.rpc('neo_shop_financial_admin_v1'"));assert.ok(edge.includes('financialAdmin.data!==true'));assert.ok(!edge.includes("admin.rpc('neo_integration_admin'"));assert.ok(sql.includes('neo_private.admin_members'));assert.ok(!sql.includes('community_moderators'));assert.ok(sql.includes('to service_role'));assert.ok(edge.includes("permitted=origin==='https://teste.app.neopep.com.br'"));assert.ok(edge.includes("active.data!=='test'"));assert.ok(!edge.includes("['test','production'].includes(environment)"));});

test('vitrine destaca somente parcelas e ordena número de parcelas crescente sem divulgar taxas',()=>{
 const c={money:n=>(n/100).toFixed(2)},e=String;
 const opts=[{method:'visa',installments:2,installment_cents:5500,total_cents:11000,buyer_rate:10},{method:'master',installments:6,installment_cents:2000,total_cents:12000,buyer_rate:20},{method:'visa',installments:6,installment_cents:2100,total_cents:12600,buyer_rate:26},{method:'visa',installments:3,installment_cents:3800,total_cents:11400,buyer_rate:14}];
 const render=new Function('C','e','data','installmentState','installmentRows',s.slice(s.indexOf(' function installmentDisplay('),s.indexOf('\n }',s.indexOf(' function installmentDisplay('))+3)+';return installmentDisplay')(c,e,{}, {enabled:true,quotes:[]},()=>({rows:opts}));
 const card=render(10000),detail=render(10000,true);
 assert.match(card,/Até 6x a partir de 20.00/);
 assert.doesNotMatch(card,/Simulação|Visa|Mastercard|Confirme|%/);
 assert.doesNotMatch(detail,/Acréscimo|Visa|Mastercard|<th>Total|%/);
 assert.match(detail,/<th>Parcelas<\/th><th>Valor da parcela<\/th>/);
 assert.ok(detail.indexOf('2x</td>')<detail.indexOf('3x</td>'));
 assert.ok(detail.indexOf('3x</td>')<detail.indexOf('6x</td>'));
 assert.equal((detail.match(/6x<\/td>/g)||[]).length,1);
 assert.match(detail,/Confirme as condições no Mercado Pago/);
});
