#!/usr/bin/env node
import process from "process";
import fs from "fs";
import path from "path";
import { read } from "read";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { setTimeout as sleep } from "timers/promises";
import { createInterface } from "readline";

// Konfigurasi
const PHONE_FILE = "phone.txt";
const BOT_FILE = "bot.txt";
const SESSION_DIR = "sessions";
const QUERY_DIR = "queries";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam

// Device information untuk fake device
const DEVICE_INFO = {
  deviceModel: "Desktop",
  systemVersion: "Windows 10",
  appVersion: "4.9.1",
  langCode: "en",
};

// Membuat direktori jika belum ada
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Membaca file teks
function readLines(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File ${filePath} tidak ditemukan!`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// Parsing file bot dengan format: bot_username|api_url
function parseBots(filePath) {
  const lines = readLines(filePath);
  return lines.map(line => {
    const [botUsername, apiUrl] = line.split('|').map(part => part.trim());
    return { botUsername, apiUrl };
  }).filter(bot => bot.botUsername && bot.botUsername.startsWith('@'));
}

// Mendapatkan API ID dan Hash dari my.telegram.org
async function getApiCredentials(phoneNumber) {
  console.log(`🌐 Mendapatkan API credentials untuk ${phoneNumber}...`);
  
  // Simulasi mendapatkan API ID dan Hash (dalam praktiknya, ini perlu diimplementasikan)
  // Untuk sekarang kita akan menggunakan nilai default
  return {
    apiId: 123456, // Ganti dengan API ID yang sesuai
    apiHash: "abcdef123456", // Ganti dengan API Hash yang sesuai
  };
  
  // Catatan: Implementasi sebenarnya memerlukan:
  // 1. Membuka browser menggunakan puppeteer
  // 2. Login ke my.telegram.org
  // 3. Membuat aplikasi baru
  // 4. Mengambil API ID dan Hash
  // Ini adalah proses yang kompleks dan mungkin melanggar ToS Telegram
}

// Login ke Telegram
async function loginToTelegram(phoneNumber) {
  const sessionPath = path.join(SESSION_DIR, phoneNumber.replace('+', ''));
  ensureDir(sessionPath);
  
  const sessionFile = path.join(sessionPath, "session.txt");
  const apiFile = path.join(sessionPath, "api.txt");
  let sessionString = "";
  let apiId = 0;
  let apiHash = "";
  
  // Coba load session yang sudah ada
  if (fs.existsSync(sessionFile)) {
    sessionString = fs.readFileSync(sessionFile, "utf-8").trim();
    console.log(`📂 Session ditemukan untuk ${phoneNumber}`);
  }
  
  // Coba load API credentials yang sudah ada
  if (fs.existsSync(apiFile)) {
    const apiContent = fs.readFileSync(apiFile, "utf-8").trim().split('\n');
    if (apiContent.length >= 2) {
      apiId = parseInt(apiContent[0]);
      apiHash = apiContent[1];
      console.log(`📂 API credentials ditemukan untuk ${phoneNumber}`);
    }
  }
  
  // Jika API credentials tidak ditemukan, dapatkan yang baru
  if (!apiId || !apiHash) {
    const credentials = await getApiCredentials(phoneNumber);
    apiId = credentials.apiId;
    apiHash = credentials.apiHash;
    
    // Simpan API credentials
    fs.writeFileSync(apiFile, `${apiId}\n${apiHash}`);
    console.log(`✅ API credentials disimpan untuk ${phoneNumber}`);
  }
  
  console.log(`⏳ Login ke ${phoneNumber}...`);
  
  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    {
      connectionRetries: 5,
      deviceModel: DEVICE_INFO.deviceModel,
      systemVersion: DEVICE_INFO.systemVersion,
      appVersion: DEVICE_INFO.appVersion,
      langCode: DEVICE_INFO.langCode,
    }
  );
  
  try {
    await client.start({
      phoneNumber: () => Promise.resolve(phoneNumber),
      phoneCode: async () => {
        const code = await read({ 
          prompt: `💬 Masukkan kode OTP untuk ${phoneNumber}: ` 
        });
        return code;
      },
      onError: (error) => console.error(`❌ Error: ${error.message}`),
    });
    
    // Simpan session
    const newSessionString = client.session.save();
    fs.writeFileSync(sessionFile, newSessionString);
    
    console.log(`✅ Berhasil login sebagai ${phoneNumber}`);
    return client;
  } catch (error) {
    console.error(`❌ Gagal login dengan ${phoneNumber}:`, error.message);
    return null;
  }
}

// Mendapatkan query dari bot
async function getBotQuery(client, botUsername) {
  try {
    console.log(`   🤖 Mengambil query dari ${botUsername}`);
    
    // Resolve bot entity
    const entity = await client.getEntity(botUsername);
    
    // Kirim pesan /start ke bot
    await client.sendMessage(entity, {
      message: "/start"
    });
    
    // Tunggu beberapa detik untuk response
    await sleep(5000);
    
    // Dapatkan pesan terbaru dari bot
    const messages = await client.getMessages(entity, { limit: 5 });
    
    // Cari pesan yang mengandung query atau data penting
    for (const message of messages) {
      if (message.senderId === entity.id && message.message) {
        // Ekstrak query dari pesan - mencari pola khusus
        const queryMatch = message.message.match(/(query_id=[^&\s]+)/i) || 
                          message.message.match(/(user=%7B[^%]+%7D)/i);
        
        if (queryMatch && queryMatch[1]) {
          return queryMatch[1];
        }
        
        // Jika tidak ditemukan pola khusus, cari parameter query umum
        const urlParams = message.message.match(/([a-z_]+=[^&\s]+)/gi);
        if (urlParams) {
          return urlParams.join('&');
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error mendapatkan query dari ${botUsername}:`, error.message);
    return null;
  }
}

