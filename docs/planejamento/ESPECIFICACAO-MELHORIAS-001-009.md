# Especificação funcional detalhada — Melhorias #001 a #009
Versão 2.0 | 24/11/2026 | Estado: PLANEJADO, com reaproveitamento de recursos existentes.  
Base: Plano Mestre, evidências do repositório e confirmação parcial das plataformas. Nenhuma tela foi modificada nesta revisão.

## Protocolo comum de UX
- Antes de qualquer alteração: fotografar/registrar o comportamento aprovado na versão efetiva de Teste e Produção, com SHA, URL e conta fictícia.
- Não substituir navegação, layout, dados, métodos ou permissões de outros módulos para implementar uma melhoria localizada.
- Cada tela deve atender iPhone/Safari/PWA (safe areas, teclado, rolagem), Android, desktop, contraste, leitor de tela, foco e tamanho de toque.
- Fornecer estados de carregamento, vazio, indisponível, sem autorização, erro recuperável e offline; a interface não pode inventar dados.
- Cada mudança exige teste visual contra a referência original e regressão dos caminhos vizinhos.

## #001 — Localização opcional no onboarding
### O que já existe
Código da main: src/app.js contém tela de preferências iniciais (permissoes-iniciais), escolha de localização aproximada, função requestDeviceLocation com navigator.geolocation e opção de revogar. A permissão do dispositivo é requisitada na ativação da opção, não há comprovação de uma tela específica de explicação isolada. O ambiente pode desabilitar o controle por configuração. Não refazer toda a infraestrutura.
### Comportamento aprovado
1. Depois do cadastro e primeiro login, exibir um passo curto, educativo e opcional antes da personalização.
2. Explicar finalidade, precisão aproximada, permissões do aparelho e ausência de rastreamento contínuo. Botões permitir e agora não; não pedir permissão nativa sem gesto do usuário.
3. Se autorizado, consultar API nativa suportada; negar ou expirar a solicitação não impede continuar.
4. Persistir escolha separada da autorização do sistema; mostrar revogação no Perfil → Privacidade e permissões. Não confundir preferência do NeoPep com permissão efetiva do browser.
5. Ao reiniciar, não repetir indevidamente o onboarding. Se a pessoa decidir posteriormente, permitir nova solicitação em ação explícita.
6. Se a instalação/PWA não oferecer geolocalização, manter fluxo funcional e orientar sem falsas promessas.
### Privacidade e aceitação
Não armazenar coordenadas exatas nem habilitar geolocalização contínua sem novo escopo aprovado. Verificar como o código atual trata localização aproximada por cabeçalhos de hospedagem versus localização do dispositivo. Testar permitido/negado/erro/timeout/iOS PWA, mudança de conta e revogação.
### Arquivos candidatos
src/app.js, src/cloud.js, supabase/migrations/20261123190000_privacy_preferences.sql, tests/privacy-preferences.test.cjs. Migração existente não significa nova migração necessária.

## #002 — Consentimento para personalização
### Texto aprovado literalmente
Título: Personalize sua experiência
Descrição: Permita que o NeoPep personalize sua experiência e melhore nossas comunicações.
Botões: Permitir personalização / Agora não
### Estado existente e lacuna
A main já possui opções Estatísticas do aplicativo, Medição de uso, Notificações de campanhas, Localização aproximada. Não é correto presumir que isso represente o novo consentimento específico de personalização. Auditar se há armazenamento e política adequados antes de adicionar opção.
### Fluxo
1. Etapa subsequente à localização; progresso simples e sem forçar consentimento.
2. Não combinar autorização de push, marketing, analytics e personalização como se fossem equivalentes; assegurar finalidade clara e controles independentes se exigidos.
3. Permitir recusa sem bloquear app nem habilitar trackers opcionais.
4. Preferência revogável, registrada com finalidade e versão de texto, associada ao usuário; desativar coleta opcional em caso de revogação.
5. Para iOS nativo, analisar ATT quando efetivamente aplicável. Para PWA, respeitar capacidades web e consentimento.
### Critérios de aceitação
Passos na ordem correta; nenhuma escolha pré-marcada por omissão; mudança de conta limpa contexto; sem vazamento de dados de saúde para publicidade; testes de consentimento, eventos e revogação.

