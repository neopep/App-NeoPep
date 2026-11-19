# Auditoria do Elo e evolução NeoPeptídeos

Data: 12/11/2026. Base: ecce8791b78b531f175e6f7cc34cae14b65f1acf.

## Arquitetura encontrada
HTML/CSS/JS estáticos, sem framework ou dependências. Hospedagem Sites privada. Manifesto de hospedagem aponta para dist. Registros na chave localStorage elo-v1: weights, measures, doses e settings. Sem servidor, banco, perfis, PWA ou login social próprio. O gate ChatGPT do Sites permanece ativo; não é login Apple/Google.

## Preservação
Versão original intacta em releases/elo-1 e no commit base. Nova implementação no ramo feature/neopeptideos. Nenhuma migração de registros é executada ao abrir a prévia; elo-v1 jamais é escrito pelo Neo. Exportação e confirmação são obrigatórias para importação. A versão publicada continua sendo Elo até autorização expressa após revisão.

## Riscos identificados e correções planejadas
- localStorage pode falhar por quota/modo privado; tratar gravação como operação falível e não confirmar sucesso antes de persistir.
- Restore original substitui todos os registros; Neo mescla com validação integral, backup obrigatório e deduplicação.
- Conteúdo de backup é não confiável; validar datas reais, limites numéricos, tamanhos e tipos antes de renderizar.
- Gráfico original espaça amostras por índice; Neo usa distância temporal real.
- Não há isolamento multiusuário no localStorage original; conta de nuvem usa memória separada, sem copiar dados locais automaticamente.
- Notificações originais funcionam só com página aberta. Manter essa limitação explícita; calendário .ics para uso em segundo plano.
- Fotografias não serão públicas nem colocadas em localStorage: IndexedDB no dispositivo; bucket privado e URLs temporárias na nuvem.
- Não há infraestrutura OAuth Apple/Google configurada. Integração oficial Supabase preparada, desativada até configuração e validação reais.

## Ordem de execução
1. Auditoria e snapshot. 2. Modelo de dados validado e testes de regressão. 3. Interface iPhone/PWA/temas. 4. Perfil, diário, fotos, calendário, relatórios. 5. Adaptador Supabase com SDK oficial, SQL/RLS/Storage e exclusão por Edge Function. 6. Testes e pacote local de prévia. 7. Configuração externa e validação real. 8. Aprovação do usuário para substituir publicação.

## Dependências externas não configuradas
Projeto Supabase, URL/chave pública; execução do SQL; bucket; implantação da Edge Function; Google OAuth; Apple Developer/Services ID/domínio/chave privada no provedor; SMTP e redirects; responsável LGPD/contato/retenção. Nenhum serviço foi contratado ou credencial externa criada. Supabase não está ativo até configurar.
