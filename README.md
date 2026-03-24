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

## Publicar no Cloudflare Pages

Para publicar apenas o frontend estatico no Cloudflare Pages, use:

- Build command: `npm run build:pages`
- Build output directory: `apps/web/dist`
- Root directory: `/`

Observacao:

- O frontend depende de `VITE_API_URL` apontando para uma API publicada. Sem isso, a interface sobe, mas nao consegue carregar as avaliacoes.
- O Cloudflare Pages deve compilar a branch `main` mais recente. Se o log mostrar o commit `aa43a0a`, ele esta usando uma revisao antiga.

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
