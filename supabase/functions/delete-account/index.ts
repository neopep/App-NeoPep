// Segredos somente no ambiente da Edge Function. Nunca no navegador.
import {createClient} from 'npm:@supabase/supabase-js@2.80.0';
Deno.serve(async req=>{
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||Deno.env.get('ALLOWED_ORIGIN')||'').split(',').map(value=>value.trim()).filter(Boolean),origin=req.headers.get('Origin')||'',permitted=!!origin&&allowed.includes(origin);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store',...(permitted?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}:{})};
 const out=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers});
 if(!permitted)return out(403,'Origem não autorizada.');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,'Método inválido.');
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
 if(!token)return out(401,'Autenticação obrigatória.');
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)return out(401,'Sessão inválida.');
 const user=data.user;
 let verifier:ReturnType<typeof createClient>|null=null;
 try{
 const raw=await req.text();if(raw.length>8192)return out(413,'Solicitação muito grande.');let body;try{body=JSON.parse(raw)}catch{return out(400,'Solicitação inválida.');}
 if(typeof body?.password!=='string'||!body.password.length||body.password.length>128)return out(400,'Informe sua senha de acesso para confirmar a exclusão.');
 if(!user.email)return out(403,'Não foi possível confirmar o acesso desta conta por senha.');
 const publicKey=Deno.env.get('SUPABASE_ANON_KEY');if(!publicKey)return out(503,'Verificação de acesso temporariamente indisponível.');
 verifier=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const verified=await verifier.auth.signInWithPassword({email:user.email,password:body.password,options:{captchaToken:typeof body.captchaToken==='string'?body.captchaToken:undefined}});
 body.password='';
 if(verified.error){const code=String(verified.error.code||'');if(/captcha|timeout-or-duplicate/i.test(code+' '+String(verified.error.message||'')))return out(400,'A verificação de segurança expirou. Faça a nova verificação e tente novamente.');if(verified.error.status===429)return out(429,'Muitas tentativas. Aguarde um pouco e tente novamente.');return out(403,'Senha incorreta ou acesso não confirmado. Confira sua senha e tente novamente.');}
 if(!verified.data.session||verified.data.user?.id!==user.id)return out(403,'Não foi possível confirmar a identidade desta conta.');
 const check=await admin.rpc('neo_shop_deletion_check',{p_user:user.id});if(check.error||typeof check.data?.allowed!=='boolean')return out(503,'Não foi possível conferir as condições de exclusão. Tente novamente mais tarde.');if(check.data.allowed===false)return out(409,'Conclua o atendimento dos pedidos em aberto antes de excluir a conta.');
 const support=await admin.rpc('neo_support_deletion_media',{p_user:user.id});if(support.error||!Array.isArray(support.data))return out(503,'Não foi possível conferir os arquivos da conta. Tente novamente mais tarde.');
 if(!support.error&&Array.isArray(support.data))for(let offset=0;offset<support.data.length;offset+=100){const removedMedia=await admin.storage.from('neo-support').remove(support.data.slice(offset,offset+100));if(removedMedia.error)throw removedMedia.error;}
 // Remover todos os objetos antes da conta: auth.users não exclui Storage automaticamente.
 for(const bucket of ['neo-private','neo-community','neo-community-files','neo-support'])for(;;){const files=await admin.storage.from(bucket).list(user.id,{limit:100});if(files.error)throw files.error;if(!files.data.length)break;const removal=await admin.storage.from(bucket).remove(files.data.map(f=>user.id+'/'+f.name));if(removal.error)throw removal.error;}
 const removed=await admin.auth.admin.deleteUser(user.id);if(removed.error)throw removed.error;
 return new Response(JSON.stringify({deleted:true}),{status:200,headers});
 }catch{return out(500,'Exclusão não concluída. Tente novamente. A conta não é confirmada como excluída até terminar.');}finally{if(verifier)try{await verifier.auth.signOut({scope:'local'});}catch{}}
});
