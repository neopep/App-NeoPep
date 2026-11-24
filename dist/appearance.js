/* Apply the installation preference before CSS paints. Both web entry points use this key. */
window.NeoAppearance=(()=>{
 const key='neo-appearance';
 const choices=['light','dark','system'];
 const system=window.matchMedia('(prefers-color-scheme: dark)');
 function read(){
  try{
   const saved=localStorage.getItem(key);
   if(choices.includes(saved))return saved;
  }catch{/* Storage can be unavailable during private browsing. */}
  return 'system';
 }
 let preference=read();
 function apply(next=preference){
  preference=choices.includes(next)?next:'system';
  const dark=preference==='dark'||(preference==='system'&&system.matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  const meta=document.querySelector('meta[name=theme-color]');
  if(meta)meta.content=dark?'#111210':'#F4F5F6';
 }
 function save(next){
  apply(next);
  try{localStorage.setItem(key,preference);}catch{/* The current page can still change appearance. */}
 }
 apply();
 system.addEventListener?.('change',()=>apply());
 window.addEventListener('storage',event=>{
  if(event.key!==key&&event.key!==null)return;
  apply(read());
  document.dispatchEvent(new Event('neo:appearance'));
 });
 return {get value(){return preference;},apply,save};
})();
