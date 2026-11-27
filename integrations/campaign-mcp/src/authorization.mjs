import {jwtVerify,errors} from 'jose';

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function createConnectionAuthorizer({key,issuer,resource,environment,findConnection,isCampaignAdmin}){
 if(!key||new URL(issuer).protocol!=='https:'||new URL(resource).protocol!=='https:'||
  !['test','production'].includes(environment)||typeof findConnection!=='function'||typeof isCampaignAdmin!=='function')
  throw Error('Incomplete authorization configuration');
 return async token=>{
  let claims;
  try{
   ({payload:claims}=await jwtVerify(token,key,{issuer,audience:resource,algorithms:['ES256','RS256'],
    requiredClaims:['sub','exp','iat','client_id','connection_id','scope'],maxTokenAge:'15m'}));
  }catch(err){
   if(err instanceof errors.JWKSTimeout)throw err;
   if(err instanceof errors.JOSEError)return null;
   throw err;
  }
  if(!uuid.test(claims.connection_id)||!uuid.test(claims.sub)||typeof claims.client_id!=='string'||
   typeof claims.scope!=='string')return null;
  const connection=await findConnection(claims.connection_id);
  if(!connection||connection.revokedAt||connection.environment!==environment||connection.resource!==resource||
   connection.ownerId!==claims.sub||connection.clientId!==claims.client_id||
   !Number.isFinite(connection.expiresAt)||connection.expiresAt<=Date.now()||!Array.isArray(connection.scopes))
   return null;
  return {id:claims.connection_id,ownerId:claims.sub,environment,
   expiresAt:Math.min(connection.expiresAt,claims.exp*1000),
   scopes:claims.scope.split(' ').filter(scope=>connection.scopes.includes(scope)),
   campaignAdmin:await isCampaignAdmin(claims.sub,environment,claims.connection_id)};
 };
}
