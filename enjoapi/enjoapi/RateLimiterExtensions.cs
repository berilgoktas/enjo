using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace enjoapi;

public static class RateLimiterExtensions
{
    public static IServiceCollection AddEnjoRateLimiter(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    mesaj = "Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin."
                }, token);
            };

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                if (HttpMethods.IsOptions(httpContext.Request.Method))
                {
                    return RateLimitPartition.GetNoLimiter("options");
                }

                var ip = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
                    ?? httpContext.Connection.RemoteIpAddress?.ToString()
                    ?? "unknown";

                var path = httpContext.Request.Path.Value ?? string.Empty;
                var isLoginLimit = path.Contains("/giris/giris", StringComparison.OrdinalIgnoreCase)
                    || path.Contains("/giris/kalan-deneme", StringComparison.OrdinalIgnoreCase);

                if (isLoginLimit)
                {
                    return RateLimitPartition.GetNoLimiter("login");
                }

                return RateLimitPartition.GetFixedWindowLimiter($"api:{ip}", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5000,
                    Window = TimeSpan.FromDays(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                });
            });
        });

        return services;
    }
}