## #003 — Tema claro/escuro
### Estado existente
src/app.js já aceita neo-appearance com valores light, dark e system, e aplica data-theme; a preferência padrão observada no código main é dark. A solicitação é uma evolução da interface e da política do tema, não um novo motor.
### Paleta aprovada do claro
Marinho #142743, branco #FFFFFF, gelo #F4F5F6, prata #E2E5EA, lavanda fria #A8B4CC; texto primário #253449; secundário #697789; borda #D8DEE6; azul de ação #223F63; superfície alternativa #EDF0F4. Proporção aproximada 70/20/10, cartões glass de baixa opacidade e borda leve, sem estética dourada/neon.
### Interação
- Manter visual escuro atual integralmente (cores, hierarquia, gradientes e componentes já aprovados).
- Pequeno controle horizontal na Home próximo ao acesso ao Painel Admin; alinhamento e acessibilidade de botão com rótulo.
- Padrão desejado: acompanhar sistema quando usuário não tiver definido override; opção voltar a Seguir sistema.
- Override persistido por conta/instalação conforme política atual; evitar flash de tema errado antes do primeiro paint; reagir a prefers-color-scheme quando em modo system.
- Não alterar tema do NeoPep Connect Windows, que é uma interface WinForms separada.
### Casos e QA
Login, onboarding, Home, comunidade, atendimento, biblioteca, PDF/vídeo, comparações, loja, calculadora, Painel Admin e modais. Conferir branco sobre branco, contrastes, gráficos, placeholders, teclado, status, carregamento e ícones. Teste de não regressão visual do tema dark com capturas de referência.

## #004 — Minha alimentação
### Base
Card Minha alimentação / Em breve documentado na PR #36. Módulo completo ainda não comprovado no banco. Escopo aprovado sem IA funcionando nesta etapa.
### Navegação e desenho
Home → Minha alimentação com visão do dia e atalhos: Adicionar refeição, Água, Metas, Histórico, Plano semanal, Receitas e Lista de compras.
Painel do dia: calorias consumidas, meta, saldo, distribuição de macros (proteína, carboidrato, gordura), consumo de água, lista de refeições e indicador por refeição.
### Registros
- Refeição: data/hora local, tipo (café, almoço, lanche, jantar ou personalizado), alimentos e porções, quantidade/unidade, kcal e macros, observações, origem manual/tabela e imagem opcional; permitir editar, duplicar e excluir.
- Água: volume, momento do registro e meta por usuário; unidades configuráveis com conversão consistente.
- Metas: calorias e macros por dia, água, unidades e preferências; não gerar meta clínica sem justificativa.
- Histórico: visão diária/semanal, gráficos e filtros; retroatividade e fuso; evitar contar refeições duas vezes após sync.
- Planejamento semanal: estrutura separada do efetivamente consumido; permitir marcar como consumido com confirmação; receitas com ingredientes, porções e totais.
- Substituições e compras: itens sugeridos ou cadastrados, edição e marcação de compras. Sem alegar equivalência nutricional automática sem dados confiáveis.
- Fotos: anexos privados, tamanho limite, compressão, autorizações, exclusão e exportação.
### Modelo de dados proposto, não implementado
Entidades: nutrition_goals, nutrition_meals, nutrition_meal_items, nutrition_food_catalog, nutrition_recipes, nutrition_recipe_items, nutrition_water_entries, nutrition_week_plans, nutrition_shopping_items, nutrition_media. Cada registro pessoal tem owner_id, created_at, updated_at, data local quando relevante, e origem; tabelas catálogo podem ser compartilhadas conforme licença. Preferir neo_private e RPC/Edge de propósito específico; validar RLS e policy.
### Fontes nutricionais
Auditar TBCA/TACO e suas condições de uso, unidades em g/ml/porção, aproximações, fibra, valores desconhecidos, arredondamento. O usuário poderá corrigir números. Não criar calorias fictícias.
### Integrações e IA
Reutilizar dados de peso e perfil somente mediante escopo/consentimento; capacidade de incorporar IA no futuro, mas não chamar IA agora nem gerar resultados artificiais. Entitlements de assinatura devem poder controlar o acesso sem apagar dados.
### QA
Cálculo de macros, porções, exclusão, troca de dia/fuso, offline, contas distintas, imagem privada, gráfico sem dados, exportação, privacidade, custo e desempenho. Enquadrar orientação como acompanhamento e não prescrição médica.

## #005 — Comparações de fotos no chat/grupo
### Base
Funcionalidade Antes/Depois, gravação privada e compartilhamento de cópia estão descritos nas entregas da PR #36. Não criar um segundo armazenamento de fotos.
### Nova interface
- Ao tocar Minhas comparações no fluxo de envio do Grupo, abrir modal maior e responsivo (alvo até 85vh) com lista rolável de pares, miniaturas verdadeiras lado a lado, datas e rótulos Antes/Depois.
- Carregamento das fotos por URLs assinadas temporárias com validação de usuário; skeleton e fallback.
- Seleção claramente marcada, prévia do par e confirmação explícita antes de compartilhar; compartilhar uma cópia conforme mecanismo existente, nunca tornar originais públicos.
- Ações Criar comparação, Atualizar e Cancelar; criar aparece em estados vazio e não vazio.
- Fechar preserva conversa, rascunho de mensagem e posição do usuário.
### Segurança/aceite
Não revelar URLs privadas nem outros titulares, revogação de links temporários, bloqueio para conta diferente, teclado/safe-area e respeito a exclusão. Testes de 0/1/N comparações, foto ausente, upload pendente e navegação.

