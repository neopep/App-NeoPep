# Estado atual — 12/11/2026

## Uma versão atual
NeoPeptídeos é o único aplicativo mantido e publicado. O pacote antigo foi removido de `dist/elo/` e `releases/elo-1/`. A recuperação do código antigo permanece possível pelo histórico Git; ele não precisa estar acessível na publicação. A identificação do Site foi atualizada para NeoPeptídeos. O endereço técnico existente é mantido até a conexão do domínio próprio, evitando quebrar links.

A raiz e `/neo/` entregam exatamente a mesma versão, gerada a partir de `dist/`. Não há dois aplicativos para evoluir. A compatibilidade evita quebrar confirmações de e-mail, recuperação de senha e PWAs instaladas. `authRedirectPath: '/neo/'` mantém o destino de autenticação já utilizado, inclusive quando o cadastro começa na raiz; parâmetros e códigos PKCE continuam sendo tratados pelo SDK oficial. A alteração é somente no frontend, sem SQL ou migração de contas.

## Preservação
Mesma origem, mesmo projeto Supabase, mesmas chaves de sessão e armazenamento. Não há exclusão, substituição nem migração automática de registros. A chave local anterior `elo-v1` continua sendo somente lida para oferecer backup/importação assistida. Remover código antigo não exige apagar dados antigos. Os dados atuais locais, IndexedDB, fotos e registros remotos mantêm seus identificadores.

## Funcionalidades mantidas
Autenticação por e-mail, confirmação e recuperação, sessão persistente opcional, perfil, pesos, medidas, diário, fotos, aplicações, calculadora matemática, relatórios, exportação/backup, calendário/lembretes, demonstração separada, comunidade, atendimento privado, biblioteca, administração, loja e estrutura de pagamento. Não houve alteração das fórmulas, das autorizações ou da modelagem remota.

## Pendências para lançamento público
- Empresa informada pelo responsável: NeoPeptídeos, CNPJ 69.782.060/0001-00. Contato de privacidade: privado1982@proton.me. Dígitos verificadores conferidos; situação cadastral e correspondência com a razão social não consultadas. Revisar os documentos e procedimentos de atendimento aos titulares antes da liberação pública.
- Validação remota de RLS, isolamento entre contas, permissões administrativas e funções publicadas. Dois cadastros funcionando não substituem testes de acesso indevido.
- SMTP próprio para entrega de e-mails em produção; confirmar a configuração real no Supabase.
- Conectar domínio quando houver acesso ao DNS, revisar Turnstile, redirects Supabase e URLs permitidas nas Edge Functions. Troca de domínio cria outra origem: sessões e dados exclusivamente locais não se transferem automaticamente.
- Revisar a regularidade de cada produto e anúncio antes de tornar a loja/carrossel públicos. O responsável informou que revisou o catálogo e removeu a retatrutida; conferir o resultado final antes da publicação pública.
- Mercado Pago depende de credenciais no servidor, publicação das funções e compra de teste validada. Google/Apple continuam desativados, conforme decisão anterior. Push depende de configuração do servidor e teste no dispositivo.
- Validar a instalação e atualização PWA e os fluxos reais no Safari/iPhone. Testes de DOM e contratos simulados não comprovam esses fluxos.

A consolidação não altera a audiência do Site nem libera o aplicativo publicamente.
