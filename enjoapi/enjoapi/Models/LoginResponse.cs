namespace enjoapi.Models;

public class LoginResponse
{
    public string Mesaj { get; set; } = string.Empty;
    public string Rol { get; set; } = string.Empty;
    public int Id { get; set; }
    public int KalanDeneme { get; set; }
    public int ToplamDeneme { get; set; }
    public int KilitlemeKalanSaniye { get; set; }
}
