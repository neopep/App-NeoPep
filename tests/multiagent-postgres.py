"""Optional MA-03 concurrency check. Uses Docker and synthetic PostgreSQL data."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'postgres:17-alpine@sha256:526f86d93c6ea08fd3f1fe5605650cacc781b2c6013169a0ad8f42c7d3d84f32'
MIGRATIONS = ROOT / 'supabase/migrations'
FOUNDATION = '202611200001_multiagent_foundation.sql'
RUNTIME = '202611200002_multiagent_runtime.sql'
INTEGRATION = '00000000-0000-4000-8000-000000000026'
AGENT_A = '00000000-0000-4000-8000-000000000201'
AGENT_B = '00000000-0000-4000-8000-000000000202'
NAME = 'neopep-ma03-' + uuid.uuid4().hex[:10]


def sql(statement):
    result = subprocess.run(
        ['docker', 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-XqAt', '-v', 'ON_ERROR_STOP=1'],
        input=statement, text=True, capture_output=True, timeout=45,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def rpc(expression, hold=False):
    # Holding the transaction after the RPC makes the other session contend for
    # its locks rather than exercising a pair of back-to-back calls.
    pause = 'select pg_sleep(0.25);' if hold else ''
    result = sql(f'begin; set local role service_role; select {expression}; {pause} commit;')
    return json.loads(result.splitlines()[0]) if result else None


def race(first, second):
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(rpc, first, True)
        b = pool.submit(rpc, second, True)
        return a.result(), b.result()


def seed():
    sql(f"""
      update neo_private.ai_integrations set model='synthetic-model', validated_at=now(),
        validated_revision=revision where id='{INTEGRATION}';
      insert into neo_private.agents(id, public_name, admin_name, status, integration_id, mode, daily_limit)
        values ('{AGENT_A}','Agente A','Agente A','active','{INTEGRATION}','auto',1),
               ('{AGENT_B}','Agente B','Agente B','active','{INTEGRATION}','auto',5);
    """)
    messages = []
    for agent, body in [(AGENT_A, 'Primeira conversa'), (AGENT_A, 'Segunda conversa'), (AGENT_B, 'Outro agente')]:
        user, thread, message = (str(uuid.uuid4()) for _ in range(3))
        sql(f"""
          insert into auth.users(id) values('{user}');
          insert into public.neo_consents(user_id,purpose,granted) values('{user}','terms',true);
          insert into neo_private.support_threads(id,user_id,agent_id,next_seq,ai_opt_in,ai_consented_at,runtime_consent_provider)
            values('{thread}','{user}','{agent}',1,true,now()-interval '1 minute','openai');
          insert into neo_private.support_messages(id,thread_id,sender_id,sender_alias,sender_type,seq,body)
            values('{message}','{thread}','{user}','Participante','member',1,'{body}');
        """)
        messages.append((user, message))
    return messages


def claim(pair):
    return f"public.neo_ai_claim('{pair[0]}','{pair[1]}')"


def finish(job):
    return f"public.neo_ai_finish('{job['id']}','{job['lease']}','Resposta sintética')"


def check_runtime():
    first, second, other = seed()
    concurrent = race(claim(first), claim(second))
    claimed = [job for job in concurrent if job]
    assert len(claimed) == 1, concurrent
    assert sql(f"select count(*) from neo_private.agent_runtime_attempts where agent_id='{AGENT_A}';") == '1'
    print('OK: duas sessões, duas conversas, uma única reserva no limite diário do agente A.')

    concurrent = race(claim(other), claim(other))
    claimed_other = [job for job in concurrent if job]
    assert len(claimed_other) == 1, concurrent
    assert sql(f"select count(*) from neo_private.agent_runtime_attempts where agent_id='{AGENT_B}';") == '1'
    print('OK: o agente B tem cota própria e dois workers não obtêm lease para a mesma mensagem.')

    expired = claimed_other[0]
    sql(f"update neo_private.ai_jobs set lease_until=now()-interval '1 second' where id='{expired['id']}';")
    fresh = rpc(claim(other))
    assert fresh['lease'] != expired['lease']
    concurrent = race(finish(expired), finish(fresh))
    assert concurrent[0]['published'] is False and concurrent[1]['published'] is True
    assert rpc(finish(fresh))['published'] is False
    assert sql("select count(*) from neo_private.support_messages where sender_type='assistant';") == '1'
    print('OK: retomada gera outro lease, rejeita o antigo e não duplica a resposta.')

    pending = claimed[0]
    concurrent = race(finish(pending), finish(pending))
    assert sum(int(result['published']) for result in concurrent) == 1, concurrent
    assert sql("select count(*) from neo_private.support_messages where sender_type='assistant';") == '2'
    print('OK: duas finalizações concorrentes com o mesmo lease publicam uma única resposta.')

    sql(f"update neo_private.agents set always_on=false, weekdays='{{}}' where id='{AGENT_A}';")
    hours = sql(f"select neo_private.agent_runtime_hours(a) from neo_private.agents a "
                f"where id in ('{AGENT_A}','{AGENT_B}') order by id;")
    assert hours.splitlines() == ['f', 't']
    print('OK: alterar o horário do agente A não altera a disponibilidade do agente B.')


def main():
    subprocess.run(
        ['docker', 'run', '--rm', '-d', '--network', 'none', '--name', NAME,
         '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE, '-c', 'log_statement=none'],
        check=True, capture_output=True, timeout=90,
    )
    try:
        for _ in range(30):
            try:
                version = sql("select current_setting('server_version') where current_setting('listen_addresses')<>'';")
                if version:
                    break
            except RuntimeError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError('PostgreSQL isolado não iniciou.')
        print('PostgreSQL', version)
        sql((ROOT / 'tests/fixtures/multiagent-postgres.sql').read_text())
        audit = (ROOT / 'release/auditoria-multiagentes.sql').read_text()
        for migration in sorted(MIGRATIONS.glob('*.sql')):
            if migration.name == FOUNDATION:
                assert 'agent_settings' in sql(audit)
            sql(migration.read_text())
        assert 'neo_multiagent_tested' in sql(audit)
        sql((MIGRATIONS / RUNTIME).read_text())
        print('OK: histórico, auditoria antes/depois e reexecução da MA-03.')
        check_runtime()
    finally:
        subprocess.run(['docker', 'stop', NAME], check=True, capture_output=True, timeout=20)


if __name__ == '__main__':
    main()
