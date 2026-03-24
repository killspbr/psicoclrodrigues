FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN npm ci

COPY apps/api apps/api
COPY packages/domain packages/domain

RUN npm run build:domain && npm run build:api

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace", "@psicorisk/api"]
