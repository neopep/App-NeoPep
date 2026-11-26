# Hotfix de upload de documentos — 26/11/2026

Produção: https://app.neopep.com.br, commit b0fd3709bf15c0dba321bbb81c1b9960593b81a9, deployment dpl_33HHNeeZN8Fyr4j9GEzUjc8L7s6q READY e alias confirmado. Deployment anterior para rollback frontend: dpl_HoDVJgDKkSXBGUQi8ZqTg6xLVtGF.

CI 45866460555: 529 web + 11 Connect aprovados, zero falhas, um ignorado. CI Teste 45866495144: 511 aprovados, zero falhas, um ignorado.

Diagnóstico: quatro requisições multipart ao Storage receberam HTTP 400 InvalidRequest / No content provided, content length 0. Correção: materialização ArrayBuffer com checagem de tamanho e identidade; MIME, limite e armazenamento privado preservados. Editor preserva o erro real e o rascunho. Smoke HTTP 200, cache neopeptideos-shell-20261126-integracao-65-upload-binario, referência SDK 20261126binary65 e código binário compilado confirmados. Sem migração, alteração de gate ou disparo de mensagem neste deploy.

Publicação limitada ao hotfix de Produção para homologação do PDF pelo responsável. Candidata de Teste inclui nova política de compartilhamento da Biblioteca, ainda não aplicada nem publicada. Teste real iPhone/WhatsApp pendente. Não declarar entrega confirmada por CI. Não apagar o rascunho antes de testar.
