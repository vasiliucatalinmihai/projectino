FROM node:22-slim

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000

# In dev the compose `command:` overrides this with `yarn dev`.
CMD ["sh", "-c", "yarn build && node .output/server/index.mjs"]
