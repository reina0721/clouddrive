FROM node:24-bookworm AS build
ARG CLOUDDRIVE_BACKEND_URL=http://backend:8080
ENV CLOUDDRIVE_BACKEND_URL=$CLOUDDRIVE_BACKEND_URL
ENV NEXT_PUBLIC_AUTH_MODE=backend
ENV NEXT_PUBLIC_AUTH_API_BASE_URL=/api/console/v1
ENV WEB_DEPLOYMENT_MODE=server
WORKDIR /app/frontend
COPY frontend/ ./
RUN mkdir -p /app/api && npx --yes pnpm@10.22.0 install --frozen-lockfile && npx --yes pnpm@10.22.0 build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_PUBLIC_AUTH_MODE=backend
ENV NEXT_PUBLIC_AUTH_API_BASE_URL=/api/console/v1
ENV WEB_DEPLOYMENT_MODE=server
WORKDIR /app/frontend
COPY --from=build --chown=node:node /app/frontend/ ./
USER node
EXPOSE 4173
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "4173"]
