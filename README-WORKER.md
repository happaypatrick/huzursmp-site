# HuzurSmp güvenli giriş Worker'ı

GitHub Pages statik olduğu için e-posta göndermek, IP görmek ve oturum çerezi tutmak mümkün değil. Bu klasördeki Worker gerçek korumayı sağlar:

- Kayıt e-postasına 6 haneli doğrulama kodu gider
- Yeni cihazda girişte koda e-posta gider
- IP değişirse giriş kodu istenir
- Kodlar 10 dakika geçerli, 5 yanlış denemede iptal
- Şifreler PBKDF2 + random salt ile hash'lenir
- Oturum `HttpOnly + Secure + SameSite=None` çereziyle tutulur
- IP ve giris denemeleri KV'de rate-limit'e tabi

## 1. Cloudflare hazırlığı

Ücretsiz Workers + KV kullanılır, kredi kartı gerekmez.

```powershell
npm install -g wrangler
wrangler login
wrangler kv namespace create AUTH_KV
wrangler kv namespace create AUTH_KV --preview
```

Çıkan `id` ve `preview_id` değerlerini `wrangler.toml` içine yaz.

## 2. E-posta sağlayıcısı

### Resend (önerilen)

1. https://resend.com → ücretsiz hesap aç
2. Domain doğrula (örn. `mail.huzursmp.net`)
3. API key oluştur
4. `wrangler.toml` içinde:

```toml
MAIL_PROVIDER = "resend"
MAIL_FROM = "HuzurSmp <no-reply@SENIN-DOMAININ.com>"
```

5. Secret olarak key'i yaz:

```powershell
wrangler secret put MAIL_API_KEY
wrangler secret put CODE_SECRET
wrangler secret put SESSION_SECRET
```

`CODE_SECRET` ve `SESSION_SECRET` için uzun rastgele metinler kullan.

### Brevo alternatifi

`wrangler.toml` içinde `MAIL_PROVIDER = "brevo"` yap, gönderen e-postayı doğrula, yine `MAIL_API_KEY` secret'ını tanımla.

## 3. Worker'ı yayınla

Bu klasörde:

```powershell
wrangler deploy
```

Çıkan adres örnek:

`https://huzursmp-auth.SENIN-HESAPIN.workers.dev`

Sağlık kontrolü:

`https://huzursmp-auth.SENIN-HESAPIN.workers.dev/api/health`

## 4. Siteyi bağla

`../script.js` dosyasının üst kısmında:

```js
const AUTH_API_BASE = '';
```

satırını Worker adresinle değiştir:

```js
const AUTH_API_BASE = 'https://huzursmp-auth.SENIN-HESAPIN.workers.dev';
```

Boş kalırsa site eski yerel giriş modunda çalışmaya devam eder. Worker adresi yazılınca kayıt formuna e-posta alanı ve kod ekranı otomatik devreye girer.

Sonra `index.html`, `script.js`, `style.css` dosyalarını GitHub repoya yükle. Worker ayrı yayında olduğu için Pages ayarlarına dokunmana gerek yok.

## Notlar

- Eski localStorage hesapları Worker'a taşınmaz. Oyuncular yeniden kayıt olur.
- `wrangler secret` değerleri repoya yazılmaz.
- `ALLOWED_ORIGIN` sadece `https://happaypatrick.github.io` olduğu için başka site Worker'ı kullanamaz.
- IP, Cloudflare `CF-Connecting-IP` header'ından gelir; tarayıcıdan sahtelenemez.
