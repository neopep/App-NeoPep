// Read-only settlement report fallback. Does not change global report configuration.
// Do not use Test credentials to retrieve production account statements.
import {cents} from './seller-fee-sync.ts';
const REQUIRED=['EXTERNAL_REFERENCE','USER_ID','PAYMENT_METHOD','SITE','TRANSACTION_TYPE','TRANSACTION_AMOUNT','TRANSACTION_CURRENCY','FEE_AMOUNT','SETTLEMENT_NET_AMOUNT','SETTLEMENT_CURRENCY','REAL_AMOUNT','COUPON_AMOUNT','MKP_FEE_AMOUNT','FINANCING_FEE_AMOUNT','SHIPPING_FEE_AMOUNT','TAXES_AMOUNT','INSTALLMENTS'];
export function parseSettlementCSV(input:string){
 if(typeof input!=='string'||input.length>4000000)throw Error('report_size');
 const text=input.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const push=()=>{row.push(field);field='';closed=false;};
 const line=()=>{push();if(row.some(Boolean))rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c===';'){push();continue;}if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
  if(closed)throw Error('report_csv');
  if(c==='"'){if(field)throw Error('report_csv');quoted=true;continue;}field+=c;
 }
 if(quoted)throw Error('report_csv');if(row.length||field||closed)line();
 const header=rows.shift()||[];if(new Set(header).size!==header.length||!REQUIRED.every(k=>header.includes(k)))throw Error('report_columns');
 if(rows.some(r=>r.length!==header.length))throw Error('report_csv');
 return rows.map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])));
}
const deduction=(v:string)=>v==='0'||v==='0.00'?0:v?.startsWith('-')?cents(v.slice(1)):null;
export function reconcileSettlement(csv:string,orders:any[],collector:string){
 const records=parseSettlementCSV(csv),out:any[]=[];
 for(const o of orders){
  // A reference must identify one full settlement and no conflicting debit/refund row.
  const matches=records.filter(r=>r.EXTERNAL_REFERENCE===o.id);
  if(matches.length!==1)continue;const r=matches[0];
  if(r.USER_ID!==collector||r.SITE!=='MLB'||r.TRANSACTION_TYPE!=='SETTLEMENT'||r.TRANSACTION_CURRENCY!=='BRL'||r.SETTLEMENT_CURRENCY!=='BRL'||cents(r.TRANSACTION_AMOUNT)!==o.total_cents)continue;
  const gross=o.total_cents,net=cents(r.SETTLEMENT_NET_AMOUNT),fee=deduction(r.FEE_AMOUNT),finance=deduction(r.FINANCING_FEE_AMOUNT),n=Number(r.INSTALLMENTS);
  // Marketplace, shipping, withholding, coupons or ambiguous adjustments are not seller processing fees.
  if([r.COUPON_AMOUNT,r.MKP_FEE_AMOUNT,r.SHIPPING_FEE_AMOUNT,r.TAXES_AMOUNT].some(x=>x!=='0'&&x!=='0.00')||net===null||net!==cents(r.REAL_AMOUNT)||fee===null||finance===null||fee<finance||gross-net!==fee||!Number.isInteger(n)||n<1||n>24||!/^[a-z0-9_]{1,40}$/.test(r.PAYMENT_METHOD))continue;
  out.push({order_id:o.id,method:r.PAYMENT_METHOD,installments:n,gross_cents:gross,net_cents:net,processing_cents:fee-finance,financing_cents:finance,buyer_financing_cents:null,source:'settlement_report'});
 }
 return out;
}
export async function readExistingSettlementReports(orders:any[],config:any,fetcher=fetch){
 if(config.mode!=='production'||!orders.length)return [];
 const headers={Authorization:'Bearer '+config.access};
 const base='https://api.mercadopago.com/v1/account/settlement_report';
 const res=await fetcher(base+'/list',{headers,signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error(res.status===429?'rate_limited':'report_list');
 const reports=await res.json();if(!Array.isArray(reports))throw Error('report_list');
 const eligible=reports.filter(r=>String(r.user_id)===config.collector&&typeof r.file_name==='string'&&/^[a-zA-Z0-9_-]{1,180}\.csv$/.test(r.file_name)&&Number.isFinite(Date.parse(r.end_date))&&Date.parse(r.end_date)>Date.now()-90*86400000).sort((a,b)=>Date.parse(b.end_date)-Date.parse(a.end_date)).slice(0,3);
 const collected=new Map<string,any>(),ambiguous=new Set<string>();
 for(const r of eligible){
  const file=await fetcher(base+'/'+encodeURIComponent(r.file_name),{headers,signal:AbortSignal.timeout(12000)});
  if(!file.ok)throw Error(file.status===429?'rate_limited':'report_download');
  if(Number(file.headers.get('content-length')||0)>4000000)throw Error('report_size');
  const reader=file.body?.getReader();if(!reader)throw Error('report_body');
  let size=0,body='';const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4000000)throw Error('report_size');body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
  for(const row of reconcileSettlement(body,orders,config.collector)){
   if(ambiguous.has(row.order_id))continue;
   const previous=collected.get(row.order_id);if(previous&&JSON.stringify(previous)!==JSON.stringify(row)){ambiguous.add(row.order_id);collected.delete(row.order_id);}else collected.set(row.order_id,row);
  }
 }
 return [...collected.values()];
}
