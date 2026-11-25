'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('dist/style.css','utf8');
const marker='/* Rodada 25/11: contadores NUMÉRICOS em azul-marinho no tema claro.';
test('indicadores numéricos do tema claro são padronizados em azul-marinho',()=>{
 const start=css.indexOf(marker);
 assert.notEqual(start,-1,'pacote de paleta precisa estar registrado');
 const tail=css.slice(start);
 for(const selector of [
  '.community-badge','.community-badge.has-news','.notification-count',
  '.nav-shop-count','.admin-signup-badge','.support-thread-meta b',
  '.tab-unread','.primary .tab-unread','.notification-toast-main > b'
 ]){
  assert.ok(tail.includes(selector),selector+' não coberto');
 }
 assert.match(tail,/\[data-theme=light\] :is\(/);
 assert.match(tail,/background:#142743/);
 assert.match(tail,/color:#fff/);
 assert.match(tail,/border:1px solid #223F63/);
 assert.match(tail,/box-shadow:0 0 0 2px #223F63/);
});
test('a alteração de badges não modifica status nem regras do tema escuro',()=>{
 const start=css.indexOf(marker);
 const added=css.slice(start);
 assert.ok(!added.includes('[data-theme=dark]'));
 for(const forbidden of ['.status-pill','.shop-deal-badge','.library-featured-badge','.agent-inbox-badge']){
  assert.ok(!added.includes(' '+forbidden+',')&&!added.includes('\n '+forbidden+','));
 }
 assert.ok(css.slice(0,start).includes('[data-theme=dark]'));
});
