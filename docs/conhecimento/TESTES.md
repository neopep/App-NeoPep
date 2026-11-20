# Testes

| Verificação | Cobertura e execução |
| --- | --- |
| `npm run check` | Sintaxe dos módulos selecionados e validação estrutural da configuração pública. |
| `npm test` | O pretest gera HTML portátil. A suíte Node cobre domínio, DOM com LinkeDOM, IndexedDB simulado, PWA, PGlite, autorização e contratos Edge com transporte simulado. |
| `npm run build` | Valida a configuração e gera módulos versionados em `dist/`. Use uma cópia de trabalho para validação sem modificar esses arquivos. |
| `node scripts/stage-preview.cjs` | Empacota a raiz e `/neo/`. Confira conteúdo, manifesto, service worker e fluxos afetados. |
| `npm run release:check` | Lê as evidências de prontidão para lançamento. A conferência de formato precisa das evidências operacionais correspondentes. |

Fontes: [Scripts npm](../../package.json) · [Testes atuais](../../tests/) · [Evidências de lançamento](../../release/web-readiness.json)

Em 20/11/2026 no Codex Cloud com Node.js 24.22.1, `npm run check` passou. A suíte completa teve 296 casos, com 229 aprovados e 67 falhas, os mesmos 67 casos que falharam durante o onboarding na mesma base de código. Entre as falhas estão referências a `vault.decrypted_secrets` e `service_role` ausentes no ambiente de testes, além de falhas em outras áreas. O estado da suíte é **parcialmente validado**. O build e as respostas HTTP da prévia foram validados durante o onboarding dessa base. A execução documental atual repetiu a checagem e a suíte.

Os 30 casos em [VALIDACAO](../VALIDACAO.md) e a verificação em [ETAPA-2-TESTES](../ETAPA-2-TESTES.md) são resultados históricos. Use [o protocolo de validação](../processos/PROTOCOLO-DE-VALIDACAO.md) para distinguir testes sintéticos, QA de dispositivos e evidências de produção.
