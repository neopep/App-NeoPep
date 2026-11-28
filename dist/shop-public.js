/* A local preview of the commercial journey. No production entry point. */
window.NeoPublicShop=(()=>{
 'use strict';
 const productID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 const previewHosts=new Set(['localhost','127.0.0.1','[::1]']);
 const sorts=new Set(['recent','low','high']);
 const escape=window.NeoCore.escape;
 const themes={system:'Sistema',light:'Claro',dark:'Escuro'};
 let mounted=false;

 function route(url){
  if(url.hash!=='#loja')return null;
  const id=url.searchParams.get('produto');
  if(id!==null)return productID.test(id)?{product:id.toLowerCase()}:null;
  return url.searchParams.get('loja')==='1'?{product:null}:null;
 }

 // Account state comes from the session adapter, never from the route.
 function context(account){
  if(!account)return 'visitor';
  return account.id&&account.onboardingComplete===false&&account.commercialComplete===true?'commercial':'app';
 }

 // Only fixture images can be requested by the local preview.
 function photoURL(value){
  return typeof value==='string'&&/^\/tests\/fixtures\/shop-public\/[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(value)?value:'';
 }

 function visibleProducts(rows){
  return rows.filter(row=>row?.publicEligible===true&&row.active===true&&row.deleted!==true&&row.restricted===false
   &&typeof row.id==='string'&&productID.test(row.id)
   &&Number.isSafeInteger(row.price_cents)&&row.price_cents>0).map(row=>{
   const photos=(Array.isArray(row.photos)?row.photos:[]).slice(0,6)
    .map(photoURL).filter(Boolean).map(url=>({url}));
   const price=row.price_cents;
   const offer=row.offer;
   return {
    id:row.id.toLowerCase(),active:true,stock:row.available===true?1:0,
    name:String(row.name??'').slice(0,120),description:String(row.description??'').slice(0,4000),
    category:String(row.category??'').slice(0,80),price_cents:price,
    photos,photo_url:photos[0]?.url||'',
    offer:offer&&Number.isSafeInteger(offer.price_cents)&&typeof offer.valid_until==='string'
     &&Date.parse(offer.valid_until)>Date.now()?{
      original_price_cents:price,price_cents:offer.price_cents,valid_until:offer.valid_until
     }:null
   };
  });
 }

 function mount(root,{rows,account=null,register,readAccount,openApp}){
  if(mounted||!Array.isArray(rows)||typeof register!=='function'||typeof readAccount!=='function'||typeof openApp!=='function'||!previewHosts.has(location.hostname)||!['http:','https:'].includes(location.protocol)||!route(new URL(location.href)))return null;
  let access=context(account),accountID=account?.id;
  if(access==='app')return null;
  const products=visibleProducts(rows);
  const renderer=window.NeoShop.storefront;
  let search='',category='',sort='recent',photoIndex=0,enrolling=false,busy=false,transitioning=false,disposed=false,message='';
  mounted=true;

  function render(){
   const target=route(new URL(location.href));
   if(!target){root.replaceChildren();return;}
   const product=products.find(item=>target.product===item.id);
   const registration=access==='visitor'?(enrolling?'<form data-commercial-register><h2>Cadastro comercial</h2><p>Simulação local com uma conta fictícia.</p><label><input type="checkbox" name="consent" required> Aceito participar da simulação</label><button class="primary" type="submit">Concluir cadastro fictício</button><button type="button" class="secondary" data-commercial="cancel">Cancelar</button></form>':'<button type="button" class="secondary" data-commercial="register">Simular cadastro comercial</button>'):'<button type="button" class="secondary" data-commercial="app">Conhecer o aplicativo</button>';
   const themeOptions=Object.entries(themes).map(([value,label])=>`<option value="${value}" ${window.NeoAppearance.value===value?'selected':''}>${label}</option>`).join('');
   root.innerHTML=`<section class="shop-page"><header class="page-head"><div><span class="eyebrow">PRÉVIA LOCAL</span><h1>Loja NeoPep</h1></div><label>Tema<select data-commercial-theme>${themeOptions}</select></label></header>
    <p role="status" data-commercial-status>${escape(message)}</p><div class="shop-header-actions">${registration}</div>
    ${target.product?renderer.detail(product,photoIndex):renderer.catalogue({products,search,category,sort})}</section>`;
  }

  function navigate(product){
   const url=new URL(location.href);
   url.search='';
   url.searchParams.set(product?'produto':'loja',product||'1');
   url.hash='loja';
   history.pushState(null,'',url);
   photoIndex=0;
   render();
  }

  function click(event){
   const button=event.target.closest('button');
   if(!button)return;
   const action=button.dataset.shop||button.dataset.commercial;
   if(!action)return;
   event.stopPropagation();
   if(action==='catalog')return navigate(null);
   if(action==='detail'&&products.some(product=>product.id===button.dataset.id))return navigate(button.dataset.id);
   if(action==='category'){category=button.dataset.category;return render();}
   if(action==='gallery'){photoIndex=Number(button.dataset.index);return render();}
   if(action==='register'||action==='cancel'){enrolling=action==='register';return render();}
   if(action==='app'&&access==='commercial')return startOnboarding(button);
   if(action==='buy'||action==='add'){
    message='Compras e alterações de carrinho estão desativadas nesta prévia.';
    root.querySelector('[data-commercial-status]').textContent=message;
   }
  }

  async function startOnboarding(button){
   if(transitioning)return;
   transitioning=true;
   button.disabled=true;
   try{
    const current=await readAccount();
    if(disposed)return;
    if(context(current)!=='commercial'||current.id!==accountID)throw new Error();
    await openApp(current.id);
   }catch{
    if(!disposed){
     message='Não foi possível confirmar a mesma conta. Reabra a loja para continuar.';
     root.querySelector('[data-commercial-status]').textContent=message;
    }
   }finally{
    transitioning=false;
    button.disabled=false;
   }
  }

  function applySearch(form){
   search=form.querySelector('[name=q]').value.slice(0,120);
   const selected=form.querySelector('[name=sort]').value;
   sort=sorts.has(selected)?selected:'recent';
   render();
  }

  async function submit(event){
   const form=event.target;
   if(!form.matches('[data-shop-search],[data-commercial-register]'))return;
   event.preventDefault();
   event.stopPropagation();
   if(form.matches('[data-shop-search]'))return applySearch(form);
   if(busy||access!=='visitor'||!enrolling||!form.querySelector('[name=consent]').checked)return;
   busy=true;
   const submitButton=form.querySelector('button[type=submit]');
   submitButton.disabled=true;
   try{
    const registered=await register();
    if(context(registered)!=='commercial')throw new Error();
    accountID=registered.id;
    access='commercial';
    enrolling=false;
    message='Cadastro fictício concluído.';
   }catch{
    message='Não foi possível concluir a simulação.';
   }finally{
    busy=false;
    if(!disposed)render();
   }
  }

  function change(event){
   if(event.target.matches('[data-commercial-theme]'))window.NeoAppearance.save(event.target.value);
   if(event.target.matches('[data-shop-search] [name=sort]'))applySearch(event.target.closest('form'));
  }

  function pop(){photoIndex=0;render();}
  root.addEventListener('click',click);
  root.addEventListener('submit',submit);
  root.addEventListener('change',change);
  window.addEventListener('popstate',pop);
  render();
  return ()=>{
   if(disposed)return;
   disposed=true;
   root.removeEventListener('click',click);
   root.removeEventListener('submit',submit);
   root.removeEventListener('change',change);
   window.removeEventListener('popstate',pop);
   root.replaceChildren();
   mounted=false;
  };
 }
 return Object.freeze({route,context,mount,get active(){return mounted;}});
})();
