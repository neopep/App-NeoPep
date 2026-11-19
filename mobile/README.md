# Preparação para iOS e Android

Estado: arquitetura e configuração de exemplo preparadas. Não há binário iOS/Android compilado, assinado, testado ou enviado às lojas. O exemplo não é uma configuração nativa ativa.

## Decisão técnica
Manter a interface web atual e o mesmo Supabase. Utilizar Capacitor para empacotar os arquivos locais de `dist/` e integrar recursos nativos. Não carregar o site remoto por `server.url` como substituto do aplicativo. As contas podem ser as mesmas entre plataformas, mas o usuário entra separadamente; sessões e armazenamento local não se transferem automaticamente.

`capacitor.config.example.json` deve ser revisado e copiado para a raiz ao iniciar a implementação nativa. `com.neopeptideos.app` é uma proposta de identificador, ainda sem registro ou verificação de disponibilidade. Escolher o identificador definitivo antes de registrar os aplicativos. O `webDir` é relativo à raiz do projeto.

## Implementação necessária antes de compilar
1. Instalar versões oficiais compatíveis e fixadas de Capacitor core, CLI, iOS e Android; gerar os projetos nativos no mesmo repositório, sem recriar os módulos web.
2. Separar inicialização PWA da nativa: não registrar service worker no pacote nativo. Manter assets empacotados e updates pelas lojas.
3. Implementar adaptador de sessão com armazenamento seguro em Keychain/Keystore; o localStorage atual do navegador não deve ser apresentado como armazenamento seguro nativo.
4. Configurar App/Universal Links, PKCE e Browser/App plugins para confirmação/recuperação/OAuth; cadastrar callbacks específicos no Supabase. O `/neo/` web atual não resolve automaticamente o retorno ao aplicativo instalado.
5. Validar Turnstile em fluxo compatível com o aplicativo nativo. Não desligar CAPTCHA para contornar problemas no WebView.
6. Adequar CORS das funções às origens nativas estritamente necessárias, preservando a autenticação. Não usar wildcard ou trocar uma origem web pela nativa sem preservar ambas.
7. Implementar câmera/seletor de fotos, gravação de áudio, compartilhamento e arquivos com permissões mínimas e textos de justificativa do sistema.
8. Notificações nativas: APNs no iOS e FCM no Android, tokens por usuário/dispositivo e remoção no logout. VAPID/Web Push da PWA não substitui esse fluxo.
9. Notificações locais agendadas podem complementar os lembretes. Revisar fuso, cancelamento, duplicação e ações com o app fechado.
10. Comunidade: restaurar controles discretos de denúncia e bloqueio de usuários, tratamento administrativo e regras de conteúdo. Atual desenho sem esses controles não está pronto para submissão às lojas.
11. Revisar conteúdo de saúde/calculadora e catálogo; não prometer aprovação regulatória ou das lojas. Pagamento de bens físicos e venda futura de conteúdo/assinaturas digitais exigem tratamentos distintos segundo as regras aplicáveis.

## Contas e entrega
- Apple Developer em nome da organização: razão social verificável, D-U-N-S e titular autorizado; adesão paga. Compilação/assinatura iOS requer ambiente macOS/Xcode ou serviço de build autorizado. Não há assinatura Apple configurada neste ambiente.
- Google Play Console: conta empresarial, verificação da organização, dados de suporte e cadastro pago. Conferir requisitos aplicáveis à conta; não assumir que testes obrigatórios de contas pessoais se aplicam igualmente a organizações.
- Preparar ícones/splash, screenshots reais, classificação etária, declaração de saúde, App Privacy/Data Safety, URL pública de privacidade e exclusão, conta de revisão, TestFlight e teste interno Android.
- Não declarar coleta zero: o app trata conta, saúde, fotografias, conversas e, se a loja operar, endereço/pedidos. Declarar conforme as funcionalidades realmente publicadas.

Referências oficiais: https://capacitorjs.com/docs ; https://developer.apple.com/app-store/review/guidelines/ ; https://developer.apple.com/programs/enroll/ ; https://support.google.com/googleplay/android-developer/answer/14738291 ; https://support.google.com/googleplay/android-developer/answer/13327111
