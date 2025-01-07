# Aritatürk Personel Giriş Çıkış Takip Sistemi

Bu uygulama, personel giriş-çıkış ve mola sürelerini analiz eden bir web arayüzüdür.

## Özellikler

- CSV dosyası yükleme ve analiz
- Personel bazlı ortalama giriş-çıkış saatleri
- Ortalama mola süreleri hesaplama
- Sapma gösteren günlerin tespiti
- Şirket geneli istatistikler
- Görsel grafikler ile raporlama

## Kurulum

1. Projeyi klonlayın
2. Bağımlılıkları yükleyin:
   ```bash
   npm run install-deps
   ```

## Kullanım

1. Uygulamayı başlatın:
   ```bash
   npm start
   ```
2. Tarayıcınızda `http://localhost:5173` adresine gidin
3. CSV dosyanızı yükleyin ve sonuçları görüntüleyin

## CSV Dosya Formatı

CSV dosyası aşağıdaki sütunları içermelidir:

- Tc Kimlik No
- Sicil No
- Personel Adı Soyadı
- Tarih
- Saat
- Durum (G: Giriş, C: Çıkış)
- Kaynak

## Teknolojiler

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express
- Grafikler: Chart.js 