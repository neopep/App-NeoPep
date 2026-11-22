# Contrato para revisão — Grupos do WhatsApp no NeoPep Teste

Destino único da primeira implantação `qnuluspqfazdppciermw`. Esta proposta depende de aprovação específica antes da migration. O build Windows 0.2.4 pode listar e selecionar grupos localmente antes dessa implantação.

## Esquema proposto

| Tabela privada | Colunas e restrições |
| --- | --- |
| `neo_private.connect_wa_connections` | `id uuid primary key`, `owner_id uuid not null`, `device_id uuid not null`, `label text not null` de 1 a 80 caracteres, `status text not null` limitado a `connected`, `disconnected` e `revoked`, `last_seen_at timestamptz`, `last_synced_at timestamptz`, `revision bigint not null default 0`, `created_at timestamptz not null default now()`. FK `(device_id, owner_id)` para `neo_private.connect_devices(id, owner_id)` com exclusão em cascata. Requer unicidade nesse par na tabela de dispositivos. Índice `(owner_id, device_id, id)`. |
| `neo_private.connect_wa_selected_groups` | `connection_id uuid not null` com FK e exclusão em cascata, `group_jid text not null` com formato de grupo `^[0-9-]{1,64}@g[.]us$`, `display_name text not null` de 1 a 120 caracteres, `participant_count integer` nulo ou maior ou igual a zero, `updated_at timestamptz not null`. PK `(connection_id, group_jid)`. |

Cada sessão local pareada ganha um UUID opaco próprio, guardado junto à sessão protegida pelo DPAPI. Reconexão da mesma sessão reutiliza o UUID. Um novo pareamento recebe outro UUID. Assim, um computador pode suportar múltiplas conexões futuramente, e dois vínculos ao mesmo grupo podem pertencer a conexões diferentes. O nome de exibição da conexão é um rótulo escolhido pelo usuário. Número do WhatsApp, fotos, mensagens, participantes individuais e segredos não são enviados. As seleções pertencem exclusivamente à conexão, sem reaproveitar tabelas de campanhas ou simulação.

## RLS e autorização

Habilitar RLS nas duas tabelas. Revogar acesso direto de `PUBLIC`, `anon` e `authenticated`, mantendo zero políticas permissivas de acesso direto. Expor apenas RPCs de propósito específico. Para cada RPC, revogar a execução padrão de `PUBLIC` e `anon` e conceder a `authenticated`. Usar funções com `SECURITY DEFINER`, `search_path = pg_catalog` e nomes de esquema explícitos, para acesso controlado às tabelas privadas. Validar `auth.uid()` no servidor. O navegador usa o JWT NeoPep e recebe somente os próprios registros. Privilégio de administrador não dá acesso a grupos de outras contas. Cada escrita do Windows exige o JWT do proprietário, o dispositivo em estado `approved` e a prova local já usada pelo Connect, validada contra o hash no banco. Nenhum desses segredos vai para o painel. Dispositivos revogados perdem leitura e escrita, inclusive sobre conexões antigas.

## RPCs propostos

| RPC | Contrato |
| --- | --- |
| `neo_connect_wa_replace_selection(p_device uuid, p_secret text, p_connection uuid, p_expected_revision bigint, p_label text, p_groups jsonb)` | Deriva o proprietário da sessão e valida o dispositivo. Bloqueia a linha da conexão para serializar alterações. Aceita somente lista completa e explícita de grupos selecionados. Limite inicial de 500 itens e 128 KiB, chaves permitidas `group_jid`, `display_name` e `participant_count`, sem duplicatas. Inserção, atualização e remoção de itens desmarcados na mesma transação. Lista vazia confirmada pelo usuário remove as seleções daquela conexão. Divergência de revisão devolve conflito para reler e confirmar. Retorna revisão e horário do servidor. |
| `neo_connect_wa_set_status(p_device uuid, p_secret text, p_connection uuid, p_status text)` | Registra o estado e o heartbeat da conexão autenticada, usando o horário do servidor. Um estado `connected` sem heartbeat recente é mostrado como desatualizado. Revogação encerra aquele vínculo. Novo pareamento usa novo UUID. |
| `neo_connect_wa_list_connections()` | Retorna conexões do próprio usuário em computadores aprovados, com revisão, estado, contagem e hora da última sincronização. |
| `neo_connect_wa_list_groups(p_connection uuid, p_after text, p_limit integer)` | Valida proprietário e computador da conexão. Lista os grupos daquela conexão por cursor de JID, com limite máximo de 100. Nenhuma leitura global. |

No Windows, a seleção é enviada apenas em **Sincronizar selecionados**. Uma falha de leitura do WhatsApp, uma lista ainda carregando ou um filtro de pesquisa jamais constitui uma lista vazia confirmada. As caixas ocultas por filtro continuam selecionadas. O painel web consulta o resultado confirmado depois da sincronização e ao retornar à tela. O mesmo grupo removido em uma conexão permanece disponível quando selecionado em outra. A prova do dispositivo autentica o emissor NeoPep. A lista de grupos vem do cliente WhatsApp vinculado, sem uma segunda prova de participação fornecida pela Meta.

## Validação antes da publicação

Testar usuário anônimo, outro titular, prova incorreta e computador revogado; acesso direto às tabelas; duas conexões com o mesmo grupo; sincronizações concorrentes; desmarcar um ou todos; lote inválido sem efeito parcial; e confirmação no painel web. O contrato só prevê leitura de grupos e seus metadados.

## Candidato Windows 0.2.4

O workflow no branch de grupos compila e testa somente o perfil Teste, com versão, SHA-256 e tamanho no manifesto. Um instalador de teste sem chave de atualização deve ser usado em conta Windows separada da que fará o ensaio 0.2.3. O passo de anexar o EXE exige repositório privado. Em repositório público a compilação é validada sem disponibilizar o binário.

## SQL para aprovação

O [SQL integral](../revisao/connect-whatsapp-grupos.sql) está separado de `supabase/migrations` para evitar aplicação acidental. O painel Windows envia uma seleção confirmada pelo titular. O painel web lê as conexões e grupos pelo JWT NeoPep e oferece paginação. O painel pode ser atualizado pelo controle **Atualizar diagnóstico**. A primeira compilação 0.2.4 para o teste local do QR independe desta migração.
