// Candidate: checkout configuration is an immutable server-side order snapshot.
// Do not activate until both buyer and seller policies are confirmed with the actual hosted checkout.
export function paymentMethodForPolicy(policy:any){
 if(!policy||policy.mode==='default')return undefined;
 if(policy.mode==='buyer'&&policy.free===1)throw Error('buyer_policy_not_homologated');
 if(policy.mode==='seller'&&Number.isInteger(policy.free)&&policy.free>=2&&policy.free<=12)return {max_installments:policy.free,installments:{interest_free:{type:'range',values:[2,policy.free]}}};
 throw Error('installment_policy_invalid');
}
export function providerPolicyMatches(policy:any,provider:any){
 if(!policy||policy.mode==='default')return true;
 const p=provider?.config?.payment_method;
 if(policy.mode==='buyer')return false;
 if(policy.mode==='seller'){
  const range=p?.installments?.interest_free;
  return p?.installments_cost!=='buyer'&&p?.max_installments===policy.free&&range?.type==='range'&&Array.isArray(range.values)&&range.values.length===2&&range.values[0]===2&&range.values[1]===policy.free;
 }
 return false;
}
