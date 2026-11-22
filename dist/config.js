/* Apenas configuração pública. Nunca inserir service_role ou segredos aqui. */
window.NEO_CONFIG = Object.freeze({
  supabaseUrl: 'https://cpslafpzjtbpmoxxysaa.supabase.co',
  supabasePublishableKey: 'sb_publishable_jZGrvy0CyOpXlaSiCooRdw_7Z2D_-1Y',
  authRedirectPath: '/neo/', // Compatibilidade com os callbacks já configurados no Supabase.
  pushVapidPublicKey: 'BBv4hvbD7C4b99L90B8r1QiOqpEMSvL6DqcJd22QUq4hNMdiHcsS14PXT21lGUjS74QmASan09lAeJ_GWwFtXIE', // Chave pública VAPID; a privada permanece somente no Supabase.
  providers: { google: false, apple: false, email: true },
  privacyContact: 'neopeptideos@proton.me',
  cloudValidated: false, // A publicação não equivale à homologação externa de Auth e pagamentos.
  connectEnabled: true, // Produção: canal próprio, banco e credenciais independentes do Teste.
  campaignActivationEnabled: true, // Administração e campanhas ficam disponíveis com as regras e consentimentos SQL.
  captchaRequired: true,
  captchaSiteKey: '0x4AAAAAAGAwsdQjxAWnkGLM',
  controllerName: 'NeoPeptídeos', // Empresa informada pelo responsável.
  controllerCnpj: '69.782.060/0001-00', // Dígitos conferidos; situação cadastral não consultada.
  legalVersion: '2026-11-v1',
  publicRegistration: true, // Intenção confirmada: cadastro aberto ao público, sujeito ao gate de publicação.
  previewRegistration: false
});
