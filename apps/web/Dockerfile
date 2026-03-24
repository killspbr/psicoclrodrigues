FROM node:22-alpine

WORKDIR /app

ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci

COPY apps/web apps/web
COPY packages/domain packages/domain

RUN npm run build:domain && npm run build:web

EXPOSE 4173

CMD ["npm", "run", "preview", "--workspace", "@psicorisk/web"]
