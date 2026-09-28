using enjoapi.Models;
using enjoapi.Services;
using Microsoft.AspNetCore.Mvc;

namespace enjoapi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GirisController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly LoginAttemptService _loginAttempts;

    public GirisController(IUserService userService, LoginAttemptService loginAttempts)
    {
        _userService = userService;
        _loginAttempts = loginAttempts;
    }

    private string GetClientKey()
    {
        return Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
            ?? HttpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";
    }

    [HttpGet("kalan-deneme")]
    public ActionResult<object> KalanDeneme()
    {
        var info = _loginAttempts.Peek(GetClientKey());
        return Ok(new { kalanDeneme = info.Remaining, toplamDeneme = info.Limit, kilitlemeKalanSaniye = info.KilitlemeKalanSaniye });
    }

    // POST: api/giris/giris
    [HttpPost("giris")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        try
        {
            var attempt = _loginAttempts.Consume(GetClientKey());
            if (!attempt.Allowed)
            {
                return StatusCode(StatusCodes.Status429TooManyRequests, new LoginResponse
                {
                    Mesaj = "Deneme hakkınız doldu.",
                    KalanDeneme = 0,
                    ToplamDeneme = attempt.Limit,
                    KilitlemeKalanSaniye = attempt.KilitlemeKalanSaniye
                });
            }

            var user = await _userService.AuthenticateUser(request.KullaniciAdi, request.Sifre);
            
            if (user == null)
            {
                return Unauthorized(new LoginResponse 
                { 
                    Mesaj = "Geçersiz kullanıcı adı veya şifre",
                    KalanDeneme = attempt.Remaining,
                    ToplamDeneme = attempt.Limit,
                    KilitlemeKalanSaniye = attempt.KilitlemeKalanSaniye
                });
            }

            return Ok(new LoginResponse 
            { 
                Mesaj = "Giriş başarılı",
                Rol = user.Rol,
                Id = user.Id,
                KalanDeneme = attempt.Remaining,
                ToplamDeneme = attempt.Limit,
                KilitlemeKalanSaniye = attempt.KilitlemeKalanSaniye
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new LoginResponse 
            { 
                Mesaj = "Sunucu hatası: " + ex.Message 
            });
        }
    }

    // GET: api/giris/kullanici
    [HttpGet("kullanici")]
    public async Task<ActionResult<List<User>>> GetUsers()
    {
        try
        {
            var users = await _userService.GetAllUsers();
            return Ok(users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Mesaj = "Kullanıcılar yüklenemedi: " + ex.Message });
        }
    }

    // POST: api/giris/kullanici
    [HttpPost("kullanici")]
    public async Task<ActionResult<User>> CreateUser(User user)
    {
        try
        {
            if (string.IsNullOrEmpty(user.KullaniciAdi) || string.IsNullOrEmpty(user.Sifre))
            {
                return BadRequest(new { Mesaj = "Kullanıcı adı ve şifre gerekli" });
            }

            var existingUser = await _userService.GetUserByUsername(user.KullaniciAdi);
            if (existingUser != null)
            {
                return Conflict(new { Mesaj = "Bu kullanıcı adı zaten kullanılıyor" });
            }

            var newUser = await _userService.CreateUser(user);
            return Ok(newUser);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Mesaj = "Kullanıcı oluşturulamadı: " + ex.Message });
        }
    }

    // PUT: api/giris/kullanici/{id}
    [HttpPut("kullanici/{id}")]
    public async Task<ActionResult<User>> UpdateUser(int id, User user)
    {
        try
        {
            if (id != user.Id)
            {
                return BadRequest(new { Mesaj = "ID uyumsuzluğu" });
            }

            var existingUser = await _userService.GetUserById(id);
            if (existingUser == null)
            {
                return NotFound(new { Mesaj = "Kullanıcı bulunamadı" });
            }

            var updatedUser = await _userService.UpdateUser(user);
            return Ok(updatedUser);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Mesaj = "Kullanıcı güncellenemedi: " + ex.Message });
        }
    }

    // DELETE: api/giris/kullanici/{id}
    [HttpDelete("kullanici/{id}")]
    public async Task<ActionResult> DeleteUser(int id)
    {
        try
        {
            var user = await _userService.GetUserById(id);
            if (user == null)
            {
                return NotFound(new { Mesaj = "Kullanıcı bulunamadı" });
            }

            await _userService.DeleteUser(id);
            return Ok(new { Mesaj = "Kullanıcı başarıyla silindi" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Mesaj = "Kullanıcı silinemedi: " + ex.Message });
        }
    }
}