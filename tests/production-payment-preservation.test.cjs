const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const shop=fs.readFileSync('dist/shop.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8');
test('release de Produção preserva o cliente financeiro ativo e bloqueia novas operações',()=>{
 const preserved=cloud.replace(/ \/\/ BEGIN isolated (?:administrative quote|customer quote|seller tariff) adapter\n[\s\S]*? \/\/ END isolated (?:administrative quote|customer quote|seller tariff) adapter\n/g,'');
 const original=preserved
  .replace(/ *\/\/ BEGIN local commercial account (configuration|adapter)\n[\s\S]*? *\/\/ END local commercial account \1\n/g,'')
  .replace('if(commercialPreview)rememberCommercialRoute(current,target);','')
  .replace('const configured=(commercialPreview||','const configured=')
  .replace(".test(config.supabaseUrl||''))&&C.isPublicSupabaseKey", ".test(config.supabaseUrl||'')&&C.isPublicSupabaseKey")
  .replace('const api={configured,commercialPreview,','const api={configured,')
  .replace('\n  if(commercialPreview)commercialLoadedVersion=version;\n  return s;', 'return s;');
 assert.match(preserved,/commercialPreview=config\.commercialPreview===true&&loopback\.test\(location\.origin\)&&loopback\.test\(config\.supabaseUrl\)/);
 const blob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(original)+'\0').update(original).digest('hex');
 assert.equal(blob,'d8c51590b6b801268e1ceb342130943efae0162b');
 assert.match(shop,/const newFinancialFeatures=false;/);
 assert.doesNotMatch(preserved,/neo_shop_customer_notices_v1|neo_shop_installments_v1|neo_shop_product_installments_v1|renew:true/);
 for(const name of ['readProductInstallments','readShopNoticeSettings','readShopNoticeList','readInstallmentAdmin','changeInstallmentAdmin','mountProductInstallment','productPaymentHint','cartPaymentHint','productInstallmentEditor','shopNoticePanel','shopCustomerNoticePanel','installmentPanel','installmentSyncPanel']){
  const i=shop.indexOf('function '+name+'(');assert.ok(i>=0,name);assert.ok(shop.slice(i,i+180).includes('if(!newFinancialFeatures)return'),name);
 }
 assert.match(shop,/if\(renew&&!newFinancialFeatures\)throw Error/);
 assert.match(shop,/window\.NeoCloud\.shopPayment\(id\)/);
 assert.match(shop,/newFinancialFeatures&&manage&&o\.status==='awaiting_payment'/);
 assert.match(shop,/newFinancialFeatures&&!manage&&o\.status==='expired'/);
});

test('isolated admin adapter has no payment mutation',()=>{const a=cloud.slice(cloud.indexOf('// BEGIN isolated administrative quote adapter'),cloud.indexOf('// END isolated administrative quote adapter'));assert.match(a,/shop-installment-admin/);assert.match(a,/payload.environment!=='production'/);assert.doesNotMatch(a,/mercadopago-create|mercadopago-webhook|shopPaymentIntegration/);});

test('customer quote path is read-only and keeps other financial gates closed',()=>{assert.match(cloud,/p_action:'read',p_payload:payload/);assert.match(shop,/if\(!newFinancialFeatures\)return installmentDisplay/);assert.match(shop,/shop-installment-highlight/);});
