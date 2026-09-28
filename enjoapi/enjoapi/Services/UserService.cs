using enjoapi.Models;
using Microsoft.Data.SqlClient;

namespace enjoapi.Services;

public class UserService : IUserService
{
    private readonly string _connectionString;

    public UserService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("Default")!;
    }

    public async Task<User> AuthenticateUser(string kullaniciAdi, string sifre)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT Id, KullaniciAdi, Sifre, ISNULL(Rol, 'user') as Rol FROM dbo.Kullanicilar WHERE KullaniciAdi=@u AND Sifre=@p";
        cmd.Parameters.AddWithValue("@u", kullaniciAdi);
        cmd.Parameters.AddWithValue("@p", sifre);
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            return new User
            {
                Id = reader.GetInt32(0),
                KullaniciAdi = reader.GetString(1),
                Sifre = reader.GetString(2),
                Rol = reader.GetString(3),
                OlusturmaTarihi = DateTime.Now // Varsayılan tarih
            };
        }
        
        return null;
    }

    public async Task<List<User>> GetAllUsers()
    {
        var users = new List<User>();
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT Id, KullaniciAdi, Sifre, ISNULL(Rol, 'user') as Rol FROM dbo.Kullanicilar ORDER BY Id";
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        while (await reader.ReadAsync())
        {
            users.Add(new User
            {
                Id = reader.GetInt32(0),
                KullaniciAdi = reader.GetString(1),
                Sifre = reader.GetString(2),
                Rol = reader.GetString(3),
                OlusturmaTarihi = DateTime.Now // Varsayılan tarih
            });
        }
        
        return users;
    }

    public async Task<User> GetUserById(int id)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT Id, KullaniciAdi, Sifre, ISNULL(Rol, 'user') as Rol FROM dbo.Kullanicilar WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            return new User
            {
                Id = reader.GetInt32(0),
                KullaniciAdi = reader.GetString(1),
                Sifre = reader.GetString(2),
                Rol = reader.GetString(3),
                OlusturmaTarihi = DateTime.Now // Varsayılan tarih
            };
        }
        
        return null;
    }

    public async Task<User> GetUserByUsername(string kullaniciAdi)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT Id, KullaniciAdi, Sifre, ISNULL(Rol, 'user') as Rol FROM dbo.Kullanicilar WHERE KullaniciAdi=@u";
        cmd.Parameters.AddWithValue("@u", kullaniciAdi);
        await con.OpenAsync();
        using var reader = await cmd.ExecuteReaderAsync();
        
        if (await reader.ReadAsync())
        {
            return new User
            {
                Id = reader.GetInt32(0),
                KullaniciAdi = reader.GetString(1),
                Sifre = reader.GetString(2),
                Rol = reader.GetString(3),
                OlusturmaTarihi = DateTime.Now // Varsayılan tarih
            };
        }
        
        return null;
    }

    public async Task<User> CreateUser(User user)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        
        // OlusturmaTarihi sütunu olmadan basit INSERT
        cmd.CommandText = @"INSERT INTO dbo.Kullanicilar (KullaniciAdi, Sifre, Rol)
                        VALUES (@u, @p, @r);
                        SELECT CAST(SCOPE_IDENTITY() AS int);";
        
        cmd.Parameters.AddWithValue("@u", user.KullaniciAdi);
        cmd.Parameters.AddWithValue("@p", user.Sifre);
        cmd.Parameters.AddWithValue("@r", user.Rol);
        await con.OpenAsync();
        var result = await cmd.ExecuteScalarAsync();
        user.Id = result != null ? (int)result : 0;
        user.OlusturmaTarihi = DateTime.Now; // Kod tarafında tarih ata
        return user;
    }

    public async Task<User> UpdateUser(User user)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE dbo.Kullanicilar
                        SET KullaniciAdi=@u, Sifre=@p, Rol=@r
                        WHERE Id=@id";
        cmd.Parameters.AddWithValue("@u", user.KullaniciAdi);
        cmd.Parameters.AddWithValue("@p", user.Sifre);
        cmd.Parameters.AddWithValue("@r", user.Rol);
        cmd.Parameters.AddWithValue("@id", user.Id);
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        return user;
    }

    public async Task DeleteUser(int id)
    {
        using var con = new SqlConnection(_connectionString);
        using var cmd = con.CreateCommand();
        cmd.CommandText = "DELETE FROM dbo.Kullanicilar WHERE Id=@id";
        cmd.Parameters.AddWithValue("@id", id);
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
    }
}