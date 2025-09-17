# Auto Query bot

A tool for automatically to get Query

### 1. Install Node.js dan NPM
```bash
sudo apt update
sudo apt install nodejs npm
node --version
```

### 2. Setup Project
```bash
git clone https://github.com/willicc/AutoQuery-bot.git
cd AutoQuery-bot
```

```bash
npm install
```

### 3. Buat File Konfigurasi
**phone.txt** (satu nomor per baris):
```
+628123456789
+628987654321
```

**bot.txt** (format: bot_username|api_url):
```
@animix_game_bot|https://pro-api.animix.tech
@another_bot|https://api.example.com
```

### 4. Jalankan Script
```bash
# Jalankan sekali
npm start

# Atau jalankan dengan PM2 untuk menjalankan 24/7
npm install -g pm2
pm2 start telegram-query.js --name "telegram-query"
pm2 startup
pm2 save
```

### 5. Monitor Logs
```bash
# Jika menggunakan PM2
pm2 logs telegram-query

# Jika tidak menggunakan PM2, script akan terus berjalan di foreground
```

## Fitur Script

1. ✅ Login dengan multiple nomor dari file `phone.txt`
2. ✅ Menggunakan fake device information
3. ✅ Menyimpan session untuk menghindari OTP berulang
4. ✅ Auto get query dari bot yang terdaftar di `bot.txt`
5. ✅ Mendukung format `bot_username|api_url` di bot.txt
6. ✅ Menyimpan query di folder `queries/[bot]_query.txt` (menimpa yang lama)
7. ✅ Mengirim query ke API jika URL tersedia
8. ✅ Jadwal eksekusi setiap 6 jam
9. ✅ Berjalan 24/7 tanpa henti
10. ✅ Error handling dan restart otomatis
