using System.Collections.Concurrent;

namespace enjoapi.Services;

public sealed class LoginAttemptService
{
    public const int Limit = 5;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private readonly ConcurrentDictionary<string, AttemptWindow> _attempts = new();

    public readonly record struct Result(bool Allowed, int Remaining, int Limit, int KilitlemeKalanSaniye);

    private sealed class AttemptWindow
    {
        public DateTimeOffset Start;
        public int Count;
    }

    private static int LockSeconds(AttemptWindow window, DateTimeOffset now)
    {
        if (window.Count < Limit) return 0;
        var left = Window - (now - window.Start);
        return left <= TimeSpan.Zero ? 0 : (int)Math.Ceiling(left.TotalSeconds);
    }

    public Result Peek(string key)
    {
        var now = DateTimeOffset.UtcNow;
        if (!_attempts.TryGetValue(key, out var window))
        {
            return new Result(true, Limit, Limit, 0);
        }

        lock (window)
        {
            if (now - window.Start >= Window)
            {
                return new Result(true, Limit, Limit, 0);
            }

            return new Result(window.Count < Limit, Math.Max(0, Limit - window.Count), Limit, LockSeconds(window, now));
        }
    }

    public Result Consume(string key)
    {
        var now = DateTimeOffset.UtcNow;
        var window = _attempts.GetOrAdd(key, _ => new AttemptWindow { Start = now, Count = 0 });

        lock (window)
        {
            if (now - window.Start >= Window)
            {
                window.Start = now;
                window.Count = 0;
            }

            if (window.Count >= Limit)
            {
                return new Result(false, 0, Limit, LockSeconds(window, now));
            }

            window.Count++;
            return new Result(true, Limit - window.Count, Limit, LockSeconds(window, now));
        }
    }
}
