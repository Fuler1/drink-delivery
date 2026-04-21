FROM node:20-alpine

WORKDIR /app

# Potrzebne do kompilacji bcrypt na Alpine
RUN apk add --no-cache python3 make g++ \
  && ln -sf /usr/bin/python3 /usr/bin/python

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
