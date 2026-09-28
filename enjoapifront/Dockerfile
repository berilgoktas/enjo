# Build aşaması
FROM node:20-alpine AS builder

WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci

# Kaynak kodları kopyala
COPY . .

# Production build al
RUN npm run build

# Production aşaması
FROM nginx:alpine

# Build edilmiş dosyaları nginx'e kopyala
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx konfigürasyonu (SPA için + API proxy)
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # API isteklerini backend\'e yönlendir \
    location /api { \
        proxy_pass http://backend:8080; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        \
        # CORS başlıkları \
        add_header Access-Control-Allow-Origin * always; \
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always; \
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always; \
        \
        # OPTIONS isteğine hemen cevap ver \
        if ($request_method = OPTIONS) { \
            add_header Access-Control-Allow-Origin * always; \
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always; \
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always; \
            add_header Access-Control-Max-Age 1728000; \
            add_header Content-Type "text/plain charset=UTF-8"; \
            add_header Content-Length 0; \
            return 204; \
        } \
    } \
    \
    # SPA routing \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

