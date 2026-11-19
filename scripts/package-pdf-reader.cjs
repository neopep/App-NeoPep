// Mozilla PDF.js is hosted locally; documents never go to an external viewer.
const fs=require('node:fs'),path=require('node:path');
const target='dist/vendor/pdfjs';fs.mkdirSync(target,{recursive:true});
for(const [source,name] of [['legacy/build/pdf.min.mjs','pdf.mjs'],['legacy/build/pdf.worker.min.mjs','pdf.worker.mjs'],['LICENSE','LICENSE']])fs.copyFileSync(path.join('node_modules/pdfjs-dist',source),path.join(target,name));
for(const name of ['cmaps','standard_fonts'])fs.cpSync(path.join('node_modules/pdfjs-dist',name),path.join(target,name),{recursive:true});
console.log('Leitor PDF.js e fontes locais preparados.');
