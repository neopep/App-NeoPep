/* Validação pré-publicação. Nunca imprime chaves, tokens ou segredos. */
const fs=require('fs'),vm=require('vm'),C=require('../dist/core.js');const context={window:{},Object};vm.runInNewContext(fs.readFileSync('dist/config.js','utf8'),context);const cfg=context.window.NEO_CONFIG;
if(!cfg)throw Error('Configuração pública ausente.');
if(cfg.pushVapidPublicKey&&!/^[A-Za-z0-9_-]{87}$/.test(cfg.pushVapidPublicKey))throw Error('Configure somente a chave VAPID pública válida; a privada fica no servidor.');
if(cfg.supabasePublishableKey&&!C.isPublicSupabaseKey(cfg.supabasePublishableKey))throw Error('A chave configurada não é uma chave pública publishable/anon. Não publique segredos.');
if(Boolean(cfg.supabaseUrl)!==Boolean(cfg.supabasePublishableKey))throw Error('Configure URL e chave pública juntas.');
if(cfg.publicRegistration&&(!cfg.controllerName||!cfg.privacyContact||!cfg.captchaSiteKey||cfg.captchaRequired!==true))throw Error('Cadastro público exige identificação do responsável, contato e CAPTCHA configurado.');
if(cfg.previewRegistration&&(!cfg.supabaseUrl||!cfg.supabasePublishableKey||!cfg.captchaSiteKey||cfg.captchaRequired!==true||cfg.publicRegistration))throw Error('Cadastro de teste requer Supabase e CAPTCHA, separado da liberação pública.');
console.log(cfg.supabaseUrl?'Configuração pública validada estruturalmente; conexão real não verificada.':'Nuvem não configurada; recursos remotos permanecem indisponíveis.');