## #006 — Miniatura real de PDF no destaque Biblioteca
### Causa candidata evidenciada no código
dist/library.js: cover() retorna canvas para mime application/pdf juntamente com elemento de texto PDF e icon fallback; loadCover() consulta material/attachments e assina URL de 50s, selecionando imagem antes de PDF. Isso pode explicar o rótulo PDF visível, mas a causa visual final requer reprodução em iPhone.
### Escopo
- Corrigir primeiro a origem dos anexos e a renderização no componente correto, não reescrever o leitor de arquivos/PDF já aprovado.
- Thumbnail proporcional derivada da primeira página, tamanho limitado (recomendado WebP ou AVIF), derivada e cacheada quando licenciamento/acesso permitir; fallback apenas dentro da área de capa.
- Se frontend renderizar PDF no canvas, aguardar processamento/cancelar tarefas ao trocar item, usar limite de memória e não guardar URLs privadas em caches públicos.
- Nunca desenhar um label PDF gigante sobre a capa. Evitar layout shift, tamanho exagerado e carregamento eterno.
- Quando um PDF não tiver capa/primeira página acessível, ícone elegante e título do item, sem renderização falsa.
### Aceite
Guia Definitivo dos Peptídeos com capa proporcional; falha de rede/403/sem documento não destrói carrossel; navegação e leitor preservados. Testar iOS Safari, PWA, múltiplos PDFs e troca de conta.

## #007 — Loja: textos e atendimento
### Base evidenciada
dist/shop.js, função home(), contém literalmente Escolhas para sua jornada. Loja já tem catalogação, Gerenciar, duplicação, vitrine, checkout e dashboard de pedidos.
### Delta aprovado
- Trocar exatamente por Encontre o que você procura.
- Inserir ícone de headset discreto e texto: Não encontrou o que procura? Fale com nosso atendimento para consultar a disponibilidade.
- Atalho utiliza o atendimento já existente, sem fluxo paralelo. Se não houver suporte acessível, informar indisponibilidade sem abrir link vazio.
- Selo Pagamento com Mercado Pago com proteção descrita somente quando respaldada por condições verificadas; não usar garantia absoluta.
- Priorizar cartões existentes, não rearranjar fotos/preços nem alterar catálogo, checkout, carrinho, estoque, webhook ou pedidos.
### Aceite
Texto e links corretos em celular/desktop, tipografia, acessibilidade, sem duplicar CTA, nenhum diff nas rotas financeiras. Teste de carrinho e finalização em fixture sem transação real.

## #008 — Fixação de posts Biblioteca
### Proposta de UX
No editor de publicação do administrador: Afixar no topo, Desafixar e reorganizar fixados (arraste com alternativa acessível de subir/descer). Badge discreto de alfinete, sem deslocar destaques da Home.
### Semântica
Múltiplos fixados permitidos; ordem manual em primeira posição relativa dentro do resultado filtrado. Posts não fixados mantêm ordenação anterior. Busca, categoria, permissão, plano e data seguem aplicáveis antes da ordenação. Nunca mostrar item privado a usuário sem acesso.
### Dados e concorrência
Inspecionar schema de materiais e RPC de lista; migração aditiva de metadados de fixação ou tabela de ordenação, escolhida após auditoria. Alterações atômicas, log administrativo, posição determinística, tratamento de duas edições simultâneas.
### QA
Fixar N, trocar ordem, desfazer, filtros, novos materiais, usuário comum, arquivo oculto, reordenar em iPhone, fallback sem arraste.

## #009 — Seringa calculadora na Home
### Base evidenciada
src/app.js contém syringeSymbol(capacity,mark,compact,calculated) e resultados de cálculo com capacidade/marcações. Card de Home precisa reutilizar a implementação aprovada, sem criar SVG novo divergente.
### UI
- Substituir mensagem genérica do card por visual compacto idêntico ao componente de seringa do resultado, respeitando proporção, marcações e indicação de preenchimento.
- Último cálculo efetivamente salvo pelo usuário: capacidade, volume, UI e data; não pegar o último cálculo de outra conta ou simular números.
- Sem cálculo: seringa vazia, mensagem curta e acesso à calculadora, sem inventar marcação.
- Toque abre calculadora existente, restaurando cálculo quando contrato permitir; senão abre o fluxo atual sem alterar dados.
- Cálculos excluídos ou atualizados invalidam o card; sem cache cruzado por usuário.
- Preservar os três cards de seleção de capacidade e todos os resultados atuais.
### QA
Vazio, primeiro cálculo, cálculo atualizado/excluído, conta diferente, capacidade distinta, zoom, responsividade. Visualizar volume não equivale a prescrever dosagem.

## Checklist de encerramento da fase de melhorias
Para cada ID: versão/URL de Teste, captura antes/depois, arquivos alterados, baseline de testes, novos testes, regressão dos módulos adjacentes, aprovação, registro no tracker e evidência de Produção separada. Nunca considerar concluído apenas por ver o elemento na interface.
