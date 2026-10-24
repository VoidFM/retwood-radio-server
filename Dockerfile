FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--experimental-sqlite", "server.mjs"]
