# HuzurSmp Web Sitesi

KralMC tarzı, açık yeşil ve cam efektli statik site. Mağaza ve launcher bölümleri yok.

## Dosyalar

- `index.html` - sayfa yapısı
- `style.css` - tema ve responsive düzen
- `script.js` - bölüm geçişi, IP kopyalama, giriş/kayıt, canlı durum, aktif yönetim, müzik ve menü
- `logo.svg` - favicon / navbar logosu

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

Navbar'daki **Giriş Yap** düğmesi kayıt/giriş penceresi açar. Bu sistem tamamen tarayıcıda çalışır:

- Kullanıcılar `localStorage` içinde tutulur
- Şifreler SHA-256 hash olarak saklanır
- Giriş yapan kullanıcı adı navbar'da görünür
- Çıkış yap butonu profil penceresindedir

Bu giriş **Minecraft hesabını doğrulamaz**; sadece site görünümü içindir. Gerçek hesap sistemi istersen bir backend gerekir.

## Canlı sunucu durumu

Ana sayfadaki durum çubuğu `https://api.mcsrvstat.us/3/fried-latch.tun.ply.gg` adresini 60 saniyede bir sorgular:

- Sunucu ayakta → yeşil nokta ve **Açık**
- Sunucu kapalı veya API'ye ulaşılamadı → kırmızı nokta ve **Kapalı**
- Yanında `Oyuncu: online/max` bilgisi gösterilir
- Destek bölümünde aktif kurucu/admin adı gösterilir

Aktif yönetim listesi `script.js` içindeki `STAFF` dizisinden gelir:

```js
const STAFF = [
    { name: 'happaypatrickD', role: 'Kurucu' },
    { name: 'Mavzerina', role: 'Kurucu' },
    { name: 'HET', role: 'Admin' },
    { name: 'KimsesizMaakina', role: 'Admin' }
];
```

Yeni kurucu/admin eklenirse buraya ekle. API'nin döndürdüğü oyuncu listesiyle eşleşirse destek kısmında `Aktif kurucu: ...` / `Aktif admin: ...` yazar.

API 5 dakika cache kullandığı için bot korumasının ping flood eşiğine takılmaz. `enable-query=false` olsa da server list ping çalıştığı için durum sorgusu sorunsuzdur.

## Sunucu adresi

`fried-latch.tun.ply.gg` (port 25565). Değişirse `index.html` ve `script.js` içindeki adresi birlikte güncelle.
