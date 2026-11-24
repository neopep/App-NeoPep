# NeoPep — Plano Mestre de Evolução (13 ajustes)
**Versão:** 1.0 — 24/11/2026  
**Status:** especificação funcional consolidada; implementação NÃO iniciada  
**Repositório:** neopep/App-NeoPep  
**Ambientes:** Teste e Produção; não modificar Produção antes de validar Teste  
**Regra:** este documento registra decisões e propostas; não comprova funcionalidades implementadas. A auditoria do código e dos bancos é obrigatória.

## 0. Diretrizes e decisões transversais
- Executar do mais simples ao mais complexo, em lotes pequenos e verificáveis.
- Antes de modificar, auditar branch ativa, PRs, implementações recentes, Supabase (schemas, RLS, migrations), Vercel, Teste/Produção, integração Windows e automações.
- Preservar a última versão aprovada, dados reais e as funcionalidades já operacionais. Evitar duplicar módulos ou campos.
- Mercado Pago da loja/webhook de produção está funcionando segundo relato do responsável; **não alterar esse fluxo** sem evidência de necessidade e autorização específica.
- Não confundir simulação/preview com status real, envio real ou confirmação de entrega.
- Ações administrativas auditáveis, autorizadas no servidor, idempotentes e com prevenção de duplicidade.
- UI responsiva mobile/PWA, visual NeoPep, acessibilidade, loading/empty/error states, segurança e LGPD.
- Acesso ao app, biblioteca, comunidade, pagamentos e notificações deve respeitar as permissões reais.
- Novas funcionalidades podem exigir programação inicial; **depois** devem ser atribuíveis a planos sem mudar código.
- Para cada lote: inventário do existente → proposta de delta → implementação em Teste → QA → evidência → aprovação → publicação em Produção → monitoramento.
- Criar documentação consultável no painel administrativo futuramente (menu «Planejamento / Evolução»), com filtros por fase, status, prioridade e histórico. Este arquivo é a fonte versionada inicial, não a tela implantada.

## 1. Catálogo de ajustes

### #001 — Localização no onboarding
**Decidido:** após cadastro/primeiro login, apresentar tela explicativa de solicitação de localização; permissão opcional, consentimento claro, respeitar suporte e limites do browser/PWA/iOS/Android; não ativar rastreamento em segundo plano. Preservar restante do onboarding. 
**Aceite:** aceitar/recusar/indisponibilidade não bloqueiam acesso; persistência e revogação coerentes; sem prompt repetitivo.

### #002 — Consentimento de personalização e analytics
**Texto aprovado:** título «Personalize sua experiência»; descrição «Permita que o NeoPep personalize sua experiência e melhore nossas comunicações.»; botões «Permitir personalização» e «Agora não».
**Decidido:** tela imediatamente após localização; consentimento explícito e revogável, respeitar ATT onde aplicável; não enviar dados sensíveis de saúde para pixels publicitários; preservar demais fluxos.
**Aceite:** sem consentimento não disparar eventos opcionais; permitir revisão da preferência.

### #003 — Tema claro/escuro
**Decidido:** manter tema escuro exatamente como está. Tema claro: navy #142743, branco #FFFFFF, gelo #F4F5F6, prata perolado #E2E5EA, lavanda fria #A8B4CC, texto principal #253449, secundário #697789, bordas #D8DEE6, azul interativo #223F63, fundo alternativo #EDF0F4. Distribuição aproximada 70% branco/gelo, 20% navy, 10% prata/lavanda; cards glass leitosos translúcidos (~78% branco como guia), sem neon, dourado ou degradês excessivos.
**Decidido:** chave horizontal pequena no cabeçalho da Home ao lado do Painel Admin (esquerda claro/direita escuro); padrão acompanha sistema, inclusive mudança dinâmica; override manual persistente, opção voltar ao sistema, sem flash de tema incorreto. 
**Aceite:** todas telas e modais legíveis, responsivos e acessíveis; tema escuro inalterado.

