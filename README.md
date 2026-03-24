# PsicoRisk Manager Platform

Migracao total do projeto legado para uma arquitetura moderna, dockerizada e separada por camadas:

- `apps/web`: frontend React + Vite + TypeScript
- `apps/api`: backend Fastify + PostgreSQL
- `packages/domain`: regras de negocio compartilhadas, importacao e analytics

## Subir com Docker

```bash
docker compose up --build
```

Servicos:

- Web: [http://localhost:4173](http://localhost:4173)
- API: [http://localhost:8081/api/health](http://localhost:8081/api/health)
- Postgres: `localhost:5432`

## Rodar sem Docker

```bash
npm install
npm run build:domain
npm run dev:api
npm run dev:web
```

## Escopo migrado nesta base

- importacao de `csv`, `xls` e `xlsx`
- normalizacao do layout legado para modelo interno
- analytics globais, por categoria, pergunta e departamento
- atenuacao por medidas de controle
- agravamento por CID F
- persistencia das avaliacoes em PostgreSQL
- painel web para upload, visualizacao e recalculo

## Legado

Os arquivos HTML antigos foram mantidos no diretorio raiz apenas como referencia metodologica durante a migracao.
