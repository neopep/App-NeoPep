'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const js=fs.readFileSync('dist/admin/admin.js','utf8'),html=fs.readFileSync('dist/admin/index.html','utf8'),css=fs.readFileSync('dist/style.css','utf8');
test('Campanhas tem acesso direto na Visao Geral sem aba horizontal duplicada',()=>{
 const start=js.indexOf('function overview(d)'),end=js.indexOf('function adminCsvText',start);
 assert.ok(start>=0&&end>start);
 const overview=new Function('esc','adminSectionHeading','adminAgentTrigger',js.slice(start,end)+';return overview;')(String,()=>'',()=>'');
 const view=overview({app_errors_7d:[]});
 assert.match(view,/<button type="button" class="card admin-campaign-shortcut" data-admin-tab="campaigns"/);
 assert.ok(view.indexOf('admin-campaign-shortcut')<view.indexOf('class="stats"'));
 assert.doesNotMatch(html.match(/<nav[^>]*id="adminTabs"[\s\S]*?<\/nav>/)[0],/data-admin-tab="campaigns"/);
 assert.match(js,/if\(tab==='campaigns'\)url.searchParams.set\('admin','campaigns'\)/);
 assert.match(js,/else if\(tab==='campaigns'\).*mountCampaigns/);
 assert.match(css,/\.admin-overview \.admin-campaign-shortcut/);
});
