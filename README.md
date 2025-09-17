# AutoQuery-bot

Panduan Instalasi dan Penggunaan
1. Install Node.js dan NPM
Pastikan Anda telah menginstall Node.js versi 16 atau lebih tinggi:

bash
sudo apt update
sudo apt install nodejs npm
node --version  # Harus menunjukkan versi 16 atau lebih tinggi
2. Setup Project
bash
# Buat folder project
mkdir telegram-query-bot
cd telegram-query-bot

# Install dependencies
``npm install``

3. Buat File Konfigurasi
phone.txt (satu nomor per baris):

text
+628123456789
+628987654321
bot.txt (format: bot_username|api_url):

text
@animix_game_bot|https://pro-api.animix.tech
@another_bot|https://api.example.com
4. Dapatkan API ID dan Hash
Kunjungi https://my.telegram.org

Login dengan akun Telegram Anda

Buat aplikasi baru di bagian "API Development Tools"

Catat API ID dan API Hash

5. Jalankan Script
bash
# Jalankan sekali
npm start

# Atau jalankan dengan PM2 untuk menjalankan 24/7
npm install -g pm2
pm2 start telegram-query.js --name "telegram-query"
pm2 startup
pm2 save
6. Monitor Logs
bash
# Jika menggunakan PM2
pm2 logs telegram-query

# Jika tidak menggunakan PM2, script akan terus berjalan di foreground
Fitur Script
✅ Login dengan multiple nomor dari file phone.txt

✅ Meminta input OTP manual untuk setiap nomor

✅ Menyimpan session per nomor di folder sessions/

✅ Auto get query dari bot yang terdaftar di bot.txt

✅ Mendukung format bot_username|api_url di bot.txt

✅ Menyimpan query di folder queries/[nomor]/[bot]_query.txt

✅ Query baru ditambahkan di atas tanpa menimpa yang lama

✅ Jadwal eksekusi setiap 6 jam

✅ Berjalan 24/7 tanpa henti

✅ Error handling dan restart otomatis
