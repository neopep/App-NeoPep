const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

// Pure preparation only. Do not enable a mutation before native ACL and revision tests.
export function prepareDraftCreation({channel,title,requestId}){
 const value=typeof title==='string'?title.trim():'';
 if(!['app','whatsapp'].includes(channel)||!value||value.length>120||
    typeof requestId!=='string'||!uuid.test(requestId))throw Error('INVALID_DRAFT');
 return {p_action:channel==='app'?'app_create':'create',p_data:{title:value,request_id:requestId}};
}
