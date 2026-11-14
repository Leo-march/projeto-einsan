# Projeto Einsan

PoC de uma API Next.js para acompanhar estoque de medicamentos refrigerados, eventos do cofre, risco de excursão térmica e recomendações de reposição. O front-end ainda é o template inicial do Next.js; as rotas abaixo são a interface disponível para integrá-lo.

## Executar localmente

```bash
npm install
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`. Para compilar e executar em modo de produção:

```bash
npm run build
npm run start
```
a
## Documentação

- [Guia completo atualizado — PDF](docs/guia-api-cofre-inteligente-atualizado.pdf)
- [Fonte HTML do guia](docs/guia-api-cofre-inteligente-atualizado.html)

## Dados e persistência

Os dados da PoC são carregados dos arquivos JSON em `data/`. O `POST /api/movimentacoes` grava diretamente em `data/movimentacoes_estoque.json`; portanto, a execução precisa de um disco gravável e persistente. Essa abordagem é adequada para desenvolvimento ou servidor próprio, mas não oferece persistência confiável em ambientes serverless/efêmeros nem controle de concorrência.
