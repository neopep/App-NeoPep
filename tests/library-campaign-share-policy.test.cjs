const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync('release/pacote-campanhas-20261126-02/library_campaign_share_candidate.sql','utf8');
test('autorizações de campanha isoladas do download de membros, com propriedade e preview-only',async()=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',material='00000000-0000-4000-8000-000000000003',video=owner+'/00000000-0000-4000-8000-000000000004.mp4',pdf=owner+'/00000000-0000-4000-8000-000000000005.pdf';
 try{
 await db.exec("create role anon; create role authenticated; create schema auth; create schema neo_private; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$; create function public.neo_admin_access() returns boolean language sql stable as $$select current_setting('fixture.admin',true)='1'$$; create function neo_private.campaign_admin_allowed() returns boolean language sql stable as $$select public.neo_admin_access()$$; create function public.neo_library_media_access(p_path text,p_upload boolean) returns boolean language sql stable as $$select auth.uid() is not null$$;");
 await db.exec("create table neo_private.library_uploads(path text primary key,user_id uuid not null,material_id uuid,name text,mime text,size int,allow_download boolean); create table neo_private.library_video_previews(source_path text,state text); create function neo_private.library_video_preview_enqueue(p_owner uuid,p_path text) returns void language sql as $$insert into neo_private.library_video_previews values(p_path,'pending')$$; create function neo_private.library_video_preview_current(j neo_private.library_video_previews) returns boolean language sql stable as $$select exists(select 1 from neo_private.library_uploads f where f.path=j.source_path and f.allow_download is true)$$;");
 await db.query("insert into neo_private.library_uploads values ($1,$2,$3,'Vídeo','video/mp4',1000,false),($4,$2,$3,'Documento','application/pdf',500,false)",[video,owner,material,pdf]);
 await db.exec(sql);
 const as=async (id,admin=true)=>{await db.exec('reset role');await db.query("select set_config('fixture.actor',$1,false),set_config('fixture.admin',$2,false)",[id,admin?'1':'0']);await db.exec('set role authenticated');};
 const rpc=async (action,path,extra={})=>(await db.query('select public.neo_library_campaign_share($1,$2::jsonb) as result',[action,JSON.stringify({material_id:material,path,...extra})])).rows[0].result;
 const set=(path,mode,expected_mode)=>rpc('set',path,{mode,expected_mode,confirmed:true});
 await as(owner);
 let r=await rpc('get',video);assert.equal(r.mode,'inherit');assert.equal(r.preview,false);assert.equal(r.original,false);
 await assert.rejects(rpc('authorize',video,{mode:'original'}),/campaign_library_share_not_allowed/);
 r=await set(video,'preview','inherit');assert.equal(r.preview,true);assert.equal(r.original,false);assert.equal(r.member_download,false);
 assert.equal((await rpc('authorize',video,{mode:'preview'})).preview,true);
 await assert.rejects(rpc('authorize',video,{mode:'original'}),/campaign_library_share_not_allowed/);
 await as(other);
 assert.equal((await rpc('get',video)).can_manage,false);
 await assert.rejects(set(video,'original','preview'),/campaign_library_owner_required/);
 await assert.rejects(rpc('authorize',video,{mode:'preview'}),/campaign_library_share_not_allowed/);
 await as(owner);
 await assert.rejects(set(video,'original','inherit'),/campaign_library_permission_changed/);
 r=await set(video,'original','preview');assert.equal(r.original,true);assert.equal(r.member_download,false);
 r=await set(video,'cover','original');assert.equal(r.original,false);assert.equal(r.preview,false);
 await assert.rejects(set(pdf,'preview','inherit'),/campaign_library_format_or_size/);
 r=await set(pdf,'original','inherit');assert.equal(r.original,true);assert.equal(r.member_download,false);
 await as(owner,false);
 await assert.rejects(rpc('get',pdf),/campaign_library_admin_required/);
 await db.exec('reset role');
 const acl=(await db.query("select has_function_privilege('anon','public.neo_library_campaign_share(text,jsonb)','execute') as anon")).rows[0];assert.equal(acl.anon,false);
 assert.equal((await db.query('select count(*)::int as n from neo_private.library_uploads where allow_download')).rows[0].n,0);
 }finally{await db.close();}
});
test('editor mantém a revalidação e autorização do original antes da URL assinada',()=>{
 const editor=fs.readFileSync('dist/admin/campaign-editor.js','utf8'),cloud=fs.readFileSync('src/cloud.js','utf8');
 assert.match(editor,/library_permission_apply/);
 assert.match(editor,/expected_mode:s\.policy\.mode,confirmed:true/);
 assert.match(editor,/await cloud\.libraryCampaignShare\('authorize'/);
 assert.match(editor,/cloud\.libraryCampaignOriginalURL\(s\.row\.id,latest\)/);
 assert.match(cloud,/permission\?\.original!==true/);
 assert.match(cloud,/action==='get'&&r\.error\?\.code==='PGRST202'/);
 assert.doesNotMatch(sql,/set allow_download\s*=/i);
});