### #004 — Minha alimentação (módulo completo)
**Decidido:** substituir «Em breve» por painel nutricional com calorias consumidas/meta/restante, macros (proteínas, carboidratos, gorduras), água, refeições, histórico diário/semanal, tendências, objetivos, planejamento semanal, receitas, substituições, lista de compras, fotos de alimentos e integração com peso/perfil.
**IA:** preparar para agente nutricional futuro, mas NÃO integrar IA ainda; sem simular estimativas como se fossem IA real. No futuro, foto → sugestão de ingredientes/calorias → confirmação pelo usuário.
**Dados:** avaliar fontes nutricionais TBCA/TACO e licenças; proteger informações pessoais com RLS, limites de plano e privacidade; nada sensível para pixels.
**Aceite:** persistência correta, cálculos confiáveis, metas editáveis, UI vazia/erro, sem alegações médicas.

### #005 — «Minhas comparações» no chat/grupo
**Decidido:** substituir modal pequeno só com datas por modal responsivo maior (até ~85vh) com fotos reais Antes/Depois lado a lado, datas, galeria rolável, seleção e compartilhamento existente. Estado vazio amigável e CTA para criar em Fotos/Comparações; CTA também quando já existem comparações. Fechar e retornar ao chat. Confirmação antes de compartilhar.
**Aceite:** miniaturas reais, privacidade preservada, sem compartilhamento automático.

### #006 — Miniatura de PDF em destaque na Home/Biblioteca
**Problema relatado:** cartão «Guia Definitivo dos Peptídeos» exibe miniatura vazia e texto «PDF» azul desproporcional.
**Decidido:** identificar causa real; miniatura da primeira página gerada/cached em WebP/AVIF pequeno, proporção reservada, skeleton/fallback contido, cache/invalidação. Preservar carrossel, navegação e leitor.
**Aceite:** sem vazamento visual do texto PDF, sem layout shift perceptível, fallback elegante.

### #007 — Texto e atendimento na Loja
**Decidido:** trocar «Escolhas para sua jornada» por «Encontre o que você procura.»; adicionar ícone discreto de atendimento e «Não encontrou o que procura? Fale com nosso atendimento para consultar a disponibilidade.» direcionando ao suporte existente. Exibir «Pagamento com Mercado Pago» e mensagens de proteção do comprador somente se juridicamente precisas, sem promessa de garantia universal. Preservar produtos, preços, carrossel, checkout/webhook. Evitar alegações terapêuticas não sustentadas ou divulgação de produtos não autorizados.
**Aceite:** textos e links corretos, checkout intocado.

### #008 — Fixar publicações na Biblioteca
**Decidido:** administradores podem fixar/desafixar múltiplos posts, ordenar os fixados, ícone discreto, persistência Supabase. Fixados antes dos demais respeitando categoria, busca, filtros e permissões. Não adicionar automaticamente aos destaques da Home.
**Aceite:** ordenação estável, não vazar itens restritos.

### #009 — Seringa no card da calculadora na Home
**Decidido:** reutilizar exatamente o componente de seringa do RESULTADO da calculadora existente, não redesenhar. Se usuário tem cálculo/dose salvo, mostrar o último, com volume/capacidade/marcações e preenchimento corretos. Se não tem, seringa vazia sem números fictícios. Toque abre calculadora e, se viável, contexto salvo. Atualizar após alteração/exclusão. Preservar três cards de capacidade da seringa e calculadora atual; não recomendar doses.
**Aceite:** dados por usuário, vazio correto, sem divergência entre Home e resultado.

