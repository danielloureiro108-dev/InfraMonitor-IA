FROM node:20-alpine AS build
WORKDIR /app
# Copy only dependencies first for better layer caching
COPY package*.json ./
RUN npm install
# Copy source and build
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# iputils provides the real ping binary used by node-ping library inside the container
RUN apk add --no-cache iputils
# Copy dependencies first for layer caching
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
# Copy compiled app from build stage
COPY --from=build /app/dist ./dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
CMD ["node", "dist/index.js"]
