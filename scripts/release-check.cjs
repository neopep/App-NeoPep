// Auditoria local de prontidão. Não publica, acessa contas nem modifica dados.
const fs=require('node:fs'),vm=require('node:vm');
const REQUIRED=['public_url_https','auth_email_delivery','auth_redirects_captcha','two_account_isolation','private_storage','delete_account','export_restore','legal_operations','catalog_release','iphone_android','backup_monitoring','notifications_scope'];
function assess(manifest,config){
 const failures=[];
 if(manifest?.target!=='web-mobile')failures.push('Destino do checklist inválido.');
 for(const id of REQUIRED){const c=manifest?.checks?.[id];if(c?.status!=='verified'||typeof c.evidence!=='string'||!c.evidence.trim())failures.push(id+': '+(c?.note||'Validação e evidência pendentes.'));}
 if(!config?.controllerName||!config?.controllerCnpj||!config?.privacyContact)failures.push('Identificação e contato da empresa incompletos.');
 if(!config?.captchaRequired||!config?.captchaSiteKey)failures.push('CAPTCHA obrigatório não configurado.');
 if(!config?.providers?.email)failures.push('Login por e-mail não habilitado.');
 if(config?.publicRegistration!==true||config?.previewRegistration===true)failures.push('Cadastro público não preparado; exigir publicRegistration=true e previewRegistration=false.');
 if(config?.cloudValidated!==true)failures.push('cloudValidated: validação da integração real não registrada.');
 return failures;
}
if(require.main===module){
 try{const context={window:{}};vm.runInNewContext(fs.readFileSync('dist/config.js','utf8'),context);const manifest=JSON.parse(fs.readFileSync('release/web-readiness.json','utf8')),failures=assess(manifest,context.window.NEO_CONFIG);
 if(failures.length){console.log('LANÇAMENTO PENDENTE — nenhuma alteração de acesso foi executada.');for(const failure of failures)console.log('- '+failure);process.exitCode=1;}
 else console.log('Evidências locais completas. Confirmar sua atualidade antes de habilitar cadastros e alterar a audiência da hospedagem. Este comando não publica nem certifica segurança.');
 }catch{console.error('Não foi possível validar os arquivos de preparação.');process.exitCode=1;}
}
module.exports={assess,REQUIRED};