### #010 — Auditoria de estoque, custos e lucro
**Decidido:** cada produto já tem campo de quantidade disponível; NÃO criar outro. Verificar se vendas pagas debitam estoque, idempotência de webhook, concorrência/overselling, cancelamento/estorno e log de movimentações. Preservar Mercado Pago atual.
**Custos:** campo opcional custo de aquisição USD ou BRL, taxa histórica USD→BRL (opcional), data de compra, taxas/frete/impostos opcionais. Custo ausente = lucro desconhecido, nunca custo zero inventado. Congelar snapshot de custo/taxa por item de pedido na venda para não alterar margem histórica. Distinguir lucro bruto/líquido.
**Dashboard:** estender cards e totalizador já existentes na gestão da Loja, sem criar dashboard redundante; receita, CMV, lucro bruto, margem, inventário, detalhamento por produto e período. Custos só para admins.
**Aceite:** reconciliação de vendas/estoque e histórico auditável; sem regressão do checkout.

### #011 — Gestão em massa de preços e estoque
**Decidido:** dentro Loja → Gerenciar, adicionar «Gerenciamento em massa» com abas «Preços», «Estoque», «Ambos», tabela de produtos existentes, busca/filtros, seleção individual/todos, preço e estoque atuais vindos do banco. Editar linha a linha sem abrir cada produto.
**Preços:** alteração em %, valor fixo BRL, ou proporcional a câmbio USD antigo/novo; prévia antes/depois; arredondamento opcional.
**Estoque:** definir quantidade final, adicionar ou subtrair unidades em massa; tipos de movimentação (venda, reposição, correção, devolução); auditoria.
**Segurança:** validação e confirmação antes de aplicar, histórico por lote, reversão quando segura, controle de concorrência com vendas/edições simultâneas, sem sobrescrever estoque desatualizado.
**Aceite:** sem divergência no estoque, prévia fiel, atualização atômica ou falhas detalhadas.

### #012 — Assinaturas e Pagamentos (administrativo e PWA)
**Decidido:** menu principal do Painel Administrativo «Assinaturas e Pagamentos», com Planos, Funcionalidades, Assinantes/Gerenciar acessos, Pagamentos, Relatórios e Integrações.
**Planos:** criar, editar, ativar/desativar oferta, preço, periodicidade, descrição, benefícios, limites, teste grátis, cortesias, versões e histórico sem reprogramar. Planos exemplificativos Free, Premium, Premium Plus — nomes/preços finais não definidos. Desativar novas vendas não cancela automaticamente assinantes existentes.
**Catálogo de recursos:** peso (dias/registros), medidas, gráficos, fotos/comparações, calculadora, biblioteca, alimentação, grupos/comunidade, IA (créditos/mensagens/tokens), exportações e futuros recursos. Ativar/desativar por plano, limitar por dias/usos/cotas, acesso ilimitado, janela de renovação, regras de excedente. Controle aplicado no servidor; dados históricos não apagados ao perder acesso.
**Por usuário:** buscar usuário por nome/e-mail, atribuir plano manualmente, liberar grátis por 7/30/90/365 dias ou personalizado/permanente, upgrade/downgrade, suspender/revogar concessão, liberar recurso individual fora do plano, registrar motivo/autor/data/validade. Acesso também por Admin → Usuários → Gerenciar assinatura. Diferenciar concessão manual de assinatura financeira; não cancelar nem mudar cobrança recorrente sem ação específica e aviso.
**Pagamentos:** PWA inicialmente Mercado Pago API de Assinaturas; cobrança recorrente e eventos próprios, status, renovação, falha, cancelamento, reembolso, idempotência e reconciliação. NÃO alterar webhook da loja sem necessidade. «Minha assinatura» para usuário com plano, limites, benefícios, próxima cobrança e gerenciamento.
**Lojas futuras:** arquitetura de provedor desacoplada para Apple In-App Purchase e Google Play Billing, com direitos centralizados, validação de recibos/renovações, restauração de compras e conformidade com políticas vigentes; integrações das lojas NÃO serão feitas agora. Não presumir que pagamento web pode ser usado dentro de apps nativos para recursos digitais.
**Aceite:** painel controla planos/limites sem deploy, concessões funcionam sem cobrança, segurança server-side, cobrança recorrente testada antes de produção.

