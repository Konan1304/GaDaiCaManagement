FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV TZ=Asia/Ho_Chi_Minh
EXPOSE 5000
CMD ["node","scripts/startEnvironment.js","production"]
