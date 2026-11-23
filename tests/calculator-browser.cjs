// Optional visual regression. Requires Playwright and Chromium.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,devices}=require('playwright');
const dist=path.resolve(__dirname,'../dist');
const app=fs.readFileSync(path.join(dist,'app.js'),'utf8');
const navigation=fs.readFileSync(path.join(dist,'index.html'),'utf8').match(/<nav hidden class="bottom-nav"[^>]*>[\s\S]*?<\/nav>/)[0].replace('<nav hidden','<nav');
const calculator=app.slice(app.indexOf('const calcFields='),app.indexOf('function reports()'));

async function verify(browser,options,label,theme){
 const page=await browser.newPage(options);
 try{
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="calc"></main>'+navigation);
  await page.addStyleTag({path:path.join(dist,'style.css')});
  await page.addScriptTag({path:path.join(dist,'core.js')});
  await page.addScriptTag({content:`
   const C=NeoCore,$=selector=>document.querySelector(selector),esc=String,engagementTrack=()=>{};
   let formDirty=false,engagementCalcStarted=false;
   const head=(title,description)=>'<h1>'+title+'</h1><p>'+description+'</p>';
   ${calculator}
   document.documentElement.dataset.theme=${JSON.stringify(theme)};
   $('#calc').innerHTML=calculator();
  `});
  const mass=page.locator('#calc-range-mass'),bubble=page.locator('[data-calc-bubble=mass]');
  const assertBubble=async()=>{
   const result=await bubble.evaluate(node=>{
    const box=node.getBoundingClientRect(),card=node.closest('.calc-card').getBoundingClientRect();
    return box.left>=card.left&&box.right<=card.right;
   });
   assert.equal(result,true);
  };
  await mass.press('Home');await assertBubble();
  await mass.press('End');await assertBubble();
  assert.equal(await bubble.textContent(),'60 mg');
  await page.locator('[data-calc-chip=mass][data-value="15"]').click();
  await page.locator('[data-calc-chip=volume][data-value="3"]').click();
  await page.selectOption('#calc-capacity','0.5');
  await page.locator('[data-calc-chip=dose][data-value="2.5"]').click();
  assert.match(await page.locator('#result .big').textContent(),/0,5/);
  assert.equal(await page.locator('#calc-range-dose').getAttribute('max'),'2.5');
  await page.locator('.calc-card-dose summary').click();
  await page.locator('#dose').fill('0');
  assert.equal(await page.locator('#result .error').count(),0);
  await page.locator('#dose').blur();
  assert.match(await page.locator('#result .error').textContent(),/valores positivos/);
  await page.locator('#dose').fill('2.5125');
  assert.match(await page.locator('.syringe-reading').textContent(),/fora da capacidade/);
  await page.selectOption('#calc-capacity','1');
  assert.match(await page.locator('.syringe-reading').textContent(),/entre marcas/);
  assert.equal(await page.locator('#dose').inputValue(),'2.5125');
  await page.selectOption('#doseUnit','mcg');
  assert.equal(await page.locator('#dose').inputValue(),'2512.5');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  if(options.isMobile){
   assert.equal(await page.evaluate(()=>document.querySelector('.calc-formula').getBoundingClientRect().bottom<=document.querySelector('#nav').getBoundingClientRect().top),true);
  }
  if(process.env.CALC_SCREENSHOTS){
   fs.mkdirSync(process.env.CALC_SCREENSHOTS,{recursive:true});
   await page.screenshot({path:path.join(process.env.CALC_SCREENSHOTS,label+'.png'),fullPage:true});
  }
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  await verify(browser,devices['iPhone 13'],'iphone','dark');
  await verify(browser,{viewport:{width:1440,height:900}},'desktop','light');
  console.log('Calculadora aprovada em Chromium desktop e emulação iPhone 13.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
