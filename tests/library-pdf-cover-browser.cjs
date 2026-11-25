// Run with Chromium and Playwright after npm run build.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
function samplePDF(){
 const stream='0 0 1 rg 0 0 200 400 re f\n';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 400] /Resources << >> /Contents 4 0 R >>',
  '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'
 ];
 let pdf='%PDF-1.4\n';
 const offsets=objects.map((value,i)=>{
  const offset=pdf.length;
  pdf+=(i+1)+' 0 obj\n'+value+'\nendobj\n';
  return offset;
 });
 return pdf+'xref\n0 5\n0000000000 65535 f \n'+offsets.map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+
  'trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n'+pdf.length+'\n%%EOF\n';
}
async function scenario(browser,options){
 const page=await browser.newPage(options);
 try{
  let reads=0;
  await page.route('https://neo.test/**',route=>{
   const {pathname}=new URL(route.request().url());
   if(pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/style.css"><main></main>
    <script src="/pdf-reader.js"></script><script src="/library-files.js"></script><script src="/library.js"></script>`});
   if(pathname==='/private.pdf'){reads++;return route.fulfill({contentType:'application/pdf',body:samplePDF()});}
   if(pathname==='/offline.pdf')return route.abort('failed');
   if(pathname==='/denied.pdf')return route.fulfill({status:403,body:'Denied'});
   const file=path.join(dist,pathname);
   return route.fulfill({path:file,contentType:pathname.endsWith('.mjs')?'text/javascript':undefined});
  });
  await page.goto('https://neo.test/');
  await page.evaluate(async()=>{
   const materials=[{id:'guide',title:'Guia Definitivo dos Peptídeos'},{id:'locked',title:'PDF indisponível'},{id:'offline',title:'Falha de rede'},{id:'empty',title:'Sem arquivo'}];
   window.NeoCloud={
    library:async(action,{id}={})=>action==='featured'?{materials}:id==='empty'?{material:{attachments:[]}}:{material:{attachments:[
     {path:'decoration.png',mime:'image/png'},{path:id==='guide'?'private.pdf':id==='offline'?'offline.pdf':'denied.pdf',mime:'application/pdf'}
    ]}},
    libraryMediaURL:async(file,download)=>{
     if(download||file.mime!=='application/pdf')throw Error('O PDF deve ser escolhido para visualização');
     return 'https://neo.test/'+file.path+'?token=fixture';
    }
   };
   document.querySelector('main').innerHTML=NeoLibrary.home();
   await NeoLibrary.loadHome({cloud:true,user:{id:'owner'}});
  });
  const cover=page.locator('.library-home-symbol');
  const initial=await cover.boundingBox();
  await expectCover();
  async function expectCover(){
   const image=cover.locator('img');
   await image.waitFor();
   await expectDecoded();
   async function expectDecoded(){
    await page.waitForFunction(()=>document.querySelector('.library-home-symbol img')?.naturalWidth>0);
   }
   const info=await image.evaluate(el=>[el.naturalWidth,el.naturalHeight,getComputedStyle(el).objectFit,el.getAttribute('src').startsWith('data:image/')]);
   assert.deepEqual(info,[128,256,'contain',true]);
  }
  const settled=await cover.boundingBox();
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(settled[key]-initial[key])<1);
  assert.equal(await cover.locator('.library-document-icon').count(),0);
  await page.locator('[data-library-step="1"]').click();
  await page.getByRole('heading',{name:'PDF indisponível'}).waitFor();
  await cover.locator('svg').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.library-home-cover-loading'));
  assert.equal(await cover.locator('img').count(),0);
  for(const title of ['Falha de rede','Sem arquivo']){
   await page.locator('[data-library-step="1"]').click();
   await page.getByRole('heading',{name:title}).waitFor();
   await page.waitForFunction(()=>!document.querySelector('.library-home-cover-loading'));
   assert.equal(await cover.locator('img').count(),0);
  }
  await page.locator('[data-library-step="1"]').click();
  await expectCover();
  assert.equal(reads,1,'navegação deve reutilizar a miniatura');
  assert.equal(await page.locator('[data-material=guide]').getAttribute('data-community-section'),'library');
  await page.evaluate(()=>NeoLibraryFiles.open({view_url:'https://neo.test/private.pdf?token=fixture',mime:'application/pdf',name:'Guia'}));
  await page.locator('dialog[open] canvas').first().waitFor();
  assert.ok(reads>1,'leitor deve abrir o PDF autorizado por seu próprio fluxo');
  await page.evaluate(()=>NeoLibrary.session({id:'other'}));
  assert.equal(await cover.locator('img').count(),0);
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const options of [{viewport:{width:1280,height:900}},devices['iPhone 13'],devices['Pixel 7']])await scenario(browser,options);
  console.log('Miniatura e leitor passaram em Chromium desktop e emulação iPhone 13 e Pixel 7.');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
