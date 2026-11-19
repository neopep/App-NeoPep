# Lançamento em fases — NeoPeptídeos

## O que estamos preparando
1. Web mobile: mesmo aplicativo, abrindo por link em Safari/Chrome, com instalação PWA na tela inicial. Não precisa de conta Apple/Google de desenvolvedor para essa instalação. A página continua restrita pela hospedagem até a mudança de audiência, separada do login Supabase.
2. Lojas: pacotes iOS e Android com Capacitor, reaproveitando interface e Supabase. Projeto inicial documentado em `mobile/`; binários e integrações nativas ainda não implementados. Não há promessa de aprovação automática das lojas nem data de entrega antes da configuração/testes.

## Ordem executável para a versão web
1. Identificar o domínio e acesso ao DNS. Decidir o endereço público definitivo ou usar temporariamente o endereço HTTPS da hospedagem. Domínio próprio não é obrigação técnica para abrir a web, mas domínio de envio verificado será necessário no fluxo SMTP escolhido.
2. Configurar Resend/SMTP seguindo [EMAIL-PRODUCAO.md](EMAIL-PRODUCAO.md). O responsável confirmou que ainda não possui SMTP configurado.
3. Ajustar Site URL/Redirect URLs exatas e Turnstile para a URL escolhida. Manter `/neo/` compatível. Nenhuma conta ou dado Supabase é recriado.
4. Executar `release/auditoria-supabase.sql` no SQL Editor e revisar resultados. É somente leitura de metadados; não contém registros de saúde. Não reaplicar instaladores antigos sem avaliar as migrações já instaladas.
5. Testar com duas contas descartáveis: Auth real, isolamento de leitura/escrita, Storage, autorização administrativa, exportação, recuperação e exclusão. A função de exclusão precisa estar publicada; código local não comprova implantação remota.
6. O responsável informou que revisou o catálogo e retirou a retatrutida. Conferir o resultado na versão final, incluindo carrossel, pesquisa e possíveis links anteriores. Não foi feita consulta aos produtos privados do banco nesta etapa. Pagamentos continuam dependendo da integração Mercado Pago e teste completo; não alterar `payments_ready` para eliminar avisos.
7. Revisar retenção, região de processamento, fornecedores, direitos dos titulares e atendimento. Nome, CNPJ e contato já foram informados; não foi consultada a situação cadastral da empresa.
8. Validar iPhone/Android reais: login, teclado, anexos/áudio, atualização de conversas, perda de conexão, instalação e atualização PWA. Notificações com app fechado dependem de push real; se forem adiadas, documentar os limites da versão inicial.
9. Definir backup de banco E arquivos, recuperação, monitoramento de Auth/Edge/erros e responsável por operação. Acompanhar cotas Supabase, e-mails e mídia da comunidade.
10. Registrar evidências em `release/web-readiness.json` e executar `npm run release:check`. O comando aponta pendências; não certifica segurança, não altera flags e não publica.
11. Depois da validação, atualizar `cloudValidated`, habilitar cadastro público e desabilitar cadastro de prévia de forma coordenada. Só então usar a ferramenta da hospedagem para trocar acesso restrito por público. Esse acesso público não revela dados: o controle por conta continua obrigatório no Supabase.
12. Repetir um cadastro real de teste fora da conta ChatGPT do proprietário. Verificar que o visitante chega diretamente ao login NeoPeptídeos, sem uma tela de login do ChatGPT.

## Página de exclusão
`/excluir-conta/` foi acrescentada como recurso web para orientar a exclusão pelo Perfil ou solicitação ao contato de privacidade. Não recolhe senha nem dados de saúde e não simula exclusão automática por e-mail. A URL só será pública quando a hospedagem for liberada. É preciso operar o atendimento e validar a função autenticada de exclusão.

## Preparação das lojas
Ver `mobile/README.md`. Contas empresariais e dados da organização precisam ser verificados. Apple exige adesão ao Developer Program (US$ 99/ano, ou preço local aplicável) e normalmente D-U-N-S para organização. Google cobra US$ 25 de cadastro; requisitos de testes variam conforme tipo/data da conta. Não foi contratada nenhuma adesão.

Antes da submissão:
- Funcionalidade nativa e qualidade suficientes, além de empacotar uma página web; aprovação depende da revisão.
- Login por e-mail pode permanecer como opção inicial. Se forem acrescentados provedores sociais, avaliar também as exigências de login equivalente da Apple.
- Comunidade: controles de denúncia, bloqueio, moderação e contato. Foram retirados da interface anteriormente; sua ausência deve ser resolvida antes de enviar às lojas.
- Declarações de saúde, privacidade e segurança de dados fiéis ao que o aplicativo coleta; avaliar regras de calculadoras e conteúdo relacionado à saúde.
- Exclusão de conta no app e recurso web, políticas acessíveis, classificação etária, screenshots reais e credenciais de teste para revisão.
- Integração nativa de links de confirmação, armazenamento seguro, mídia/áudio e notificações APNs/FCM, com testes nos aparelhos.

Fontes oficiais:
- https://capacitorjs.com/docs
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/programs/enroll/
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/14738291
- https://support.google.com/googleplay/android-developer/answer/13327111
