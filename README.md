# Bütçe Takip – Android kaynak kodu

Türkçe, çevrimdışı çalışan kişisel gelir-gider ve ödeme takip uygulaması. Arayüz HTML/CSS/JavaScript ile hazırlanmıştır; Android kabuğu Capacitor üzerinden oluşturulur.

## Özellikler

- Aylık/yıllık dönem seçimi ve önceki/sonraki ay geçişi
- Otomatik gelir, gider, bakiye, ödenen ve bekleyen tutar hesapları
- Gelir/gider kaydı ekleme, düzenleme, silme ve durum değiştirme
- Dönem, kategori, tutar, tarih ve not alanları
- Kullanıcının verdiği gelir/gider rutin kategorileri hazır gelir
- Kategori öneri listesi (rutin tür seçimi) ve özel kategori ekleme
- Aynı dönem, tür, kategori, tutar ve tarihte benzer kayıt için çift kayıt uyarısı
- Aylık tekrar eden giderler için sonraki 12 aya otomatik kayıt
- İşlem arama; arama yapıldığında tüm dönemlerde arama
- Her dönem için ayrı not alanı
- İki dönem arasında gelir/gider/bakiye karşılaştırması
- JSON yedek alma ve yedeği geri yükleme (Android paylaşım menüsü üzerinden dosyaya kaydetme)
- Excel (.xlsx) ve PDF raporu
- Yerel profil, avatar ve PBKDF2 ile parola özeti saklama
- Açık/koyu görünüm ve beş pastel tema
- Android yerel bildirimleri; bildirim üzerinden “Ödendi” ve “1 saat sonra” eylemleri

## 1. GitHub üzerinden APK oluşturma

1. GitHub'da boş bir repository oluşturun.
2. Bu klasörün içindeki bütün dosyaları repository'nin kök dizinine yükleyin. `.github/workflows/build-android.yml` dosyası da mutlaka yüklenmiş olmalı.
3. Dosyaları `main` veya `master` dalına gönderin.
4. GitHub repository sayfasında **Actions** sekmesine girin.
5. **Android APK üret** iş akışını açın. Otomatik başlamadıysa **Run workflow** düğmesini kullanın.
6. İş akışı yeşil tik ile tamamlandığında sayfanın altındaki **Artifacts** alanından `butce-takip-debug-apk` dosyasını indirin.
7. ZIP içinden çıkan `app-debug.apk` dosyasını Android telefonunuza aktararak kurun.

İlk kurulum sırasında Android, Google Play dışından yüklenen APK için izin isteyebilir. Yalnızca kendi oluşturduğunuz ve kaynağını bildiğiniz APK'yı kurun.

## 2. Bilgisayarda geliştirme / yerel APK

Gerekli araçlar: Node.js 22.12 veya üstü, Android Studio ve Android SDK. Android Studio'nun kurduğu JDK 21 kullanılabilir.

```bash
npm install
npm run build
npx cap add android
node scripts/patch-android.mjs
npx cap sync android
npx cap open android
```

Android Studio açıldıktan sonra `Build > Build Bundle(s) / APK(s) > Build APK(s)` menüsüyle APK alınabilir.

Web önizleme için:

```bash
npm run dev
```

## 3. Hatırlatmaların çalışması

- Hatırlatmalar `@capacitor/local-notifications` ile cihaz üzerinde zamanlanır; sunucu veya internet gerekmez.
- Ayarlar ekranında **Bildirim iznini etkinleştir** düğmesine basın.
- Dakikası dakikasına zamanlama için Android 12 ve üzerindeki **Alarmlar ve hatırlatıcılar / Tam zamanlı alarmlar** erişimini de etkinleştirin.
- Android bildirim sesi sistemin bildirim sesini kullanır. Telefon sessizdeyse, uygulama bildirimleri engelliyse, pil tasarrufu üretici tarafından sıkı biçimde uygulanıyorsa veya tam alarm izni verilmemişse uyarı sessiz ya da gecikmeli olabilir.
- Uygulama her açıldığında ödenmemiş giderlerin hatırlatmaları tekrar eşitlenir.

## 4. Veri ve parola notları

- Gelir/gider kayıtları IndexedDB içinde yalnızca uygulamanın bulunduğu cihazda tutulur.
- Bu sürümde çevrimiçi hesap, sunucu, çoklu cihaz eşitleme veya otomatik bulut yedekleme yoktur.
- Parola düz metin saklanmaz; PBKDF2-SHA-256 ile tuzlanmış özet saklanır. Bu, veritabanı dosyasının tamamının şifrelendiği anlamına gelmez.
- JSON yedek dosyası okunabilir biçimdedir ve profil özetini de içerir. Yedek dosyasını gizli/veri içeren bir dosya gibi koruyun.
- Uygulamayı kaldırmak veya Android uygulama verisini temizlemek yerel kayıtları silebilir. Düzenli JSON yedeği alın.

## 5. Proje dosya yapısı

```text
butce-takip/
├── .github/
│   └── workflows/
│       └── build-android.yml
├── scripts/
│   └── patch-android.mjs
├── src/
│   ├── services/
│   │   ├── auth.js
│   │   ├── categories.js
│   │   ├── db.js
│   │   ├── file-export.js
│   │   ├── notifications.js
│   │   ├── reports.js
│   │   └── utils.js
│   ├── main.js
│   └── styles.css
├── capacitor.config.ts
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 6. Önemli sınırlar

Bu kaynak, kişisel kullanım için işlevsel bir başlangıç uygulamasıdır; gerçek finans kurumlarıyla bağlantı kurmaz, banka hareketlerini otomatik çekmez ve parolayla veritabanı şifrelemesi yapmaz. Android bildirim eylemleri cihaz/Android sürümüne göre farklı görünebilir. APK'yı kendi telefonunuza yüklemeden önce örnek verilerle kayıt, yedekleme, geri yükleme ve bildirim testlerini yapın.
