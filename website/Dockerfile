FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.7.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build:website

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 GHOSTLINK_DATABASE=/data/ghostlink.sqlite
WORKDIR /app
COPY --from=build /app/website/.output ./.output
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
