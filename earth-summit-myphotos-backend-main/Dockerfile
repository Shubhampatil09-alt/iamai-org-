FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .

RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
