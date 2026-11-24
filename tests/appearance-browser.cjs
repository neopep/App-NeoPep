// Optional browser regression. Requires Chromium and Playwright.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const dist=path.resolve(__dirname,'../dist');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({colorScheme:'light'});
  await context.route('https://theme.test/**',route=>{
   const file=new URL(route.request().url()).pathname;
   if(file==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><head><meta name="theme-color"><script src="/appearance.js"></script><script>window.firstTheme=document.documentElement.dataset.theme;</script><link rel="stylesheet" href="/style.css"></head><body>Teste</body></html>'});
   return route.fulfill({body:fs.readFileSync(path.join(dist,file)),contentType:file.endsWith('.css')?'text/css':'text/javascript'});
  });
  const page=await context.newPage();
  await page.goto('https://theme.test/');
  assert.equal(await page.evaluate(()=>window.firstTheme),'light');
  await page.emulateMedia({colorScheme:'dark'});
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.evaluate(()=>NeoAppearance.save('light'));
  await page.reload();
  assert.equal(await page.evaluate(()=>window.firstTheme),'light');
  await page.evaluate(()=>NeoAppearance.save('system'));
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  const other=await context.newPage();
  await other.goto('https://theme.test/');
  await other.evaluate(()=>NeoAppearance.save('light'));
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  console.log('Tema antes do CSS, persistência, atualização do sistema e sincronização entre abas aprovados.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
