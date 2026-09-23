# Sati API container (runs on AWS Fargate)
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json ./
RUN npm install --no-audit --no-fund

# App source
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV DB_DRIVER=pg
ENV PORT=4000
EXPOSE 4000

# tsx runs the TypeScript entry directly
CMD ["npx", "tsx", "src/index.ts"]