### #013 — Central Integrada de Campanhas, WhatsApp e NeoPep Connect
**Escopo aprovado:** manter duas abas existentes **App** e **WhatsApp**, cada uma listando suas campanhas. Preservar o criador atual do App para campanhas internas/notificações push. Substituir somente a experiência de criação/edição do WhatsApp por editor visual full-screen. Preservar **Publicações/esteira**, **Grupos** e **NeoPep Connect** com suas abas, configurações e infraestrutura já construídas; não criar módulos paralelos.
**Editor WhatsApp:** ocupa toda área útil do dispositivo com safe areas, teclado e responsividade; aparência limpa semelhante a conversa WhatsApp, campo de digitação inferior, confirmação que move texto para prévia, edição/reordenação dos blocos, autosave de rascunhos, ações compactas por botões/painéis: anexos (+), pincel de formatação, grupos, esteira, programar, publicar agora e acesso Connect. O editor deve permanecer aberto ao voltar de configurações.
**Formatação:** aplicar em trecho selecionado; negrito *texto*, itálico _texto_, riscado ~texto~, monoespaçado com crases e outros formatos realmente suportados. Renderizar visualmente na prévia, enviar caracteres literais para o conector. WhatsApp comum NÃO suporta cor de fonte nem sublinhado nativo: não simular esses estilos como se fossem enviados.
**Anexos:** fotos, documentos, links, produtos da Loja, materiais da Biblioteca, publicações da Comunidade. Imagem com legenda no mesmo envio OU imagem como mensagem separada do texto, respeitando capacidade real do conector; múltiplas imagens com ordem explícita.
**Produtos:** seletor pesquisável dos produtos reais com foto, nome, preço, disponibilidade; montar cartão/imagem promocional e texto customizável, link profundo para produto no NeoPep, CTA «Ver produto/Comprar» como link ou recurso interativo SOMENTE se canal suportar; não prometer botão nativo se automação Windows não oferecer. Revalidar preço e disponibilidade antes de enviar; sem conteúdo de produto duplicado desatualizado.
**Biblioteca:** selecionar material/post real, capa, título, descrição, prévia, link profundo e/ou arquivo quando permitido; manter acesso Premium e permissões.
**Comunidade:** selecionar publicações de membros por busca/autor/data; prévia, texto complementar e link ao original; respeitar privacidade, visibilidade e autorização de compartilhamento.
**Grupos Windows:** sincronizar grupos reais acessíveis ao NeoPep Connect (nome, ID, número de membros se disponível), pesquisar, selecionar um/vários/todos, salvar destinos por campanha, atualização manual/automática, grupos indisponíveis, conferir acesso antes do envio. Respeitar regras e limites WhatsApp; não presumir API oficial de envio para grupos.
**Status real Connect no topo:** distinguir aplicativo Windows online, sessão WhatsApp válida, sincronização de grupos, capacidade de envio, último heartbeat e horário de última sincronização. Estados Conectado/Pronto, Sincronizando, Desconectado, Desconhecido/Erro, sem exibir verde com base em dado simulado ou obsoleto. Ação Sincronizar e atalho ao NeoPep Connect; rascunho não se perde. Publicar exige verificação de pré-condições reais; agendar pode ser permitido com aviso de conexão, verificando novamente na execução.
**Fluxo mínimo:** 1) compor na prévia; 2) selecionar grupos; 3) publicar agora ou programar, com confirmação. Não exigir salvar campanha e depois ir criar publicação separada. Salvar rascunho automaticamente.
**Esteira existente:** publicar agora cria registros de execução e os coloca em fila; programar cria agendamento. Estados rascunho, programado, na fila, enviando, enviado, falhou, cancelado, eventualmente parcial; só marcar «Publicado/Enviado» após confirmação real do conector. Histórico por grupo/canal, retry apenas destinos falhos, idempotência, sem duplicar.
**App ↔ WhatsApp:** no editor WhatsApp, opção «Publicar também no aplicativo» tanto no envio imediato quanto no agendamento; adaptar título, texto, imagem, push e destino. Na aba App, ação «Criar também no WhatsApp» em campanha existente, abrindo o novo editor pré-preenchido para adaptar. Preservar a original; campanha matriz com versões por canal, publicações/agendamentos/status independentes mas vinculados. Compatibilidade de formatos revisada antes de enviar; não copiar automaticamente mídias não suportadas.
**Conexão e infraestrutura:** inspecionar implementação atual do NeoPep Connect Windows, PRs/abas, mecanismo de sync, sessão, grupos, filas e confirmação real. Documentação histórica da versão 0.1.1 relatou modo simulado; NÃO concluir que versão atual continua simulada sem inspeção. Preservar configurações existentes.
**Aceite:** criar e agendar com poucos passos, status verdadeiro, visualização fiel ao formato suportado, seleção múltipla de grupos, reaproveitamento bidirecional App/WhatsApp, publicação na esteira existente, logs e reenvio sem duplicação.

