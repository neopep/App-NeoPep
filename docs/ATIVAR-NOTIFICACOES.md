# Ativar notificações reais (etapa externa pendente)

O código está preparado e testado com banco PostgreSQL local e serviços de envio simulados nos testes. Não foi implantado nem testado com provedores reais. Nenhuma chave privada foi criada. Esses passos precisam de acesso do responsável ao Supabase; não enviar segredos pelo chat.

## 1. Banco
No projeto Supabase `cpslafpzjtbpmoxxysaa`, SQL Editor > New query, executar `supabase/migrations/202611120004_push.sql`. É adicional, transacional e reexecutável. O usuário autenticado só pode cadastrar/remover a própria inscrição. Chaves de dispositivos e fila não são acessíveis pelo navegador nem pelo painel administrativo.

## 2. Chaves
Em um computador confiável com Node, executar `npx web-push@3.6.7 generate-vapid-keys --json`. Guardar o resultado em local privado. A chave PUBLIC pode ir ao app; PRIVATE somente no servidor. Gerar também um segredo de cron com pelo menos 32 caracteres aleatórios (ex.: `openssl rand -hex 32`). Não colocar essas saídas no repositório.

Em Supabase > Edge Functions > Secrets, criar:
- `NEO_VAPID_PUBLIC_KEY`: chave pública gerada.
- `NEO_VAPID_PRIVATE_KEY`: chave privada correspondente.
- `NEO_VAPID_SUBJECT`: `mailto:` seguido de e-mail de contato real do responsável.
- `NEO_PUSH_CRON_SECRET`: segredo aleatório de cron.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos pelo ambiente de Edge Functions, nunca pelo frontend. Não substituir a chave pública Supabase do app pela service role.

## 3. Publicar função
Na pasta do projeto em computador com Supabase CLI autenticado na conta correta:

```sh
supabase functions deploy push-dispatch --project-ref cpslafpzjtbpmoxxysaa --no-verify-jwt
```

`--no-verify-jwt` é exclusivo desta função de cron: ela verifica um segredo próprio, não aceita chamadas anônimas sem esse segredo e não expõe dados. Não aplicar essa opção a outras funções por analogia. O envio usa a biblioteca `web-push` e precisa ser validado no runtime Deno do Supabase após a implantação.

## 4. Agendar a rotina
No Supabase, habilitar as extensões `pg_cron` e `pg_net` se disponíveis no plano e verificar Vault. Guardar no Vault o mesmo segredo de cron com nome `neo_push_cron_secret` (interface Vault > Add secret). O valor não deve aparecer no SQL versionado.

Executar no SQL Editor uma vez:

```sql
select cron.schedule(
  'neo-push-dispatch',
  '* * * * *',
  $$select net.http_post(
    url := 'https://cpslafpzjtbpmoxxysaa.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-neo-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='neo_push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );$$
);
```

Verificar se já existe uma tarefa com o mesmo nome antes de repetir. Para suspender: `select cron.unschedule('neo-push-dispatch');`. Verificar limites e custos do plano antes de habilitar. Esta configuração não foi executada automaticamente.

## 5. Chave pública no app e validação
Pedir atualização de `pushVapidPublicKey` em `dist/config.js` com APENAS a chave PUBLIC. Publicar a prévia normalmente. A chave pública deve corresponder à privada no servidor.

No iPhone:
1. Abrir a prévia no Safari, adicionar à tela inicial, abrir pelo ícone e entrar na conta.
2. Em Lembretes, configurar um horário alguns minutos à frente.
3. Em Avisos com o app fechado, ativar neste dispositivo e conceder permissão.
4. Fechar o app, aguardar o horário e verificar o aviso. Confirmar que tocar abre Lembretes e não publica dados na tela bloqueada.
5. Verificar ausência de duplicação, desativação, logout e outra conta. Testar lembrete único, diário e semanal; peso já registrado no dia; fuso do dispositivo; permissão negada e falha de rede.
6. Verificar invocações da Edge Function e cron sem registrar endpoints, chaves ou dados de saúde nos logs.

Falha entre a aceitação do provedor e a confirmação no banco pode resultar em tentativa repetida; o identificador da notificação agrupa reenvios. Não há garantia de entrega nem pontualidade. Rotina envia no máximo 20 avisos por execução: validar capacidade antes de escalar. O dispositivo deve reativar após mudar de fuso. Se trocar o par VAPID, desativar e reativar as inscrições.

Enquanto essa etapa estiver pendente, usar avisos com o app aberto ou exportação para agenda (.ics).
