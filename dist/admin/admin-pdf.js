/* O manual administrativo aceita apenas PDFs locais da pasta de assets. */
'use strict';
(() => {
 const base=new URL('../',document.currentScript.src),assets=new URL('assets/',base);
 window.NeoAdminPDF=Object.freeze({async open({path,title,trigger}){
  const url=new URL(path,base);
  if(url.origin!==assets.origin||!url.pathname.startsWith(assets.pathname)||!url.pathname.endsWith('.pdf')){
   throw Error('PDF administrativo inválido.');
  }
  return window.NeoPDFReader.open({url:url.href,title,trigger,owner:'admin'});
 }});
})();
