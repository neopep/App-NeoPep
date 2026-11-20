# NeoPeptídeos — instruções obrigatórias para agentes

NeoPeptídeos é um aplicativo web mobile de acompanhamento pessoal, com registros, biblioteca, comunidade, atendimento e loja. A aplicação usa HTML/CSS/JavaScript, PWA e o SDK Supabase. PostgreSQL, Auth, Storage e Edge Functions sustêm os fluxos remotos.

1. Antes de editar, leia o [contexto mestre](docs/conhecimento/CONTEXTO-MESTRE.md), identifique o commit com `git rev-parse HEAD`, inspecione o estado de trabalho e consulte o documento do módulo e as [decisões](docs/memoria/DECISOES.md). Mapeie dependências, contratos, permissões e dados afetados.
2. Preserve funcionalidades alheias ao pedido, compatibilidade de callbacks e dados legados. Trabalhe no checkout existente e respeite alterações locais. Use uma branch de trabalho e mantenha o escopo da entrega. [Arquitetura](docs/conhecimento/ARQUITETURA.md)
3. Reutilize componentes, tokens de tema, navegação e padrões mobile. Confira ambos os temas, foco, área segura, teclado e movimento reduzido quando o fluxo visual mudar. [Identidade visual](docs/conhecimento/IDENTIDADE-VISUAL.md)
4. Mantenha isolamento por conta, RLS, buckets privados e autorização no servidor. Segredos e dados pessoais ficam fora do Git, dos logs e de `dist/`. Trate registros de saúde, mídia e conversas como sensíveis. [Segurança](docs/conhecimento/SEGURANCA.md)
5. Preserve migrações aplicadas. Para mudanças de esquema use migração nova e revisada, com teste local, plano de backup e reversão. Toda execução remota exige autorização e conferência do ambiente de destino. [Banco de dados](docs/conhecimento/BANCO-DE-DADOS.md)
6. Rode as verificações aplicáveis, incluindo `npm run check` e os testes afetados. Para mudanças no pacote web use também `npm run build` e valide a prévia. Registre resultados, falhas da base e limites da validação. [Testes](docs/conhecimento/TESTES.md)
7. Antes de publicar, valide a prévia, requisitos do release e serviços afetados. Merge, deploy, troca de audiência, migração remota e alterações de configuração exigem autorização. [Protocolo de validação](docs/processos/PROTOCOLO-DE-VALIDACAO.md)
8. Entregue código e documentação juntos. Atualize os documentos do módulo, o histórico, as pendências e as próximas tarefas. Apresente o commit e a validação para aprovação. [Protocolo de atualização](docs/processos/PROTOCOLO-DE-ATUALIZACAO.md)

9. Antes de cada commit, sobretudo em sessões ou checkouts novos, execute os quatro comandos abaixo. Confirme que a configuração local e as identidades efetivas de autoria e committer correspondem à conta autorizada. Se houver divergência, verifique variáveis de ambiente e corrija com a identidade autorizada da conta responsável antes de criar o commit. Nunca atribua commits a terceiros. [Identidade Git e Vercel](docs/conhecimento/INTEGRACOES.md#identidade-git-e-vercel)

   ```sh
   git config --local user.name
   git config --local user.email
   git var GIT_AUTHOR_IDENT
   git var GIT_COMMITTER_IDENT
   ```

10. As contas `neopep` e `rafarwr5` estão autorizadas pelo proprietário a desenvolver, editar, criar commits, enviar alterações e publicar diretamente, respeitando a autorização de cada tarefa e as permissões da plataforma. Use sempre a identidade real. O repositório permanece público temporariamente. Se voltar a ser privado, revalide a elegibilidade no Vercel Hobby antes de publicar. [Fluxo das duas contas](docs/processos/PROTOCOLO-DE-DESENVOLVIMENTO.md#fluxo-operacional-entre-as-duas-contas)
