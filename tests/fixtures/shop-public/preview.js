(() => {
 'use strict';
 const root = document.querySelector('#content');
 const rows = [
  {id:'11111111-0000-4000-8000-000000000001', name:'Caderno pautado', category:'Papelaria',
   description:'Caderno de 80 folhas usado apenas para testes.', price_cents:1800, available:true,
   publicEligible:true, restricted:false, active:true},
  {id:'11111111-0000-4000-8000-000000000002', name:'Caneca de cerâmica', category:'Casa',
   description:'Caneca fictícia de 300 ml.', price_cents:3900, available:false,
   publicEligible:true, restricted:false, active:true}
 ];
 let account = null;
 let unmount;

 function showStore() {
  unmount = window.NeoPublicShop.mount(root, {
   rows, account,
   register: async () => {
    account = {id:'conta-ficticia', onboardingComplete:false, commercialComplete:true};
    return account;
   },
   openApp: () => {
    unmount();
    root.innerHTML = '<section class="card"><h1>Prévia da transição</h1><p>O cadastro complementar começaria aqui com a mesma conta fictícia.</p><button type="button" class="secondary">Voltar à loja</button></section>';
    root.querySelector('button').addEventListener('click', showStore);
   }
  });
  if (!unmount) root.textContent = 'Abra esta prévia em localhost com ?loja=1#loja.';
 }

 showStore();
})();
