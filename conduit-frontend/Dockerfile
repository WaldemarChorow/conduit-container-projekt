#Stage 1
FROM node:20.9.0 AS builder
WORKDIR /app
COPY package.json package-lock.json .
RUN npm ci
COPY . .
RUN npx ng build

#Stage 2
FROM nginx:alpine
WORKDIR /app
COPY --from=builder /app/dist/angular-conduit /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80