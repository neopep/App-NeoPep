# Uso do NeoPeptídeos

O aplicativo atual abre na página principal da hospedagem. Links anteriores em `/neo/` continuam acessando a mesma versão. Não existe mais uma edição antiga publicada na raiz ou em `/elo/`.

Para instalar no iPhone, abra o endereço HTTPS pelo Safari e escolha Compartilhar → Adicionar à Tela de Início. Uma instalação anterior em `/neo/` continua com esse endereço de compatibilidade. A atualização do service worker segue o fluxo de atualização já existente no aplicativo; instalação e atualização precisam ser conferidas no dispositivo real.

Contas e registros continuam no mesmo projeto Supabase. A sessão persistente usa a origem do site e a opção Manter conectado; não guarda a senha. Ao sair, a sessão local é removida. Em outro domínio ou navegador será necessário entrar novamente. Dados exclusivamente locais devem ser exportados antes de trocar de origem.

Registros locais anteriores continuam disponíveis para backup e importação assistida no Perfil. A importação exige confirmação e não apaga o original. JSON não contém as fotos; elas possuem exportação separada. Demonstração utiliza registros fictícios separados dos reais.

A prévia HTML portátil em `artifacts/NeoPeptideos-previa.html` serve para revisão, não para instalação PWA nem validação de OAuth ou notificações em segundo plano. Nenhuma credencial privada é incluída.

Veja [estado atual e pendências](CONSOLIDACAO.md). Os demais relatórios do projeto incluem o histórico de implementação; menções à preservação de um aplicativo antigo na raiz foram substituídas pela consolidação atual.
