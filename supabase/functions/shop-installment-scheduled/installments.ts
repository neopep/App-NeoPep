// Read-only quote; never return card details, credentials or inferred seller fees.
export function normalizeInstallments(value:any){
 if(!Array.isArray(value))throw Error('installments_unavailable');
 const rows:any[]=[];
 for(const method of value.slice(0,20)){
  if(!method||!Array.isArray(method.payer_costs))continue;
  for(const item of method.payer_costs.slice(0,24)){
   const count=Number(item.installments),rate=Number(item.installment_rate),part=Number(item.installment_amount),total=Number(item.total_amount);
   if(!Number.isInteger(count)||count<1||count>24||item.installment_rate==null||!Number.isFinite(rate)||rate<0||rate>1000||!Number.isFinite(part)||part<=0||!Number.isFinite(total)||total<=0)continue;
   rows.push({method:String(method.payment_method_id||'').slice(0,30),issuer:String(method.issuer?.name||'').slice(0,80),installments:count,buyer_rate:rate,installment_cents:Math.round(part*100),total_cents:Math.round(total*100)});
  }
 }
 return rows.sort((a,b)=>a.installments-b.installments);
}
