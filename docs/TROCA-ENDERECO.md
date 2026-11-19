# Troca do endereço técnico

Pendente, adiada a pedido do responsável enquanto ajustamos o Perfil. Não renomear antes dos ajustes de Turnstile e Supabase abaixo.

Endereço atual: https://elo-minha-evolucao.supplemast3.chatgpt.site
Nome solicitado: neopeptideos. Endereço proposto: https://neopeptideos.supplemast3.chatgpt.site (a disponibilidade e a URL final dependem da resposta da hospedagem).

Antes de mudar o slug:
1. Cloudflare Turnstile → widget utilizado pelo app → Hostname Management: adicionar `neopeptideos.supplemast3.chatgpt.site`, mantendo o antigo. Não alterar site key ou secret key.
2. Supabase → Authentication → URL Configuration → Redirect URLs: adicionar `https://neopeptideos.supplemast3.chatgpt.site/neo/`, mantendo o antigo. Não mudar o Site URL antes da troca.
3. Se as funções já estiverem em operação, planejar a troca coordenada de `ALLOWED_ORIGIN` (delete-account) e `SHOP_APP_URL` (Mercado Pago). Os handlers atuais aceitam uma origem configurada; não liberar wildcard. O valor futuro da primeira é a origem nova sem caminho; da segunda é a URL nova com `/neo/`.
4. Exportar dados exclusivamente locais antes da mudança. A nova origem não pode ler localStorage/IndexedDB da anterior. Registros da conta no Supabase permanecem, mas é preciso entrar novamente no endereço novo. Push/PWA também precisam de configuração e instalação nessa origem; não prometer migração automática ou redirecionamento permanente da hospedagem.

Após a hospedagem confirmar a troca: definir Site URL como o novo endereço de retorno `/neo/`, testar CAPTCHA, login, cadastro e confirmação/recuperação com conta descartável. Atualizar links divulgados. Manter callbacks antigos durante a transição de e-mails já enviados, se a hospedagem ainda servir o endereço anterior. Não afirmar que links antigos continuam funcionando sem verificar.

A limpeza da tela de login é independente e pode ser publicada no endereço atual. Não exige marcar a integração remota como validada nem desativar CAPTCHA.

Integrações novas: incluir a origem nova também em ALLOWED_ORIGINS das funções platform-integrations e ai-reply, mantendo origens em transição conforme necessário. Não trocar isso apenas no campo de referência da Administração.
