FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
