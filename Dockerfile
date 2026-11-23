# ---- build stage: install production dependencies only ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY app.js ./

# ---- runtime stage: small image, no npm, not root ----
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app ./
# npm is not needed at runtime; removing it shrinks the attack surface
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "app.js"]
