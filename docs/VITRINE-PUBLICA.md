# Vitrine pública e cadastro comercial

## Auditoria inicial em 28 de novembro de 2026

| Ambiente | Referência Git | Evidência |
| --- | --- | --- |
| Produção | `bb92fa8827ed4f66bb05b8367b7e2a60e4732872` | Status Vercel de Produção aprovado no GitHub e SHA-256 de `shop.js` servido pelo domínio igual ao arquivo do commit. |
| Teste | `93242588351304fed03ce8e62406363b85162231` | Status Vercel de Teste aprovado no GitHub e SHA-256 de `shop.js` servido pelo domínio igual ao arquivo do commit. |

A comparação do JavaScript confirma a versão do arquivo. A associação atual dos aliases aos deployments ainda precisa ser confirmada no painel da Vercel.

As branches `desenvolvimento/pacote-campanhas-estatisticas-producao-20261127` e `desenvolvimento/pacote-campanhas-estatisticas-teste-20261127` contêm trabalhos financeiros paralelos. A branch da vitrine partiu da referência de Produção. O código de compartilhamento gera links canônicos de ambos os domínios oficiais e conserva o parâmetro `produto` e o fragmento `#loja`.

A auditoria remota do Supabase consultou metadados de tabelas e colunas. Ambos os projetos mantêm produtos, visibilidade, carrinhos e pedidos em `neo_private`. Teste possui estruturas de tarifas, avisos e políticas de parcelamento por produto ausentes de Produção no recorte consultado. A configuração versionada de Produção tem cadastro público e CAPTCHA habilitados. A de Teste tem os dois modos de cadastro e o requisito de CAPTCHA desabilitados. Os endpoints públicos de configuração do Supabase Auth confirmaram Google e Apple desativados nos dois ambientes. Produção permite cadastro por e-mail e informa autoconfirmação. Teste informa bloqueio de novos cadastros. A validação de confirmação de e-mail e OAuth requer um ambiente isolado com esses recursos habilitados.

## Integração pendente

- Reaproveitar catálogo, detalhe, promoção, galeria e temas de `dist/shop.js`. O shell público deve carregar somente as dependências comerciais. Manter o detalhe autenticado atrás das regras de visibilidade por membro existentes.
- Preservar `/?produto=ID#loja` e implementar `/?loja=1#loja`. A camada pública deve validar habilitação global, autorização individual e elegibilidade em cada consulta. Limitar campos e fotos, quantidade de resultados, frequência e validade de cache.
- Reutilizar Supabase Auth com consentimentos comerciais, confirmação de e-mail e recuperação de senha. Registrar a origem em estado controlado pelo servidor. A conclusão do cadastro comercial deve liberar o fluxo da loja sem alterar o estado de onboarding completo.
- Persistir a intenção da compra com prazo e destino interno. Consumir com idempotência depois da autenticação, revalidando preço, estoque e autorização antes de alterar o carrinho. Reutilizar checkout, parcelamento e confirmação de pagamento existentes.
- Integrar os controles e contadores à área Gerenciar Loja, a classificação à administração de usuários e as conversões aos eventos existentes. Confirmar pagamento por evento do servidor e respeitar preferências de privacidade.
- Executar homologação isolada com catálogo sintético, incluindo autorização, callbacks, pagamentos de teste e paridade visual em iPhone, Android, desktop, PWA e WhatsApp. Conferir os requisitos de divulgação e comercialização antes de habilitar a vitrine.

Nenhum produto foi consultado ou selecionado. Esta etapa não aplicou migrações nem alterou serviços. O rollback da consolidação de links consiste em reverter o commit correspondente na branch candidata.
