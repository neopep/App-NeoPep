import {decryptKey} from './agent-providers.ts';
export type ShopPaymentConfig={access:string;secret:string;collector:string;mode:'test'|'production'};
export async function shopPaymentConfig(admin:any,webhook=false,environment?:'test'|'production'):Promise<ShopPaymentConfig>{
 const envAccess=Deno.env.get('MP_ACCESS_TOKEN')||'',envSecret=Deno.env.get('MP_WEBHOOK_SECRET')||'',envCollector=Deno.env.get('MP_COLLECTOR_ID')||'',envMode=(Deno.env.get('MP_MODE')||'test') as 'test'|'production';
 const row=environment?await admin.rpc('neo_shop_payment_credentials',{p_environment:environment}):await admin.rpc('neo_shop_payment_credentials');
 if(!row.error&&row.data?.encrypted_access){const access=await decryptKey(row.data.encrypted_access,'mercadopago:access'),secret=webhook?await decryptKey(row.data.encrypted_webhook,'mercadopago:webhook'):'';if(!row.data.collector_id)throw Error('configuration_pending');return {access,secret,collector:String(row.data.collector_id),mode:row.data.environment}}
 if(!envAccess||!envCollector||(webhook&&!envSecret))throw Error('configuration_pending');return {access:envAccess,secret:envSecret,collector:envCollector,mode:envMode};
}
