const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');

test('WhatsApp sincroniza seleções por titular e conexão e bloqueia provas inválidas',async()=>{
 const db=new PGlite();
 const device='10000000-0000-4000-8000-000000000001', owner='10000000-0000-4000-8000-000000000002';
 const other='10000000-0000-4000-8000-000000000003', connection='10000000-0000-4000-8000-000000000004';
 const second='10000000-0000-4000-8000-000000000005', key='a'.repeat(64);
 const group={group_jid:'123@g.us',display_name:'Grupo fictício',participant_count:3};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema neo_private;
   grant usage on schema neo_private to authenticated;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table neo_private.connect_devices(id uuid primary key,owner_id uuid not null,state text not null,secret_hash bytea not null);
   insert into neo_private.connect_devices values ('${device}','${owner}','approved',sha256(convert_to('${key}','UTF8')));`);
  await db.exec(readFileSync('tests/fixtures/connect/whatsapp-grupos.sql','utf8'));
  const as=async(role,id)=>{
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
   await db.exec('set role '+role);
  };
  const sync=(id,revision,rows,proof=key)=>db.query(
   'select public.neo_connect_wa_replace_selection($1,$2,$3,$4,$5,$6) result',
   [device,proof,id,revision,'Conta fictícia',JSON.stringify(rows)]).then(r=>r.rows[0].result);
  const groups=id=>db.query('select * from public.neo_connect_wa_list_groups($1)',[id]).then(r=>r.rows);
  await as('anon','');await assert.rejects(groups(connection),{code:'42501'});
  await as('authenticated',owner);
  await assert.rejects(db.query('select * from neo_private.connect_wa_connections'),{code:'42501'});
  await assert.rejects(sync(connection,0,[group],'b'.repeat(64)),{code:'42501'});
  assert.equal((await sync(connection,0,[group])).revision,1);
  assert.equal((await sync(second,0,[group])).revision,1);
  assert.equal((await groups(connection))[0].display_name,group.display_name);
  await assert.rejects(sync(connection,0,[]),{code:'40001'});
  await assert.rejects(sync(connection,1,[group,{...group,participants:[]}]),{code:'22023'});
  assert.equal((await sync(connection,1,[])).revision,2);
  assert.equal((await groups(connection)).length,0);
  assert.equal((await groups(second)).length,1);
  assert.equal((await db.query('select * from public.neo_connect_wa_list_connections()')).rows.length,2);
  await as('authenticated',other);
  assert.equal((await groups(second)).length,0);
  await assert.rejects(sync(second,1,[]),{code:'42501'});
  await as('authenticated',owner);
  await db.query("select public.neo_connect_wa_set_status($1,$2,$3,'revoked')",[device,key,second]);
  assert.equal((await groups(second)).length,0);
  await assert.rejects(sync(second,1,[]),{code:'42501'});
  await db.exec("reset role; update neo_private.connect_devices set state='revoked'");
  await as('authenticated',owner);
  await assert.rejects(sync(connection,2,[group]),{code:'42501'});
 }finally{await db.close();}
});
