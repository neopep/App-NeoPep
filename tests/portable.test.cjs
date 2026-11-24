const {test}=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),fs=require('node:fs');
test('Portable NeoPep HTML contains the current offline shell and inlined production scripts',()=>{
 const html=fs.readFileSync('artifacts/NeoPeptideos-previa.html','utf8');
 const {document}=parseHTML(html);
 assert.match(document.documentElement.lang,/pt-BR/);
 assert.ok(document.querySelector('#app'),'application root should exist');
 assert.ok(document.querySelector('#content'),'dynamic route content root should exist');
 assert.ok(document.querySelector('#nav'),'navigation root should exist');
 assert.ok(document.querySelector('#dialog'),'record editor should exist');
 assert.match(document.querySelector('title')?.textContent||'' ,/NeoPep/);
 assert.ok(document.querySelectorAll('script:not([src])').length>=19,'official scripts are embedded');
 assert.equal(document.querySelectorAll('script[src]').length,0,'portable preview must not depend on external JS files');
 assert.equal(document.querySelectorAll('link[rel="stylesheet"]').length,0,'portable preview must inline its styles');
 assert.ok(document.querySelector('style')?.textContent.includes('body'));
 assert.ok(html.includes('data:image/png;base64,'),'public app assets should be inline');
 assert.equal(document.querySelector('#authForm'),null,'retired login form is not part of current shell');
});
