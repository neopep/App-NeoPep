const profile=(name,issuerOrigin,approvalOrigin,project)=>Object.freeze({
 name,issuerOrigin,approvalOrigin,project,resource:issuerOrigin+'/mcp',supabaseOrigin:'https://'+project+'.supabase.co'
});

export const testProfile=profile('test','https://connect-teste.neopep.com.br','https://teste.app.neopep.com.br','qnuluspqfazdppciermw');
export const productionProfile=profile('production','https://connect.neopep.com.br','https://app.neopep.com.br','cpslafpzjtbpmoxxysaa');
