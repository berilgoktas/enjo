using enjoapi;
using enjoapi.Services;
using Microsoft.AspNetCore.HttpOverrides;

EnvFileLoader.LoadNearest();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// User Service
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddSingleton<LoginAttemptService>();

// TCMB servisleri
builder.Services.AddHttpClient<TCMBService>();
builder.Services.AddScoped<TCMBService>();
builder.Services.AddHostedService<EuroKuruBackgroundService>();

builder.Services.AddEnjoRateLimiter();

// CORS politikası ekle
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3006")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Configure the HTTP request pipeline.
// Swagger'ı her ortamda aktif et
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

// CORS middleware'i ekle
app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();

app.Run();