## 2. Sequência de execução proposta

### Fase 0 — Auditoria e preparação (sem deploy)
- Confirmar branches/PRs/commits vigentes e versões aprovadas, especialmente Teste vs Produção; catalogar migrations pendentes e conflitos.
- Inventariar telas de Loja, Biblioteca, Calculadora, Onboarding, Campanhas, Connect e pagamentos.
- Mapear banco Supabase, permissões/RLS, fluxos de eventos, contratos e testes.
- Criar checklist de regressão e plano de rollback por lote.
- Definir onde o plano será consultado dentro do Painel Admin («Planejamento / Evolução»), sem misturar com gestão de campanhas.

### Fase 1 — Melhorias rápidas (lote A)
1. #007 textos/atendimento da Loja.
2. #006 miniatura PDF na Home.
3. #005 modal de comparações.
4. #001 tela opcional de localização.
5. #002 consentimento de personalização.
**Observação:** ordem interna pode mudar se a auditoria revelar dependências.

### Fase 2 — Melhorias funcionais/visuais (lote B)
6. #008 fixação de posts na Biblioteca.
7. #009 seringa existente no card da Home.
8. #003 tema claro/escuro (deixar após componentes menores para teste visual global).

### Fase 3 — Gestão da Loja (lote C)
9. #010 auditoria de estoque/financeiro, incluindo custo opcional e margem histórica.
10. #011 gerenciamento em massa de preços e estoque, após estabilizar modelo de estoque.

### Fase 4 — Campanhas e Connect (lote D, subdividido)
11. #013-D1 auditoria e status real Connect, grupos e contratos de envio.
12. #013-D2 editor WhatsApp full-screen, formatação, autosave, anexos.
13. #013-D3 seletores Loja/Biblioteca/Comunidade, cartões e links.
14. #013-D4 publicação/agendamento na esteira, estados reais e reenvio seguro.
15. #013-D5 publicação cruzada App ↔ WhatsApp, independência por canal, testes ponta a ponta.
**Regra:** não enviar campanha real durante testes sem confirmação expressa e destino de teste autorizado.

### Fase 5 — Novos módulos de maior porte (lote E)
16. #012-E1 catálogo de recursos e permissões, planos, limites, acesso manual por usuário e «Minha assinatura» sem cobrança.
17. #012-E2 integração recorrente Mercado Pago em ambiente de teste, reconciliação, cancelamentos; produção somente após validação e autorização.
18. #004 Minha alimentação, iniciando sem agente IA e com dados/privacidade seguros.
19. #012-E3 preparação final para integração Apple/Google (adaptadores e documentação; integração de cobrança nativa só quando houver lançamento).

**Nota:** #004 e #012 podem trocar de ordem conforme dependências; ideal implementar o catálogo de permissões antes de conectar módulos Premium.

