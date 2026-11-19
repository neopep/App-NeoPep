// Uma única versão NeoPeptídeos, na raiz e no endereço de compatibilidade /neo/.
// Limpa apenas o artefato gerado; nunca lê ou altera dados de usuários.
const fs=require('fs'),path=require('path');
const root=path.resolve('artifacts/hosting-preview');
fs.rmSync(root,{recursive:true,force:true});
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
for(const item of fs.readdirSync('dist')){
 if(['elo','neo'].includes(item))throw Error('dist deve conter apenas a versão atual, sem cópias antigas.');
 fs.cpSync(path.join('dist',item),path.join(root,'dist',item),{recursive:true});
}
// Mesmos arquivos: preserva callbacks de autenticação e PWAs previamente instaladas,
// sem redirecionar/remover códigos PKCE, fragmentos ou parâmetros de recuperação.
fs.cpSync('dist',path.join(root,'dist/neo'),{recursive:true});
fs.mkdirSync(path.join(root,'.openai'),{recursive:true});
fs.copyFileSync('.openai/hosting.json',path.join(root,'.openai/hosting.json'));
console.log('NeoPeptídeos preparado na raiz; /neo/ usa a mesma versão por compatibilidade. Nenhuma publicação executada.');
