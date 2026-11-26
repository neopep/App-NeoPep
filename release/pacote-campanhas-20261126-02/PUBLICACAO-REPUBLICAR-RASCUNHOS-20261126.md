# Publicação incremental — republicação e rascunhos — 26/11/2026

Autorizada pelo responsável, na ordem Produção → Teste. Domínio https://app.neopep.com.br, SHA servido 296d0c727ae73bb82210bb9194d746f2a203f24c, deployment dpl_3527wq2G9jfs4f9XASrJ7XMwbKhQ READY, alias confirmado. Rollback frontend anterior: dpl_33HHNeeZN8Fyr4j9GEzUjc8L7s6q.

CI https://github.com/neopep/App-NeoPep/actions/runs/45869266203: 535 web + 11 Connect aprovados, zero falhas, um ignorado na suíte web. A primeira CI falhou em expressão regular do teste da chave de recuperação de anexo; corrigida e revalidada sem relaxar a proteção. Smoke HTTP 200: /admin/, /admin/campaign-central.js?v=campanhas-central-11 e /admin/campaign-editor.js?v=campanhas-central-16, presença dos novos fluxos confirmada.

## Escopo
- Editar e republicar duplica em rascunho sem data, com anexos e histórico original preservados; exige nova confirmação de envio. Todas as ocorrências precisam estar resolvidas para disponibilizar a ação.
- Envio confirmado limpa apenas o rascunho local intacto e retorna à Central. Alterações pendentes podem ser recuperadas em novo rascunho, com referência ao anexo local anterior; não apaga conteúdo alterado nem dispara automaticamente.
- Correção binária do upload incluída; PDF direto já homologado pelo responsável no iPhone antes desta atualização.
- Nenhuma migração ou configuração de envio modificada nesta publicação. Nova permissão individual de compartilhamento da Biblioteca ainda não aplicada no banco; a candidata de Teste contém o frontend com fallback para permissões anteriores.
- Homologação real de legenda, republicação e recuperação no iPhone ainda pendente. Testes automatizados e smoke não comprovam envio real. Nenhuma mensagem disparada por este procedimento. Mercado Pago e IA preservados.

Próximo teste: abrir Documentos Externos, verificar rascunhos, editar e republicar com legenda somente no grupo Teste NeoPep, confirmar recebimento e retorno à Central.