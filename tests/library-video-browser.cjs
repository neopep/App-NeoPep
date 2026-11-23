// Optional browser regression with generated H.264 MP4s. Requires Chromium and ffmpeg.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
const clip=(size)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i',
 `testsrc2=size=${size}:rate=15`,'-t','11','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',
 '-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{maxBuffer:8*1024*1024}).toString('base64');

async function replay(browser,options,name,data,vertical){
 const page=await browser.newPage(options);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<button>Controle oficial simulado</button>'}));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main><button id="launch">Abrir item da Biblioteca</button></main>');
  await page.addStyleTag({path:path.join(dist,'style.css')});
  for(const file of ['media-links.js','library-video.js','library-files.js'])await page.addScriptTag({path:path.join(dist,file)});
  await page.evaluate(data=>{
   const media=Uint8Array.from(atob(data),x=>x.charCodeAt(0));
   const url=URL.createObjectURL(new Blob([media],{type:'video/mp4'}));
   document.querySelector('#launch').addEventListener('click',event=>
    NeoLibraryFiles.open({local_url:url,mime:'video/mp4',name:'Vídeo de teste'},event.currentTarget));
  },data);
  const trigger=page.locator('#launch');
  await trigger.click();
  const shell=page.locator('.library-video-shell'),video=shell.locator('video');
  const play=()=>shell.getByRole('button',{name:'Reproduzir',exact:true});
  const pause=()=>shell.getByRole('button',{name:'Pausar',exact:true});
  const stop=()=>shell.getByRole('button',{name:'Fechar vídeo'});
  const progress=shell.getByRole('slider',{name:'Posição do vídeo'});
  await page.waitForFunction(()=>Number(document.querySelector('video')?.duration)>5);
  assert.equal(await video.evaluate(el=>(el.videoHeight>el.videoWidth)),vertical);
  assert.equal(await video.evaluate(el=>getComputedStyle(el).objectFit),'contain');
  assert.equal(await shell.locator('button[download], a[download], video[controls]').count(),0);
  await play().click();
  await page.mouse.move(4,Math.floor(page.viewportSize().height/2));
  await page.waitForFunction(()=>document.querySelector('.library-video-shell').dataset.controlsHidden==='true',{},{timeout:6000});
  await page.mouse.click(4,Math.floor(page.viewportSize().height/2));
  assert.equal(await video.evaluate(el=>el.paused),false);
  await pause().click();
  await page.waitForTimeout(3150);
  assert.equal(await shell.getAttribute('data-controls-hidden'),null);
  await progress.focus();
  await progress.press('End');await progress.press('ArrowLeft');
  assert.ok(await video.evaluate(el=>el.currentTime>5));
  await progress.press('Home');
  await play().click();
  if(name==='desktop'){
   await shell.getByRole('button',{name:'Tela cheia do sistema'}).click();
   await page.waitForFunction(()=>document.fullscreenElement===document.querySelector('.library-video-shell'));
   await shell.getByRole('button',{name:'Sair da tela cheia'}).click();
   await page.waitForFunction(()=>!document.fullscreenElement);
  }
  if(options.isMobile){
   const {width,height}=page.viewportSize();
   await page.setViewportSize({width:height,height:width});
   assert.equal(await video.evaluate(el=>el.paused),false);
   assert.equal(await video.evaluate(el=>{
    const box=el.getBoundingClientRect(),stage=el.parentElement.getBoundingClientRect();
    return Math.abs(box.width-stage.width)<1&&Math.abs(box.height-stage.height)<1;
   }),true);
  }
  await page.keyboard.press('Tab');
  assert.equal(await shell.getAttribute('data-controls-hidden'),null);
  if(process.env.VIDEO_SCREENSHOTS){
   fs.mkdirSync(process.env.VIDEO_SCREENSHOTS,{recursive:true});
   await page.screenshot({path:path.join(process.env.VIDEO_SCREENSHOTS,name+'.png')});
  }
  await stop().click();
  assert.equal(await video.count(),0);
  assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
  assert.equal(await page.locator('html').getAttribute('class'),'');
  await page.evaluate(()=>{
   const invalid=URL.createObjectURL(new Blob(['invalid'],{type:'video/mp4'}));
   return NeoLibraryFiles.open({local_url:invalid,mime:'video/mp4',name:'Erro'});
  });
  await page.getByRole('status').filter({hasText:'Não foi possível reproduzir'}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await shell.count(),0);
  if(name==='iphone-emulado'){
   await page.evaluate(()=>{
    Element.prototype.requestFullscreen=()=>Promise.reject(Error('Fullscreen indisponível'));
    HTMLVideoElement.prototype.webkitEnterFullscreen=function(){
     this.dataset.nativeFullscreen='called';
     this.dispatchEvent(new Event('webkitbeginfullscreen'));
    };
   });
   await trigger.click();
   await shell.getByRole('button',{name:'Tela cheia do sistema'}).click();
   assert.equal(await shell.locator('video').getAttribute('data-native-fullscreen'),'called');
   await stop().click();
  }
  await page.evaluate(()=>NeoLibraryFiles.open({external_url:'https://youtu.be/dQw4w9WgXcQ',name:'Vídeo incorporado'}));
  const iframe=shell.locator('iframe');
  assert.equal(new URL(await iframe.getAttribute('src')).hostname,'www.youtube-nocookie.com');
  await page.frameLocator('.library-video-dialog iframe').getByRole('button',{name:'Controle oficial simulado'}).waitFor();
  assert.equal(await shell.locator('[data-video-progress]').count(),0);
  await stop().click();
  assert.equal(await iframe.count(),0);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const horizontal=clip('480x270'),vertical=clip('270x480');
  await replay(browser,{viewport:{width:1280,height:720}},'desktop',horizontal,false);
  await replay(browser,devices['iPhone 13'],'iphone-emulado',vertical,true);
  await replay(browser,devices['Pixel 7'],'android-emulado',horizontal,false);
  console.log('MP4 real e iframe simulado verificados em Chromium desktop e emulações iPhone e Android.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
