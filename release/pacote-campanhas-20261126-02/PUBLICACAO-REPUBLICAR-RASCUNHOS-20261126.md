# Publicação incremental — republicação e rascunhos — 26/11/2026

Autorizada pelo responsável, na ordem Produção → Teste. Domínio https://teste.app.neopep.com.br, SHA servido 3e68e4e1ba9bc8d064f0c126d21e7a6b0d756456, deployment dpl_GmBRZCeSzEkP3JFH3ogAME9gZXXX READY, alias confirmado. Rollback frontend anterior: dpl_Fp2znKXqKvFS3a25BtziU5ii9orv.

CI https://github.com/neopep/App-NeoPep/actions/runs/45869273035: 517 web aprovados, zero falhas, um ignorado na suíte web. A primeira CI falhou em expressão regular do teste da chave de recuperação de anexo; corrigida e revalidada sem relaxar a proteção. Smoke HTTP 200: /admin/, /admin/campaign-central.js?v=campanhas-central-11 e /admin/campaign-editor.js?v=campanhas-central-16, presença dos novos fluxos confirmada.

## Escopo
- Editar e republicar duplica em rascunho sem data, com anexos e histórico original preservados; exige nova confirmação de envio. Todas as ocorrências precisam estar resolvidas para disponibilizar a ação.
- Envio confirmado limpa apenas o rascunho local intacto e retorna à Central. Alterações pendentes podem ser recuperadas em novo rascunho, com referência ao anexo local anterior; não apaga conteúdo alterado nem dispara automaticamente.
- Correção binária do upload incluída; PDF direto já homologado pelo responsável no iPhone antes desta atualização.
- Nenhuma migração ou configuração de envio modificada nesta publicação. Nova permissão individual de compartilhamento da Biblioteca ainda não aplicada no banco; a candidata de Teste contém o frontend com fallback para permissões anteriores.
- Homologação real de legenda, republicação e recuperação no iPhone ainda pendente. Testes automatizados e smoke não comprovam envio real. Nenhuma mensagem disparada por este procedimento. Mercado Pago e IA preservados.

Próximo teste: abrir Documentos Externos, verificar rascunhos, editar e republicar com legenda somente no grupo Teste NeoPep, confirmar recebimento e retorno à Central.