const verifierPattern=/^[A-Za-z0-9._~-]{43,128}$/;

export async function challengeS256(verifier){
 if(typeof verifier!=='string'||!verifierPattern.test(verifier))throw Error('INVALID_VERIFIER');
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 return btoa(String.fromCharCode(...hash)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}

export async function validateCodeBinding(binding,exchange,now=Date.now()){
 if(!binding||binding.usedAt!=null||!Number.isFinite(binding.expiresAt)||binding.expiresAt<=now||
   binding.method!=='S256'||binding.clientId!==exchange.clientId||binding.redirectUri!==exchange.redirectUri||
   binding.resource!==exchange.resource)return false;
 try{return await challengeS256(exchange.verifier)===binding.challenge;}catch{return false;}
}