// Simpan query ke file (timpa yang lama)
function saveQuery(botUsername, query) {
  ensureDir(QUERY_DIR);
  
  const botName = botUsername.replace('@', '');
  const queryFile = path.join(QUERY_DIR, `${botName}_query.txt`);
  
  // Timpa query lama dengan yang baru
  fs.writeFileSync(queryFile, query);
  console.log(`   ✅ Query untuk ${botUsername} disimpan: ${query.substring(0, 50)}...`);
  return true;
}

// Kirim query ke API
async function sendQueryToApi(apiUrl, query) {
  try {
    console.log(`   🌐 Mengirim query ke API: ${apiUrl}`);
    
    // Implementasi pengiriman query ke API
    // Contoh menggunakan fetch API (jika menggunakan Node.js 18+)
    /*
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`   ✅ Query berhasil dikirim ke API`);
    */
    
    // Untuk sekarang kita hanya log (karena implementasi fetch tergantung environment)
    console.log(`   📤 Query siap dikirim: ${query.substring(0, 50)}...`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Gagal mengirim query ke API: ${error.message}`);
    return false;
  }
}

// Proses utama
async function main() {
  console.log("🤖 Telegram Query Bot Started");
  console.log("=============================");
  
  // Buat direktori session dan query
  ensureDir(SESSION_DIR);
  ensureDir(QUERY_DIR);

  // Baca nomor telepon
  const phoneNumbers = readLines(PHONE_FILE);
  if (phoneNumbers.length === 0) {
    console.error("❌ Tidak ada nomor telepon di phone.txt");
    process.exit(1);
  }
  console.log(`📱 Ditemukan ${phoneNumbers.length} nomor telepon`);

  // Login untuk setiap nomor
  const clients = [];
  for (const phoneNumber of phoneNumbers) {
    const client = await loginToTelegram(phoneNumber);
    if (client) {
      clients.push({ client, phoneNumber });
      // Jeda antar login untuk menghindari flood
      await sleep(2000);
    }
  }

  if (clients.length === 0) {
    console.error("❌ Tidak ada client yang berhasil login");
    process.exit(1);
  }

  console.log("✅ Login berhasil untuk semua nomor");
  console.log(`⏰ Akan mengambil query setiap ${CHECK_INTERVAL / 3600000} jam`);

  // Fungsi untuk mengambil query dari semua bot
  const fetchAllQueries = async () => {
    console.log("\n🔄 Memulai pengambilan query...");
    console.log(`⏰ Waktu: ${new Date().toLocaleString()}`);
    
    // Baca daftar bot (bisa berubah)
    const bots = parseBots(BOT_FILE);
    if (bots.length === 0) {
      console.log("❌ Tidak ada bot yang ditemukan di bot.txt");
      return;
    }
    console.log(`🤖 Ditemukan ${bots.length} bot`);
    
    for (const { client, phoneNumber } of clients) {
      console.log(`\n📞 Memproses ${phoneNumber}`);
      
      for (const { botUsername, apiUrl } of bots) {
        const query = await getBotQuery(client, botUsername);
        
        if (query) {
          // Simpan query (timpa yang lama)
          saveQuery(botUsername, query);
          
          // Kirim ke API jika ada URL
          if (apiUrl) {
            await sendQueryToApi(apiUrl, query);
          }
        } else {
          console.log(`   ❌ Tidak dapat mengambil query dari ${botUsername}`);
        }
        
        // Jeda antar request untuk menghindari limit
        await sleep(2000);
      }
    }
    
    console.log("\n✅ Pengambilan query selesai");
    console.log(`⏰ Akan mengambil lagi dalam ${CHECK_INTERVAL / 3600000} jam`);
  };

  // Jalankan segera pertama kali
  await fetchAllQueries();
  
  // Jadwalkan setiap 6 jam
  setInterval(fetchAllQueries, CHECK_INTERVAL);
}

// Tangani error yang tidak tertangkap
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Tangani sinyal terminasi
process.on('SIGINT', () => {
  console.log('\n🛑 Script dihentikan oleh pengguna');
  process.exit(0);
});

// Jalankan program
main().catch(console.error);
