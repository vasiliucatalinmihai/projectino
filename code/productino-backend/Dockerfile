FROM node:20-slim

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so they are cached when only source changes
COPY package.json yarn.lock* ./
COPY prisma ./prisma/
RUN yarn install
RUN yarn prisma generate

# Copy the rest of the source
COPY . .

ENV PORT=8080
EXPOSE 8080

# In dev the compose `command:` overrides this. This is the production entrypoint.
CMD ["sh", "-c", "yarn build && yarn prisma:deploy && yarn start:prod"]
