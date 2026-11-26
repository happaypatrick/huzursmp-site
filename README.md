# HuzurSmp Web Sitesi

KralMC tarzı, açık yeşil ve cam efektli statik site. Mağaza ve launcher bölümleri yok.

## Dosyalar

- `index.html` - sayfa yapısı
- `style.css` - tema ve responsive düzen
- `script.js` - bölüm geçişi, IP kopyalama, giriş/kayıt, canlı durum, aktif yönetim, müzik ve menü
- `logo.svg` - favicon / navbar logosu
- `index.js` - güvenli giriş Worker kaynak kodu
- `wrangler.toml` - Worker ayarı
- `README-WORKER.md` - Worker kurulum rehberi

## Arkadaşlarına / herkese nasıl paylaşırsın

En kolayı GitHub Pages. Ücretsiz, kredi kartı istemez, bilgisayarın açık olmasına gerek yok.

1. GitHub'a giriş yap → **New repository**.
2. Repo adı: `huzursmp-site` (Public olsun).
3. Repoyu **README ile başlatma**, boş kalsın.
4. `Add file` → `Upload files` → bu klasördeki dosyaların tamamını sürükle-bırak yükle → **Commit changes**.
5. Repo → **Settings** → **Pages** → **Source**: `Deploy from a branch` →Branch `main`, klasör `/ (root)` → **Save**.
6. 1-3 dakika bekle. Site adresin:

`https://<SENIN_KULLANICI_ADIN>.github.io/huzursmp-site/`

Bu linki kopyalayıp arkadaşlarına atabilirsin. İstersen Discord, Instagram, biyografi vb. her yere koyabilirsin.

Daha kısa bir adres istersen repo adını `<kullanici>.github.io` yaparsın; o zaman link `https://<kullanici>.github.io/` olur.

Sonradan dosya değiştirirsen repoya yeni commit atman yeterli; site birkaç saniye içinde güncellenir.

Git kurulu olmasa bile tarayıcıdan yükleme yeterli. Git kurarsan şu komutlarla da push edebilirsin:

```bash
cd "C:\Users\Swainy\Documents\Varsayılan Proje\huzursmp-site"
git init
git add .
git commit -m "HuzurSmp site"
git branch -M main
git remote add origin https://github.com/<kullanici>/huzursmp-site.git
git push -u origin main
```

## Sadece aynı Wi-Fi'deki arkadaşlara (geçici)

Klasör içinde:

```bash
python -m http.server 8000
```

Arkadaşların senin yerel IP'nle girer: `http://192.168.1.XX:8000`

Bu yöntem sadece aynı ağda çalışır, herkese açık değildir. Gerçek ev IP'ni dışarıya vermek için kullanma.

## Yerel test

Klasör içinde:

```bash
python -m http.server 8000
```

Ardından tarayıcıdan `http://localhost:8000` adresini aç.

## Müzik (opsiyonel)

Sağ alttaki müzik düğmesi `assets/huzursmp-theme.mp3` dosyasını arar. Dosya yoksa düğme uyarı gösterir. Kendi mp3'ünü o yola koyarsan çalışır.

## Site girişi

Navbar'daki **Giriş Yap** düğmesi kayıt/giriş penceresi açar. İki mod vardır:

### Yerel mod (şu anki yayın)

- Kullanıcılar `localStorage` içinde tutulur
- Şifreler SHA-256 hash olarak saklanır
- Giriş yapan kullanıcı adı navbar'da görünür
- Kurucu adı (`Jrpython`) kayda ve girişe kapalıdır
- Profil avatarı, biyografi ve kayıt tarihi tarayıcıda saklanır
- **Gerçek hesap koruması yoktur**; sadece site görünümü içindir

### Güvenli mod (Worker yayına alınınca)

Repo kökündeki Cloudflare Worker (`index.js`) devreye girer:

- Kayıtta e-posta doğrulama kodu gider
- Yeni cihazdan girişte kullanıcının e-postasına 6 haneli kod gider
- IP değişirse yine kod istenir
- Kod 10 dakika geçerli, 5 yanlış denemede iptal
- Şifreler sunucuda PBKDF2 ile hash'lenir
- Oturum `HttpOnly + Secure` çerezinde tutulur
- Kurucu adları Worker tarafında da kayda ve girişe kapatılır

Açmak için `script.js` içinde:

```js
const AUTH_API_BASE = '';
```

satırına Worker adresini yaz. Kurulum için `README-WORKER.md` dosyasına bak.

Bu giriş **Minecraft hesabını doğrulamaz**; site hesabı içindir.

## Site koruması

GitHub Pages statik olduğu için GitHub katmanı gelen trafiği karşılar; sunucu tarafında bir açık yoktur. Yine de sitenin dış API bağımlılığı şu şekilde korunur:

- Durum verisi tarayıcıda 5 dakika önbelleğe alınır
- Aynı anda birden fazla durum isteği açılmaz (`statusFetching`)
- API çökerse son bilinen durum önbellekten gösterilir
- Üst üste hata olursa sorgu aralığı 1 dakikadan 5 dakikaya çekilir
- Her istek 8 saniyede timeout'a düşer
- Giriş formunda 5 yanlış denemeden sonra 30 saniyelik kilit vardır

Bu önlemler sitenin yavaşlamasını ve API rate limit'e takılmasını engeller.

## Canlı sunucu durumu

Ana sayfadaki durum çubuğu `https://api.mcsrvstat.us/3/fried-latch.tun.ply.gg` adresini 60 saniyede bir sorgular:

- Sunucu ayakta → yeşil nokta ve **Açık**
- Sunucu kapalı veya API'ye ulaşılamadı → kırmızı nokta ve **Kapalı**
- Yanında `Oyuncu: online/max` bilgisi gösterilir
- Destek bölümündeki aktif yönetim kutusu **sadece kurucu sunucudayken** görünür; kurucu yoksa kutu tamamen gizlenir

Aktif yönetim listesi `script.js` içindeki `STAFF` dizisinden gelir:

```js
const STAFF = [
    { name: 'Jrpython', role: 'Kurucu' },
    { name: 'HET', role: 'Admin' },
    { name: 'KimsesizMaakina', role: 'Admin' }
];
```

Yeni kurucu/admin eklenirse buraya ekle. API'nin döndürdüğü oyuncu listesinde `Jrpython` varsa kutu açılır ve `Aktif kurucu: ...` / `Aktif admin: ...` yazar; kurucu listede yoksa kutu gizli kalır.

API 5 dakika cache kullandığı için bot korumasının ping flood eşiğine takılmaz. `enable-query=false` olsa da server list ping çalıştığı için durum sorgusu sorunsuzdur.

## Sunucu adresi

`fried-latch.tun.ply.gg` (port 25565). Değişirse `index.html` ve `script.js` içindeki adresi birlikte güncelle.
