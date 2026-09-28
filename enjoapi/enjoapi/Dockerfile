# ADIM 1: Temel görüntüyü seç
# .NET 8.0 SDK görüntüsünü kullanarak derleme aşamasını başlatıyoruz
# Bu görüntü içinde projemizi derleyeceğiz
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# ADIM 2: Çalışma dizinini ayarla
# Container içinde projemizin bulunacağı klasörü belirliyoruz
WORKDIR /src

# ADIM 3: Proje dosyasını kopyala
# NuGet paketlerini restore etmek için önce .csproj dosyasını kopyalıyoruz
# Bu, Docker'ın katmanlama özelliğini kullanarak cache'lemeyi optimize eder
COPY ["enjoapi.csproj", "./"]

# ADIM 4: NuGet paketlerini restore et
# Proje bağımlılıklarını indiriyoruz
RUN dotnet restore "enjoapi.csproj"

# ADIM 5: Tüm proje dosyalarını kopyala
# Kaynak kodları container'a kopyalıyoruz
COPY . .

# ADIM 6: Projeyi derle
# Projeyi Release modunda derliyoruz ve çıktıyı /app/publish klasörüne yazıyoruz
RUN dotnet build "enjoapi.csproj" -c Release -o /app/build

# ADIM 7: Projeyi publish et
# Derlenmiş dosyaları yayınlama (publish) klasörüne kopyalıyoruz
# Bu işlem gereksiz dosyaları temizler ve sadece çalıştırılabilir dosyaları bırakır
RUN dotnet publish "enjoapi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ADIM 8: Runtime görüntüsüne geç (multi-stage build)
# SDK görüntüsü yerine daha hafif olan runtime görüntüsünü kullanıyoruz
# Bu sayede final image boyutu çok daha küçük olacak
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base

# ADIM 9: Çalışma dizinini ayarla
WORKDIR /app

# ADIM 10: Portu expose et
# Uygulamanın dinleyeceği portu belirtiyoruz
# .NET varsayılanı 8080 (HTTP) ve 8081 (HTTPS) portlarıdır
EXPOSE 8080
EXPOSE 8081

# ADIM 11: Build aşamasından publish edilmiş dosyaları kopyala
# Build aşamasında oluşturduğumuz /app/publish klasöründeki dosyaları
# Runtime görüntüsüne kopyalıyoruz
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

# ADIM 12: Uygulamayı başlat
# Container başladığında uygulamayı çalıştırıyoruz
ENTRYPOINT ["dotnet", "enjoapi.dll"]

