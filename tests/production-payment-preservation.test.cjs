const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const shop=fs.readFileSync('dist/shop.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8');
test('release de Produção preserva o cliente financeiro ativo e bloqueia novas operações',()=>{
 const preserved=cloud.replace(/ \/\/ BEGIN isolated administrative quote adapter\n[\s\S]*? \/\/ END isolated administrative quote adapter\n/,'');
 const blob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(preserved)+'\0').update(preserved).digest('hex');
 assert.equal(blob,'d8c51590b6b801268e1ceb342130943efae0162b');
 assert.match(shop,/const newFinancialFeatures=false;/);
 assert.doesNotMatch(preserved,/neo_shop_customer_notices_v1|neo_shop_installments_v1|neo_shop_product_installments_v1|renew:true/);
 for(const name of ['readInstallments','readProductInstallments','readShopNoticeSettings','readShopNoticeList','readInstallmentAdmin','changeInstallmentAdmin','mountProductInstallment','productPaymentHint','cartPaymentHint','productInstallmentEditor','shopNoticePanel','shopCustomerNoticePanel','installmentPanel','installmentSyncPanel']){
  const i=shop.indexOf('function '+name+'(');assert.ok(i>=0,name);assert.ok(shop.slice(i,i+180).includes('if(!newFinancialFeatures)return'),name);
 }
 assert.match(shop,/if\(renew&&!newFinancialFeatures\)throw Error/);
 assert.match(shop,/window\.NeoCloud\.shopPayment\(id\)/);
 assert.match(shop,/newFinancialFeatures&&manage&&o\.status==='awaiting_payment'/);
 assert.match(shop,/newFinancialFeatures&&!manage&&o\.status==='expired'/);
});

test('isolated admin adapter has no payment mutation',()=>{const a=cloud.slice(cloud.indexOf('// BEGIN isolated administrative quote adapter'),cloud.indexOf('// END isolated administrative quote adapter'));assert.match(a,/shop-installment-admin/);assert.match(a,/payload.environment!=='production'/);assert.doesNotMatch(a,/mercadopago-create|mercadopago-webhook|shopPaymentIntegration/);});
