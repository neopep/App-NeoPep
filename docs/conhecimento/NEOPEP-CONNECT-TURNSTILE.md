# Login Windows com Turnstile

A 0.2.8 usa o widget público já configurado para o domínio oficial em um diálogo WebView2. A página temporária é servida em memória ao WebView2 sob o hostname oficial de Produção. O retorno confere URL de origem, nonce, prazo e uso único. E-mail e senha ficam no formulário nativo. Só o grant de senha recebe o token em `gotrue_meta_security.captcha_token`. Teste mantém o fluxo existente, sem reutilizar chave ou token de Produção.

O setup inclui o SDK fixado por SHA-256 e o loader x64. O Microsoft Edge WebView2 Runtime Evergreen deve estar instalado no Windows. O diálogo informa quando ele está ausente. O CAPTCHA real, incluindo a validação do hostname da chave no Turnstile, depende do ensaio em Windows.

## Ensaio

1. Em Teste, atualizar de 0.2.7 para o rascunho 0.2.8 quando autorizado. Conferir login, sessão restaurada, grupos e QR. Aguardar a aprovação independente de cada ambiente.
2. Em Produção, abrir o diálogo e completar o Turnstile. A primeira sessão válida deve registrar o computador como pendente. Após aprovação pelo painel oficial, aguardar o heartbeat. Confirmar que Teste mantém sua sessão.
3. Exercitar cancelamento, expiração, recusa, credenciais inválidas, rede indisponível e ausência de autorização de registro. Reabrir o diálogo em cada nova tentativa.
4. Validar o artefato privado, a assinatura do manifesto, Authenticode quando aplicável e o upgrade com confirmação explícita. O CI público roda apenas com dados fictícios e não publica o EXE.

[Issue #33](https://github.com/neopep/App-NeoPep/issues/33)
