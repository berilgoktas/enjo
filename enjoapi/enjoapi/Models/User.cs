namespace enjoapi.Models;

public class User
{
    public int Id { get; set; }
    public string KullaniciAdi { get; set; } = string.Empty;
    public string Sifre { get; set; } = string.Empty;
    public string Rol { get; set; } = "user"; // "user" veya "admin"
    public DateTime OlusturmaTarihi { get; set; } = DateTime.Now;
}
