const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('supabase/functions/shop-integrations/seller-observations.js','utf8');
const {parseReleaseCsv}=new Function(source.replace(/export /g,'')+'return {parseReleaseCsv}')();
const header='SOURCE_ID,EXTERNAL_REFERENCE,RECORD_TYPE,DESCRIPTION,GROSS_AMOUNT,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,MP_FEE_AMOUNT,FINANCING_FEE_AMOUNT,INSTALLMENTS,PAYMENT_METHOD';
const order={payment_id:'123',order_id:'abc',gross_cents:10000,net_cents:9201,method:'visa',installments:3};
const row='123,abc,release,payment,100.00,92.01,0.00,-3.99,-4.00,3,visa';
test('release report separates explicit processing and financing deductions',()=>assert.deepEqual(parseReleaseCsv(header+'\r\n'+row,[order]),[{payment_id:'123',order_id:'abc',mp_fee_cents:399,financing_fee_cents:400}]));
test('unknown fields, wrong amounts, missing fees, duplicate and adjustment records fail closed',()=>{for(const r of [row.replace('92.01','91.00'),row.replace('-3.99',''),row.replace('-3.99','3.99'),row.replace('abc','other'),row+'\n'+row,row+'\n'+row.replace('payment,','refund,')])assert.deepEqual(parseReleaseCsv(header+'\n'+r,[order]),[]);assert.throws(()=>parseReleaseCsv('DATE,SOURCE_ID\n2026-01-01,123',[order]),/report_columns/);});
