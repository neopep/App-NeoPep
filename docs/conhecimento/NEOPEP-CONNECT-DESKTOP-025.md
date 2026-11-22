# NeoPep Connect 0.2.5 — Desktop Windows moderno e publicação manual

## Estado
Implementação em branch de desenvolvimento `desenvolvimento/connect-windows-campanhas-v025`. **Não publicada para usuários**; necessita conclusão da CI Windows, homologação com grupo próprio e distribuição privada assinada. Produção e Vercel não foram alterados.

## Objetivo
Evoluir o cliente Windows legado para um ambiente de trabalho integrado às campanhas NeoPep, preservando a autenticação, o dispositivo aprovado, a conexão WhatsApp já pareada e a sincronização de grupos com Supabase de Teste.

## Identidade visual
- Fundo grafite/azul-profundo `#13161B`, superfícies `#1D2229` e `#252B33`.
- Destaque champagne `#C0A577`; evitar dourado brilhante ou metalizado.
- Fonte Segoe UI, cartões escuros e cabeçalhos discretos, barra de navegação com aba ativa destacada.
- Contraste claro, espaçamento generoso e janela redimensionável; inspirado na identidade NeoPep web, sem alegar transparência nativa inexistente no WinForms.
- Dashboard com indicadores de computador e ações de campanha.

## Entregue nesta primeira etapa de código
1. Tema WinForms centralizado em `ConnectTheme.cs`, utilizado nas telas principais e do WhatsApp.
2. Nova aba **Publicar**, com seleção apenas dos grupos locais marcados, texto (até 2.000 caracteres), prévia e confirmação humana nominal do grupo.
3. Envio direto de **texto** via operação privada `send_text` do bridge Node/Baileys; sem porta HTTP e sem envio automático.
4. Provedor confirma participação real naquele grupo antes da chamada `sendMessage`.
5. O bridge retorna `accepted` apenas com ID da mensagem da biblioteca, ou `rejected`/`uncertain`; um aceite não significa entregue/lido.
6. Nenhuma tentativa automática de reenvio quando o resultado é incerto. O usuário deve conferir o WhatsApp.
7. Rascunho cifrado em DPAPI, separado das credenciais e dos dados NeoPep.
8. Auditoria local registra somente horário e resultado, **não** texto, números ou ID de grupo.
9. Botão de envio exige sessão NeoPep válida e computador aprovado, além da conexão WhatsApp ativa.
10. Workflow GitHub Actions isolado compila versão Teste `0.2.5` e executa os testes sem distribuir instalador no repositório público.

## Limites
- Suporte inicial somente a **mensagem de texto para um grupo por confirmação**.
- Não lê mensagens, não usa dados de membros, não importa conversas nem cria disparos em massa.
- Não integra ainda fila real de agendamento, recorrência, anexos, mídia, imagens, produtos ou campanhas compartilhadas do painel web.
- A fila de simulação antiga permanece intocada e não pode ativar envio real.
- A API Baileys é não oficial. Pode quebrar ou resultar em restrições de conta; sem suporte oficial do WhatsApp.
- Não há recibo confiável de entrega ou leitura.
- O próprio painel web segue independente e sem alteração de banco nesta etapa.

## Evolução planejada para paridade com o painel NeoPep
1. Construir navegação lateral em vez de abas WinForms e telas com cartões responsivos; dashboard unificado com Conexões, Grupos, Campanhas, Publicações, Agenda, Histórico, Diagnósticos e Configurações.
2. Adicionar catálogo de campanhas compartilhado com Supabase de Teste sob autorização de administrador e RLS específica; ler campanhas e filas existentes, sem reaproveitar identificadores de simulação como autorização real.
3. Editor de campanhas com título, texto, prévia de imagem/anexos, links, modelos reutilizáveis, busca e filtros por grupo. Tratar transferência e segurança de arquivos em módulo separado.
4. Publicações por grupo individuais, revisão, confirmação humana, deduplicação por chave persistente, estados pendente/aceito/incerto e monitoramento.
5. Agenda e lembretes como **auxílio à publicação manual**; agendamentos automáticos reais requerem autorização separada e salvaguardas de consentimento, limites, cancelamento e auditoria.
6. Painel de uso com monitoramento de sessão, sync, fila, erros e capacidade, sem conteúdo das conversas.
7. Empacotamento com chave de assinatura permanente, atualização segura, teste em Windows 10/11 com DPI diferentes e eventual evolução de WinForms para WinUI 3 ou WPF se desejado.

## Validação necessária antes de distribuição
- CI Node e compilação Windows 0.2.5 com SHA-256 correto.
- Teste visual real no Windows, redimensionamento, navegação por teclado e alto DPI.
- Conferir o botão de envio indisponível sem computador aprovado, WhatsApp ou grupo selecionado.
- Enviar apenas uma mensagem autorizada ao grupo **Teste Neopep** após confirmação humana.
- Simular falha de rede e conferir aviso de resultado incerto sem reenviar.
- Validar fechamento/reabertura, rascunho cifrado, proteção de credenciais e vínculo WhatsApp.
- Compilar/assinar no repositório privado antes de oferecer instalação.

## Não confundir
A implementação desta branch **não** aparece automaticamente na versão 0.2.4 instalada. O código precisa passar pela CI, homologação e preparação de um instalador privado 0.2.5. Não modificar produção nem Vercel.
