// Basit Authentication Service
class AuthService {
  constructor() {
    this.baseURL = '/api'
    this.currentUser = null
    this.loadUserFromStorage()
  }

  // localStorage'dan kullanıcı bilgilerini yükle
  loadUserFromStorage() {
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      this.currentUser = JSON.parse(storedUser)
    }
  }

  // Kullanıcıyı localStorage'a kaydet
  saveUserToStorage(user) {
    this.currentUser = user
    localStorage.setItem('currentUser', JSON.stringify(user))
  }

  // Kullanıcıyı localStorage'dan temizle
  clearUser() {
    this.currentUser = null
    localStorage.removeItem('currentUser')
  }

  // Giriş yapma
  async login(kullaniciAdi, sifre) {
    try {
      const response = await fetch(`${this.baseURL}/giris/giris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ kullaniciAdi, sifre })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Kullanıcı bilgilerini kaydet
        const user = {
          kullaniciAdi: kullaniciAdi,
          rol: result.rol || 'user',
          id: result.id
        }
        
        this.saveUserToStorage(user)
        return { success: true, user }
      } else {
        const error = await response.json()
        return { success: false, message: error.mesaj || 'Giriş başarısız' }
      }
    } catch (error) {
      return { success: false, message: 'Sunucuya bağlanılamıyor' }
    }
  }

  // Çıkış yapma
  logout() {
    this.clearUser()
    window.location.href = '/login'
  }

  // Giriş yapmış mı kontrolü
  isAuthenticated() {
    return this.currentUser !== null
  }

  // Admin mi kontrolü
  isAdmin() {
    return this.currentUser && this.currentUser.rol === 'admin'
  }

  // Kullanıcı mı kontrolü
  isUser() {
    return this.currentUser && this.currentUser.rol === 'user'
  }

  // Mevcut kullanıcı bilgilerini al
  getCurrentUser() {
    return this.currentUser
  }

  // Kullanıcı adını al
  getKullaniciAdi() {
    return this.currentUser ? this.currentUser.kullaniciAdi : null
  }

  // Rolü al
  getRol() {
    return this.currentUser ? this.currentUser.rol : null
  }
}

// Basit User Service
class UserService {
  constructor(authService) {
    this.baseURL = '/api'
    this.authService = authService
  }

  // Tüm kullanıcıları listele
  async getUsers() {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Giriş yapmanız gerekiyor')
    }

    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor')
    }

    try {
      const response = await fetch(`${this.baseURL}/giris/kullanici`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      if (response.status === 401) {
        this.authService.logout()
        throw new Error('Oturum süresi doldu')
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API isteği başarısız:', error)
      throw error
    }
  }

  // Kullanıcı ekle
  async createUser(kullaniciAdi, sifre, rol) {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Giriş yapmanız gerekiyor')
    }

    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor')
    }

    try {
      const userData = { kullaniciAdi, sifre, rol }
      const response = await fetch(`${this.baseURL}/giris/kullanici`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.status === 401) {
        this.authService.logout()
        throw new Error('Oturum süresi doldu')
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.mesaj || 'Kullanıcı eklenemedi')
      }

      return await response.json()
    } catch (error) {
      console.error('Kullanıcı ekleme hatası:', error)
      throw error
    }
  }

  // Kullanıcı güncelle
  async updateUser(id, kullaniciAdi, sifre, rol) {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Giriş yapmanız gerekiyor')
    }

    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor')
    }

    try {
      // Boş şifre alanını filtrele
      const userData = { kullaniciAdi, rol }
      
      // Şifre alanı doluysa ekle
      if (sifre && sifre.trim() !== '') {
        userData.sifre = sifre
      }

      const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.status === 401) {
        this.authService.logout()
        throw new Error('Oturum süresi doldu')
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.mesaj || 'Kullanıcı güncellenemedi')
      }

      return await response.json()
    } catch (error) {
      console.error('Kullanıcı güncelleme hatası:', error)
      throw error
    }
  }

  // Kullanıcı sil
  async deleteUser(id) {
    if (!this.authService.isAuthenticated()) {
      throw new Error('Giriş yapmanız gerekiyor')
    }

    if (!this.authService.isAdmin()) {
      throw new Error('Bu işlem için Admin yetkisi gerekiyor')
    }

    try {
      const response = await fetch(`${this.baseURL}/giris/kullanici/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      if (response.status === 401) {
        this.authService.logout()
        throw new Error('Oturum süresi doldu')
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return true
    } catch (error) {
      console.error('Kullanıcı silme hatası:', error)
      throw error
    }
  }
}

// Service instance'ları oluştur
const authService = new AuthService()
const userService = new UserService(authService)

export { authService, userService }
