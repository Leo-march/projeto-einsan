# Medical Security x Bulário Anvisa

Painel web para exibir a análise operacional devolvida pelo endpoint local `GET /api/analise`.

## Executar

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. O endpoint aceita `data_referencia` opcional em ISO 8601, por exemplo `GET /api/analise?data_referencia=2026-11-14T15:30:00-03:00`.

## Dados e processamento

A rota `src/app/api/analise/route.ts` e a página consultam o mesmo serviço server-only em `src/lib/servico-analise.ts`. Esse serviço lê `data/bulas.json`, `data/logs_hardware.json` e `data/estoque_cofre.json`, executa `src/lib/analise.ts` e produz `AnaliseResponse`, tipado em `src/types/dominio.ts`.

A interface apresenta os valores e justificativas da análise sem recalcular o estoque. Os arquivos JSON em `data/` são entradas do processamento e devem permanecer disponíveis.

## Verificações

```bash
npm run lint
npm test
npm run build
```
