// Only Teste with explicit flag may request drafts. No silent upgrade.
export const READ_SCOPE='campaigns:read';
export const DRAFT_SCOPE='campaigns:drafts';
export function allowedScope(value,enableDrafts=false){
 if(typeof value!=='string')return null;
 const parts=value.split(' ');
 if(parts.length===1&&parts[0]===READ_SCOPE)return READ_SCOPE;
 if(enableDrafts&&parts.length===2&&new Set(parts).size===2&&parts.includes(READ_SCOPE)&&parts.includes(DRAFT_SCOPE))return READ_SCOPE+' '+DRAFT_SCOPE;
 return null;
}
export function connectionScope(scopes,enableDrafts=false){
 if(!Array.isArray(scopes))return null;
 return allowedScope(scopes.join(' '),enableDrafts);
}
