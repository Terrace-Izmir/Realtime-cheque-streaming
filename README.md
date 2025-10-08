# Sevk Takip - Prototype

Basit bir mobil-uyumlu sevk takip prototipi.

---

English

This is a lightweight mobile-first dispatch tracking prototype.

Features:
- Create orders/receipts
- Driver photo uploads
- Per-receipt Q&A (prompted on start/complete)
- Real-time notifications (Socket.io)
- Data persisted to SQLite (local file)

Quick start (Windows PowerShell):

```powershell
cd 'C:/Users/Zirve/Documents/banka/Realtime-cheque-streaming'
npm install
npm start
```

The app serves on http://localhost:3000 by default. To access from other devices on your LAN use your PC's IP (for example http://192.168.1.10:3000). You may need to allow incoming connections in Windows Firewall or use a tunneling tool like ngrok.

Note: This prototype does not include production-ready security. Add authentication, file validation, HTTPS and authorization before using in production.


Özellikler:
- Sipariş oluşturma
- Sürücü fotoğrafı çekme (upload)
- Fiș başına soru/cevap (prompt ile)
- Gerçek zamanlı bildirimler (Socket.io)
- Veriler SQLite'ta saklanır

Kurulum (Windows PowerShell):

```powershell
cd 'C:/Users/Zirve/Documents/banka/Realtime-cheque-streaming'
npm install
npm start
```

Varsayılan olarak uygulama http://localhost:3000 üzerinde çalışır. Aynı ağdaki diğer cihazlardan erişmek için bilgisayarınızın IP adresini kullanın (ör. http://192.168.1.10:3000). Windows Güvenlik Duvarı'nda gelen bağlantıya izin vermeniz gerekebilir.

Notlar:
- Bu prototip üretim için güvenlik/kimlik doğrulama içermez. Gerçek kullanımda kimlik doğrulama, sağlam dosya doğrulama, HTTPS ve yetkilendirme ekleyin.
- Bilgisayarınızı bir 'server' gibi kullanmak için bu uygulamayı arka planda çalıştırabilir veya NSSM gibi bir araçla Windows hizmeti olarak kaydedebilirsiniz.

Ek Özellikler (iade / return):

- İade kaydı: Ön uçta "+ Yeni İade" butonu veya her sipariş kartındaki "İade" düğmesi ile bir siparişi iade (returned) olarak işaretleyebilirsiniz.
- İade fotoğrafı: İade modalinde kamera / dosya upload seçeneği var; fotoğraf `uploads/` klasörüne kaydedilir ve siparişe `returnPhoto` olarak iliştirilir.
- İade notları: İade sebebi/nota girilebilir ve `returnNotes` alanında JSON olarak saklanır.
- Filtreler: Arayüzde iade tarih aralığı (İade aralığı) seçerek iade edilmiş siparişleri tarih aralığına göre filtreleyebilirsiniz.

API (özet):
- POST /api/orders/:id/return  — FormData veya JSON ile iade kaydı oluşturur. FormData gönderiyorsanız `photo` alanına dosya ekleyin; `notes` alanı JSON string veya obje olabilir.

Örnek (FormData, fetch):
```js
const fd = new FormData();
fd.append('notes', JSON.stringify({ text: 'Hasarlı ürün' }));
fd.append('photo', fileInput.files[0]);
fetch('/api/orders/123/return', { method: 'POST', body: fd });
```

Kısa not: Mevcut prototip, veritabanında yeni sütunları (returnedAt, returnNotes, returnPhoto) otomatik olarak ekler. Eğer `data.db`'niz eski bir formatta ise uygulama ilk çalıştırmada gerekli sütunları ekleyecektir.
