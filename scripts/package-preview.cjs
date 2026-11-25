const fs=require('fs'),path=require('path');
let html=fs.readFileSync('dist/index.html','utf8');
// Artefato portátil de revisão. Não usar no hosting: CSP de produção permanece em dist/index.html.
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/<link rel="manifest"[^>]*>/,'');
const read=f=>fs.readFileSync(path.join('dist',f),'utf8');
const inlineSvg=f=>'data:image/svg+xml;base64,'+fs.readFileSync(path.join('dist',f)).toString('base64');
const inlinePng=f=>'data:image/png;base64,'+fs.readFileSync(path.join('dist',f)).toString('base64');
let css=read('style.css');for(const asset of ['background.svg','background-gold.svg'])css=css.replaceAll(`url('assets/${asset}')`,`url('${inlineSvg('assets/'+asset)}')`);
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
for(const name of ['appearance.js','config.js','core.js','cloud.js','captcha.js','push.js','community-alerts.js','shop-core.js','shop-promotions.js','shop.js','support.js','media-links.js','pdf-reader.js','library-video.js','library-files.js','library-shelf.js','community.js','library.js','gestures.js','arrival.js','install.js','app.js']){
 let code=read(name);
 if(name==='app.js')code=code.replace("if('serviceWorker'in navigator&&['https:','http:'].includes(location.protocol))",'if(false)');
 code=code.replaceAll('assets/brands/mercadopago.svg',inlineSvg('assets/brands/mercadopago.svg'));
 if(name==='app.js'){
  const examples=[1,2].map(i=>inlinePng('assets/photo-example-'+i+'.png'));
  code=code.replace('assets/photo-example-${i+1}.png','${'+JSON.stringify(examples)+'[i]}');
 }
 code=code.replaceAll('assets/logo-neopep.png',inlinePng('assets/logo-neopep.png')).replace(/assets\/icon.svg/g,inlineSvg('assets/icon.svg')).replace(/<\/script/gi,'<\\/script');
 const prefix='<script src="'+name;
 const start=html.indexOf(prefix);
 if(start<0)throw Error('Script obrigatório ausente na prévia portátil: '+name);
 const closing='"></script>';
 const end=html.indexOf(closing,start);
 if(end<0||end-start>prefix.length+90)throw Error('Tag de script inválida na prévia portátil: '+name);
 const existing=html.slice(start,end+closing.length);
 html=html.replace(existing,()=>'<script>'+code+'</script>');
}
for(const asset of ['logo-neopep.png','favicon-32.png','apple-touch-icon.png'])html=html.replaceAll('assets/'+asset,inlinePng('assets/'+asset));
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/NeoPeptideos-previa.html',html);
console.log('Prévia HTML portátil criada; nenhum dado pessoal incluído.');
