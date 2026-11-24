'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parseHTML}=require('linkedom');
const read=path=>fs.readFileSync(path,'utf8');

test('consolidação preserva onboarding localização + personalização sem pular as etapas',()=>{
 const app=read('src/app.js');
 assert.match(app,/data-location-intro/);
 assert.match(app,/personalizationPanel\(initial\)/);
 assert.match(app,/else await showPersonalization\(\)/);
 assert.match(app,/await showPersonalization\(\);\s*if\(!form\.hidden\)save\.focus/);
 assert.match(app,/function mountPersonalization\(/);
});

test('Home mantém tema, seringa e atendimento da Loja',()=>{
 const app=read('src/app.js'),css=read('dist/style.css');
 assert.match(app,/Um novo dia para acompanhar sua evolução\.',appearanceControl\(\)/);
 assert.match(app,/NeoShop\?\.home\?\.\(\{cloud:mode==='cloud'&&!demo,user:Cloud\.user\}\)/);
 assert.match(app,/\+homeCalculatorCard\(\)/);
 for(const k of ['.home-appearance{','.home-calculator{','.shop-home-support{'])assert.ok(css.includes(k),k);
});

test('Biblioteca e Grupo preservam pins, comparações e seleção independente',()=>{
 const c=read('dist/community.js'),css=read('dist/style.css');
 assert.match(c,/data-community=['"]toggle_pin/);
 assert.match(c,/data-before-after-picker/);
 assert.match(c,/if\(t\.dataset\.communityTab!=='feed'\)document\.querySelector\('\[data-before-after-picker\]'\)\?\.remove\(\)/);
 for(const k of ['.comparison-picker[open]','[data-library-pins]','.library-home-symbol{'])assert.ok(css.includes(k),k);
});

test('editor 013 preservado e gates automáticos não são ativados por interface',()=>{
 const c=read('dist/admin/admin.js'),css=read('dist/style.css'),sw=read('dist/sw.js'),v=JSON.parse(read('vercel.json'));
 const page=new URL('https://teste.app.neopep.com.br/admin/');
 const {document}=parseHTML(read('dist/admin/index.html'));
 const scripts=[...document.querySelectorAll('script[src]')];
 const indexOf=filename=>scripts.findIndex(script=>new URL(script.getAttribute('src'),page).pathname===`/admin/${filename}`);
 const editor=indexOf('campaign-editor.js'),admin=indexOf('admin.js');
 assert.ok(editor>=0&&editor<admin,'o editor deve ser carregado antes do painel administrativo');
 for(const script of [scripts[editor],scripts[admin]]){
  const url=new URL(script.getAttribute('src'),page);
  assert.equal(url.origin,page.origin);
  assert.ok(url.searchParams.get('v'),'asset deve ter versão para invalidação de cache');
  assert.equal(script.hasAttribute('async'),false);
  assert.equal(script.hasAttribute('defer'),false);
  assert.ok(fs.existsSync(`dist${url.pathname}`));
 }
 assert.match(c,/window\.NeoCampaignEditor\?\.open/);
 assert.match(css,/dialog\.neo-structured-editor\[open\]/);
 assert.ok(sw.includes("'appearance.js'"));
 assert.ok(sw.includes("'admin/campaign-editor.js'"));
 assert.equal(v.git.deploymentEnabled['homologacao/ciclo-completo-2026-11-24'],false);
});
