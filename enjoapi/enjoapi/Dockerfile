# Derleme
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["enjoapi.csproj", "./"]
RUN dotnet restore "enjoapi.csproj"

COPY . .
RUN dotnet publish "enjoapi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Çalıştırma
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://0.0.0.0:3007
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 3007

ENTRYPOINT ["dotnet", "enjoapi.dll"]