## 3. Requisitos técnicos e segurança comuns
- Autorização e RLS no backend; nunca confiar apenas em switches do frontend.
- Idempotência para pagamentos, envio de campanhas, atualização de estoque e jobs agendados.
- Controle de concorrência e auditoria (ator, momento, antes/depois, motivo) para operações administrativas.
- Observabilidade Vercel/Supabase/GitHub/Connect, logs sem segredos nem dados sensíveis, alertas de falhas.
- Feature flags por ambiente, testes unitários/integrados/E2E, mobile iOS/Android PWA, acessibilidade.
- Migrações reversíveis quando possível, backup verificado e preservação de dados.
- LGPD e consentimentos: não divulgar saúde/identificadores a serviços de marketing; não redistribuir conteúdo privado.
- Políticas das plataformas e WhatsApp: validar capacidades atuais e termos antes de ativar fluxos.

## 4. Critérios de conclusão por lote
1. Escopo aprovado e diferenças frente ao sistema existente documentadas.
2. Código revisado e build/testes executados.
3. Banco, migrations e RLS validados em Teste.
4. Evidência de comportamento em desktop e iPhone/PWA, estados vazios/erros.
5. Fluxos críticos regressivos (login, Loja, Mercado Pago, Biblioteca, calculadora, Connect) preservados.
6. Aprovação de publicação e sincronização segura para Produção.
7. Atualização deste documento: status por item (planejado, em desenvolvimento, em teste, aprovado, produção), PR/commit, data e pendências.

## 5. Decisões ainda abertas
- #012 preços finais, nomes dos planos, quais recursos e limites por nível, regras de trial/renovação e cancelamento.
- #013 capacidade real do conector Windows (mídias, legenda, links, envio a grupos, confirmações), permissões de republicação da Comunidade e mapeamento de conteúdo App/WhatsApp.
- #010 política de baixa/reserva de estoque e reposição por estorno; cálculo de taxas e câmbio.
- #004 fonte nutricional/licenciamento, escopo do planejamento alimentar inicial.
- Acesso administrativo ao «Planejamento / Evolução»: somente leitura, ou edição de status/observações no painel (proposta: edição restrita e histórico).
- A ordem final e os critérios de corte de cada lote após auditoria.

## 6. Estado de armazenamento
Este documento é a **fonte de planejamento versionada no GitHub**, em branch/PR documental, sem deploy. O menu de consulta dentro do aplicativo é uma **implementação futura**, não existente por consequência deste arquivo. Não apresentar a documentação em GitHub como se já estivesse visível no painel NeoPep.


---

## 7. Adendo de levantamento técnico e continuidade (24/11/2026)
Este documento mantém os **13 ajustes funcionais**. A pedido do responsável, acrescenta-se **#014 — Governança, preservação e documentação incremental**, como módulo transversal, para formar um pacote operacional de **14 frentes** sem alterar a numeração e os requisitos aprovados dos itens #001–#013.

**Arquivos obrigatórios deste pacote:**
- [Levantamento técnico e matriz de preservação](LEVANTAMENTO-TECNICO-2026-11-24.md): achados de GitHub, componentes existentes, lacunas e verificações por módulo.
- [Controle de execução incremental](CONTROLE-DE-EXECUCAO.md): status de cada item, subetapas, evidências, commits, PRs, Teste e Produção.
- [Início para agentes e Codex](INICIO-PARA-AGENTES.md): sequência obrigatória de leitura, retomada e atualização.
- [PR #40](https://github.com/neopep/App-NeoPep/pull/40): revisão documental, sem deploy.

**Descobertas críticas:** PR #25 e #36 constam como merged; PR #35 e #37 estão abertas; PR #37 registra diferenças significativas entre Teste e Produção e requer reconciliação antes de promover código. O Connect 0.2.6 documentado suporta envio manual de texto/imagem e lembretes locais, não prova agendamento automático e envio em massa de grupos. Consultar levantamento para escopo e limitações.

**Política permanente:** após cada subetapa, atualizar os arquivos do pacote, registrar o que foi realmente testado e os SHAs/ambientes, e preservar as versões aprovadas. Não declarar produção concluída por merge ou CI isolado. A PR #40 é documental e não autoriza mesclagem na `main`, migrations ou deploy.
