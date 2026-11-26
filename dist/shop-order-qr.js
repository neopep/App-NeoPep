/* Local QR labels. No customer data or network requests. */
window.NeoOrderQR=(()=>{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const encode=id=>{if(!uuid.test(String(id)))throw Error('Identificador de pedido inválido.');return 'NEOPEP:ORDER:1:'+String(id).toLowerCase();};
 function parse(value){
  const v=String(value||'').trim();
  const match=/^NEOPEP:ORDER:1:([0-9a-f-]{36})$/i.exec(v);
  const id=match?match[1]:v;
  return uuid.test(id)?id.toLowerCase():null;
 }
 function svg(id){
  if(typeof window.qrcode!=='function')throw Error('Gerador de QR indisponível. Atualize o app.');
  const qr=window.qrcode(0,'M');qr.addData(encode(id),'Byte');qr.make();
  const n=qr.getModuleCount(),size=n+8;let d='';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))d+='M'+(x+4)+' '+(y+4)+'h1v1h-1z';
  return '<svg class="shop-label-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" shape-rendering="crispEdges" role="img" aria-label="QR Code do pedido"><rect width="'+size+'" height="'+size+'" fill="white"/><path d="'+d+'" fill="black"/></svg>';
 }
 function decode(canvas,source,width,height){
  if(typeof window.jsQR!=='function')throw Error('Leitor QR indisponível. Atualize o app.');
  if(!width||!height)return null;
  const scale=Math.min(1,1000/Math.max(width,height));canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Não foi possível abrir a imagem.');
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
  const result=window.jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});return result?.data||null;
 }
 return {encode,parse,svg,decode};
})();
