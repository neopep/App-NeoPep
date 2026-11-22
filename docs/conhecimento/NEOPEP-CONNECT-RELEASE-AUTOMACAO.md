# Releases NeoPep Connect Windows Teste

## Importar o 0.2.5

O objeto de referência do Teste é `0.2.5/NeoPepConnectSetup.exe` no bucket privado `neo-connect-releases`, com 50.102.784 bytes e SHA-256 `314d03ffba3871da65ffb95df82fba3b35f19e4aba14038ef583590db7d9b759`. O manifesto assinado permanece sob custódia do proprietário.

Em homologação, configurar a Edge `connect-release-draft` somente em `qnuluspqfazdppciermw`, com `NEO_CONNECT_RELEASE_PUBLIC_JWK` contendo apenas a chave pública RSA `kty`, `n` e `e` correspondente ao cliente. Verificar JWT conforme a configuração do projeto. A função também valida sessão pelo Auth e executa a RPC administrativa sob a identidade do operador antes de tocar o Storage. A chave de serviço do ambiente permanece dentro da Edge.

Em **NeoPep Connect → Atualizações de Teste**, selecionar o JSON local e revisar versão e SHA-256 na confirmação. O servidor verifica RSA/SHA-256, lê e calcula o hash dos bytes do objeto privado e registra `draft` pela RPC existente, com a auditoria já aplicada. A mesma importação pode ser repetida para um rascunho idêntico. Registros conflitantes e objetos divergentes exigem revisão. Aprovação, indicação de obrigatoriedade e bloqueio continuam operações separadas.

## Releases seguintes

1. Instalar o [workflow proposto](../../release/connect/private-actions/neopep-connect-release.yml) em PR no repositório privado `neopep/NeoPep-Connect-Build-Privado`. Proteger a branch padrão e restringir mudanças do workflow aos responsáveis. Configurar a variável pública `CONNECT_PUBLISHER_PUBLIC_XML`. O workflow recebe SHA completo revisado e versão e confere o checkout, dependências, instalação, manifesto e SHA-256. Não inclua executáveis, certificados privados ou sessões no repositório.
2. Na conta Windows custodiante, com GitHub CLI já autenticado no repositório privado, executar `release/connect/prepare-release.ps1` com `-RunId`, `-SourceSha`, `-Version`, `-SigningThumbprint` e a chave **publicável** do Supabase Teste em `-PublishableKey`. O comando verifica metadados autenticados do Actions, baixa o artefato, confere EXE e pin, assina usando RSA CNG não exportável e valida a própria assinatura. O EXE não é executado na máquina de assinatura.
3. Confirmar digitando `RASCUNHO`. A identidade administrativa do Teste é solicitada localmente. O endpoint autoriza somente aquele caminho de Storage, sem sobrescrita. A URL de upload do SDK expira em duas horas e deve permanecer em memória. O cliente faz o PUT e chama novamente a Edge para recalcular o hash do objeto e registrar rascunho. A autorização não permite listar, baixar, excluir ou substituir objetos. O limite é 50 MiB. Se a transferência falhar, executar novamente. Um objeto existente será conferido byte a byte antes do cadastro. URLs e sessões não são impressas.
4. Depois da revisão, o administrador pode aprovar em operação separada no painel Teste, com obrigatoriedade inicialmente desmarcada. No Windows, a instalação exige **Atualizar agora** e confirmação. Valide preservação do cofre DPAPI, autorização do computador, sessão WhatsApp e recuperação. Bloqueie a versão se houver divergência.

A restrição de downgrade na Edge compara com o estado lido antes do cadastro. A chave única de versão protege a corrida para o mesmo número. A validação entre versões diferentes não substitui um bloqueio transacional no banco; use um operador por vez durante a homologação. O cliente preserva a rejeição de downgrade.

## Pendências de homologação

Configurar a chave pública e implantar a Edge no Teste, validar o PUT e o GET reais do Storage, importar o JSON 0.2.5 com o proprietário, validar o comando Windows e abrir PR do workflow no repositório privado com acesso autorizado. Nenhum release é aprovado pela automação. O manifesto assinado e sessões do Windows ficam com o responsável.
