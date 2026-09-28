FROM node:20-alpine AS frontend
WORKDIR /src
COPY enjoapifront/package*.json ./
RUN npm ci
COPY enjoapifront/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api
WORKDIR /src
COPY enjoapi/enjoapi/enjoapi.csproj ./
RUN dotnet restore
COPY enjoapi/enjoapi/ ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api /app/publish .
COPY --from=frontend /src/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/sites-available/default
ENV ASPNETCORE_URLS=http://0.0.0.0:3007
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 3006 3007
ENTRYPOINT ["sh", "-c", "dotnet /app/enjoapi.dll & exec nginx -g 'daemon off;'"]
