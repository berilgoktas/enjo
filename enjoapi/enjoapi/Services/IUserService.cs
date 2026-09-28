using enjoapi.Models;

namespace enjoapi.Services;

public interface IUserService
{
    Task<User> AuthenticateUser(string kullaniciAdi, string sifre);
    Task<List<User>> GetAllUsers();
    Task<User> GetUserById(int id);
    Task<User> GetUserByUsername(string kullaniciAdi);
    Task<User> CreateUser(User user);
    Task<User> UpdateUser(User user);
    Task DeleteUser(int id);
}
