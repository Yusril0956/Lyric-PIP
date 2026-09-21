# Spotify Synced Lyrics PiP

Project ini adalah browser extension untuk Spotify Web yang menampilkan lirik yang tersinkronisasi ke musik dalam jendela floating Picture-in-Picture (PiP). Jadi kamu bisa terus mendengarkan lagu sambil melihat lirik yang bergerak sesuai waktu lagu.

Tujuan utama project ini adalah membuat pengalaman listening Spotify terasa lebih lengkap tanpa harus membuka tab tambahan atau melihat layar penuh.

## Fitur utama

- Menampilkan lirik synced dari lagu yang sedang diputar di Spotify Web
- Membuka lirik di jendela PiP yang bisa berdiri sendiri
- Menyesuaikan highlight lirik mengikuti waktu playback
- Menampilkan kontrol dasar seperti progress time dan volume di jendela PiP
- Tidak membutuhkan backend atau server sendiri

## Cara kerja project

Project ini bekerja sebagai browser extension Chrome/Edge/Brave:

1. Extension membaca data lagu dari halaman Spotify Web.
2. Extension mengambil judul lagu, artis, dan durasi dari player yang sedang aktif.
3. Data tersebut dikirim ke layanan LRCLIB untuk mencari lirik yang cocok.
4. Lirik yang didapat berupa format LRC lalu diparsing dan dipindahkan ke jendela PiP.
5. Saat lagu berjalan, posisi waktu diperbarui dan lirik yang aktif berubah sesuai timeline.

## Persyaratan

- Browser Chromium: Chrome, Edge, atau Brave
- Spotify Web terbuka di browser
- Browser yang mendukung Document Picture-in-Picture
- Koneksi internet untuk mengambil data lirik dari LRCLIB

## Instalasi lokal (tanpa Chrome Web Store)

Ini cara paling umum untuk menjalankan extension di komputer kamu tanpa perlu publish ke Chrome Web Store.

### 1. Clone atau download project

```bash
git clone <url-repository-kamu>
cd lyrics-pip-final
```

Atau cukup download ZIP lalu extract ke folder baru.

### 2. Buka halaman extension browser

- Chrome: chrome://extensions
- Edge: edge://extensions
- Brave: brave://extensions

### 3. Aktifkan Developer mode

Nyalakan toggle Developer mode / Pengembang di pojok kanan atas.

### 4. Klik Load unpacked

Klik tombol Load unpacked / Muat paket tidak terkompresi.

### 5. Pilih folder project

Pilih folder tempat project ini berada, misalnya:

```text
C:\Users\NamaKamu\Downloads\lyrics-pip-final
```

### 6. Buka Spotify Web

Masuk ke https://open.spotify.com dan putar lagu.

### 7. Jalankan extension

Setelah extension terpasang, biasanya tombol atau mekanisme yang dibuat di halaman Spotify akan aktif. Jika kamu sudah membuka Spotify Web, extension akan mulai mengambil lirik dan membuka PiP sesuai logika yang dibuat di project.

## Struktur project

```text
.
├── manifest.json
├── background.js
├── content.js
├── main-world.js
├── README.md
├── LICENSE
├── .gitignore
└──
```

## Catatan keamanan dan privasi

Project ini masih aman untuk dipakai dan diupload ke GitHub karena tidak menyimpan token, password, atau data login di repo. Namun, ada satu hal yang penting:

- saat kamu memutar lagu, extension akan mengirim metadata lagu seperti judul lagu, artis, dan durasi ke layanan LRCLIB untuk mencari lirik
- data ini tidak disimpan di repository ini, tetapi dipakai saat request ke API luar

Jadi:

- tidak ada secret di project
- tidak ada database di sini
- tidak ada API key yang harus disimpan di repo
- semua berjalan di browser lokal, bukan backend milik project

Kalau kamu mau privasi lebih tinggi, kamu bisa mengganti API LRCLIB dengan layanan lirik yang kamu hosting sendiri.

## Batasan project

- Hanya bekerja di Spotify Web
- Hanya kompatibel dengan browser yang mendukung PiP
- Tidak semua lagu punya lirik synced
- Tergantung pada struktur DOM Spotify, jadi bisa berubah jika Spotify update tampilan

## Disclaimer

Project ini dibuat untuk kebutuhan pribadi dan bukan produk resmi dari Spotify. Ini adalah utility fan-made untuk pengalaman listening di web.

## Lisensi

Project ini menggunakan lisensi MIT.

## Langkah publish ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <repository-url-kamu>
git push -u origin main
```

Kalau kamu mau, saya juga bisa bantu bikin versi README yang lebih formal dan lebih menarik untuk GitHub, misalnya dengan banner, screenshot, dan deskripsi yang lebih premium.
