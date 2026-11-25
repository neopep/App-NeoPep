const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../release/pacote-final-20261125/20261125235000_onboarding_initial_weight.sql'),'utf8');

test('peso inicial e gravado atomicamente com o cadastro, com consentimento e identificador estavel',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.neo_complete_onboarding\(p_profile jsonb, p_settings jsonb, p_health boolean, p_terms boolean\)/i);
 assert.match(sql,/p_health is distinct from true or p_terms is distinct from true/);
 assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/insert into public\.neo_records\(user_id,kind,id,data\)/i);
 assert.match(sql,/select auth\.uid\(\),'weights','onboarding-initial'/i);
 assert.match(sql,/jsonb_build_object\('id','onboarding-initial','date',initial_date,'value',p_profile->'initialWeight'\)/i);
 assert.match(sql,/where not exists\s*\(\s*select 1 from public\.neo_records r\s*where r\.user_id=auth\.uid\(\) and r\.kind='weights'/i);
 assert.match(sql,/on conflict \(user_id,kind,id\) do nothing/i);
});
test('data do peso nao altera os dados persistentes do perfil',()=>{
 assert.match(sql,/p_profile \? 'initialRecordDate'/);
 assert.match(sql,/public\.neo_valid_date\(initial_date\)/);
 assert.match(sql,/p_profile - 'initialRecordDate'/);
 assert.match(sql,/time zone 'America\/Sao_Paulo'/);
 assert.doesNotMatch(sql,/delete from public\.neo_records|update public\.neo_records/i);
});
