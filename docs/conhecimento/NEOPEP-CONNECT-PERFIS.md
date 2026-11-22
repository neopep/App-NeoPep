# NeoPep Connect — perfis automáticos de Supabase (Windows 0.1.2)

## Objetivo

O aplicativo Windows não pede mais a chave pública do Supabase no login: a chave **sb_publishable_** é incorporada ao instalador. O operador informa somente e-mail e senha de sua conta NeoPep. A chave publicável identifica o aplicativo, não substitui a autenticação do usuário e não concede privilégios administrativos.

**Nunca** colocar credenciais de banco, senha de usuário, chave `sb_secret_`, `service_role` ou tokens pessoais no instalador.

## Ambientes isolados

| Perfil | Projeto Supabase | Status Connect | Armazenamento local |
|---|---|---|---|
| Teste | `neopep-staging` (qnuluspqfazdppciermw) | Habilitado, provedor simulado | `%LOCALAPPDATA%/NeoPep Connect` |
| Produção | `neopep` (cpslafpzjtbpmoxxysaa) | BLOQUEADO até homologar backend | `%LOCALAPPDATA%/NeoPep Connect Producao` |

Os dois perfis têm URL e chave publicável próprios e são compilados com símbolos condicionais. **Não existe seletor de ambiente** dentro do executável: para mudar de ambiente, deve-se instalar o artefato correspondente. Cada perfil tem mutex, pasta de sessão criptografada com DPAPI, chave de inicialização do Windows, entrada de desinstalação e atalho próprios.

O perfil de produção só fica preparado, sem conectar ao servidor Connect, porque as funções `public.neo_connect_device` e `public.neo_connect_admin` ainda não estão presentes no banco de produção. As opções de login e processamento do Connect ficam bloqueadas, sem tentativas automáticas.

Não atualizar o schema de produção, nem habilitar envios, nem distribuir o instalador de produção antes da revisão de segurança, migrações e homologação.

## Build Windows

Compilar com Windows 10/11 x64, .NET Framework e PowerShell:

```powershell
./connect/windows/build.ps1 -Perfil Teste -Output "$env:TEMP/NeoPepTeste"
./connect/windows/build.ps1 -Perfil Producao -Output "$env:TEMP/NeoPepProducao"
```

Os arquivos `manifest.json` registram versão, perfil, status Connect, tamanho e SHA-256 do instalador. O pipeline GitHub Actions compila os dois e verifica que os binários diferem, mas faz teste de instalação e distribuição somente do perfil de Teste. **Nunca** publicar a versão de produção na mesma área de instaladores do Teste.

O instalador de Teste `0.1.2` preserva o caminho e cofre DPAPI da versão `0.1.1`; ao iniciar, ignora/remove do estado em memória o valor antigo de chave pública salvo no cofre. A autenticação permanece por refresh token, e a senha não é salva.

## Critérios de liberação de produção

1. Portar as migrações de Connect para o ambiente de produção com revisão de permissões e privacidade.
2. Revisar registros, RLS, rotas administrativas e segregação de contas e organizações.
3. Validar URL do painel de produção e fluxo de autenticação; hoje o botão de abrir painel no perfil produção está intencionalmente desativado.
4. Compilar, testar e distribuir uma versão de produção **separada**, com metadados e checksum próprios.
5. Confirmar homologação de instalação/atualização, revogação, logout, proteção DPAPI e logs sem credenciais.
6. Implementar gradualmente o módulo real de WhatsApp somente após revisão de consentimento, segurança e condições do provedor.

Referência: https://supabase.com/docs/guides/getting-started/api-keys

## Integração 0.2.1

O candidato integra o pareamento experimental do PR #10 à configuração automática do PR #11. O perfil Teste aponta para o projeto `qnuluspqfazdppciermw`. A interface pede somente e-mail e senha. O perfil Produção tem configuração compilada distinta, mas o cliente bloqueia operações NeoPep e WhatsApp e seu instalador não inclui o runtime experimental. Os perfis têm diretórios, mutexes, inicialização e identidades de desinstalação separados. O GitHub Actions disponibiliza somente o artefato Teste.

Abra Visão geral para conferir ambiente e versão. Conta NeoPep reúne a autenticação, Computador mostra o seletor da sessão fictícia e Configurações reúne a inicialização com Windows. Diagnóstico mostra eventos locais sem credenciais. WhatsApp e Grupos abrem o pareamento experimental e os metadados de grupos. O QR e a sessão ficam no computador em um cofre DPAPI separado. Use somente um número próprio de teste. A biblioteca não oficial pode sofrer restrições pelo provedor.

Encerre o Connect na bandeja antes de atualizar. Confira o SHA-256 do EXE com o manifesto da mesma execução. Compare também perfil, commit, execução, tentativa e tamanho. Use a mesma conta Windows para atualizar sem desinstalar, tanto de 0.1.1 como de 0.1.2. A atualização preserva `session.dat`, diagnósticos e preferência de inicialização. Para recuperar a sessão, use a mesma conta que autorizou o computador. O programa valida o vínculo existente antes de persistir a nova sessão e mantém a identidade fictícia. Se o WhatsApp perder a rede, o bridge tenta reconectar com limite. Em revogação ou sessão substituída, confira o telefone. Se Desconectar WhatsApp remover apenas o cofre local, remova também o vínculo em Dispositivos conectados.

A aprovação depende de testes interativos em Windows 10 e 11, usando conta e grupo próprios de teste, e da revisão de assinatura do EXE. Confira QR, renovação, grupos, revogação e heartbeat do simulador no painel. Nenhum envio real faz parte desta versão. [PR #10](https://github.com/neopep/App-NeoPep/pull/10)
