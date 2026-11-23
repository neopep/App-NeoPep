// Optional visual regression. Requires Playwright and Chromium.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,devices}=require('playwright');

const dist=path.resolve(__dirname,'../dist');
const script=fs.readFileSync(path.join(dist,'app.js'),'utf8');
const crop=script.slice(script.indexOf('let avatarCrop='),script.indexOf('function sanitizePhoto('));

async function verify(browser,options){
 const page=await browser.newPage(options);
 try{
  await page.setContent(`<header><div class="avatar" id="avatar"><img alt=""></div></header>
  <main class="profile-head"><div class="avatar"><img alt=""></div><p>Um nome extenso para testar o espaço do cabeçalho de Perfil.</p></main>
  <div class="community-avatar"><img alt=""></div><div class="community-avatar community-avatar-small"><img alt=""></div>
  <div class="support-avatar"><img alt=""></div>
  <div class="avatar-crop-preview"><canvas width="440" height="440"></canvas></div>`);
  await page.addStyleTag({path:path.join(dist,'style.css')});
  await page.addScriptTag({content:crop});
  for(const [width,height] of [[360,700],[700,360],[540,540]]){
   const result=await page.evaluate(async ([width,height])=>{
    const original=document.createElement('canvas');
    original.width=width;original.height=height;
    const ctx=original.getContext('2d'),gradient=ctx.createLinearGradient(0,0,width,height);
    gradient.addColorStop(0,'#039141');gradient.addColorStop(1,'#e56216');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    const file=await new Promise(resolve=>original.toBlob(resolve,'image/png'));
    const decode=async blob=>{
     const image=new Image(),url=URL.createObjectURL(blob);
     try{image.src=url;await image.decode();return image;}
     finally{URL.revokeObjectURL(url);}
    };
    const legacyURL=original.toDataURL();
    await Promise.all([...document.images].map(async image=>{image.src=legacyURL;await image.decode();}));
    const legacy=[...document.images].map(image=>getComputedStyle(image).objectFit);
    avatarCrop={zoom:1.8,x:83,y:17};
    avatarCropImage=await decode(file);
    paintAvatarCrop();
    const preview=document.querySelector('.avatar-crop-preview canvas');
    const encoded=await encodePhoto(file,{crop:true});
    const saved=await decode(encoded);
    const resized=document.createElement('canvas');
    resized.width=resized.height=440;
    resized.getContext('2d').drawImage(saved,0,0,440,440);
    const samples=[[40,220],[220,40],[380,250],[220,390],[220,220]];
    const differences=samples.map(([x,y])=>{
     const a=preview.getContext('2d').getImageData(x,y,1,1).data;
     const b=resized.getContext('2d').getImageData(x,y,1,1).data;
     return Math.max(...a.map((value,index)=>Math.abs(value-b[index])));
    });
    const storedURL=resized.toDataURL();
    await Promise.all([...document.images].map(async image=>{image.src=storedURL;await image.decode();}));
    const shapes=[...document.images].map(img=>{
     const box=img.parentElement.getBoundingClientRect(),image=img.getBoundingClientRect();
     return [box.width,box.height,getComputedStyle(img.parentElement).borderRadius,
      getComputedStyle(img).objectFit,image.width,image.height];
    });
    return {legacy,shapes,differences,side:[saved.naturalWidth,saved.naturalHeight]};
   },[width,height]);
   assert.deepEqual(result.side,Array(2).fill(Math.round(Math.min(width,height)/1.8)));
   assert.ok(result.differences.every(value=>value<=5));
   assert.deepEqual(result.legacy,Array(5).fill('cover'));
   for(const [w,h,radius,fit,iw,ih] of result.shapes){
    assert.equal(w,h);
    assert.equal(radius,'50%');
    assert.equal(fit,'cover');
    assert.equal(iw,ih);
    assert.ok(iw>w-3);
   }
  }
 }finally{await page.close();}
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  await verify(browser,devices['iPhone 13']);
  await verify(browser,{viewport:{width:1440,height:900}});
  console.log('Avatar verificado em Chromium com perfil iPhone 13 e desktop, em três proporções.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
