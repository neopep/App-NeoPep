# Hospedagem futura na Vercel

Este guia prepara uma hospedagem futura sem substituir ou alterar a publicação atual em `app.neopep.com.br`.

## Projeto

- Framework preset: **Other**
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: versão LTS compatível com o `package-lock.json`

O arquivo `vercel.json` já preserva a compatibilidade dos caminhos `/neo/` e impede cache permanente do service worker.

## Supabase existente

Não crie outro projeto Supabase. A aplicação deve continuar apontando para o projeto existente. A URL, a chave publishable, a chave pública VAPID e a Site Key do CAPTCHA são configurações públicas do navegador e hoje ficam em `dist/config.js`.

Credenciais administrativas não pertencem à Vercel nem ao frontend. `SUPABASE_SERVICE_ROLE_KEY`, chaves do Mercado Pago, OpenAI, VAPID privada, Management API e segredos internos devem permanecer exclusivamente nos **Edge Function Secrets** do Supabase. Use `.env.example` apenas como inventário de nomes; nunca confirme valores reais no Git.

## Antes de trocar a produção

1. Crie um projeto Vercel conectado a este repositório privado, sem associar o domínio de produção.
2. Faça o primeiro deploy em uma URL de prévia.
3. Adicione essa origem temporariamente às origens permitidas das Edge Functions e aos redirects do Supabase Auth.
4. Valide login, CAPTCHA, recuperação de senha, Storage privado, comunidade, áudio, notificações, loja e webhooks.
5. Somente após validação, planeje a troca de domínio e mantenha os callbacks antigos durante a transição.

O deploy da Vercel não executa migrations automaticamente. As migrations em `supabase/migrations/` são histórico e infraestrutura; aplique somente as pendentes, na ordem e no projeto existente, após backup e revisão.
