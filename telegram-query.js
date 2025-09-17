#!/usr/bin/env node
import process from "process";
import fs from "fs";
import path from "path";
import { read } from "read";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { StoreSession } from "telegram/sessions/StoreSession";
import { setTimeout as sleep } from "timers/promises";

// Konfigurasi
const PHONE_FILE = "phone.txt";
const BOT_FILE = "bot.txt";
const SESSION_DIR = "sessions";
const QUERY_DIR = "queries";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 jam

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

// Login ke Telegram
async function loginToTelegram(phoneNumber, apiId, apiHash) {
  const sessionPath = path.join(SESSION_DIR, phoneNumber.replace('+', ''));
  ensureDir(sessionPath);
  
  const sessionFile = path.join(sessionPath, "session.txt");
  let sessionString = "";
  
  // Coba load session yang sudah ada
  if (fs.existsSync(sessionFile)) {
    sessionString = fs.readFileSync(sessionFile, "utf-8").trim();
    console.log(`📂 Session ditemukan untuk ${phoneNumber}`);
  }
  
  console.log(`⏳ Login ke ${phoneNumber}...`);
  
  const client = new TelegramClient(
    new StringSession(sessionString),
    parseInt(apiId),
    apiHash,
    {
      connectionRetries: 5,
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
        // Ekstrak query dari pesan
        const queryMatch = message.message.match(/query[^=]*=([^&\s]+)/i) || 
                          message.message.match(/data[^=]*=([^&\s]+)/i) ||
                          message.message.match(/(?:query_id|user)=([^&\s]+)/i);
        
        if (queryMatch && queryMatch[1]) {
          return queryMatch[1];
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error mendapatkan query dari ${botUsername}:`, error.message);
    return null;
  }
}

// Simpan query ke file
function saveQuery(phoneNumber, botUsername, query) {
  const phoneDir = phoneNumber.replace('+', '');
  const queryDir = path.join(QUERY_DIR, phoneDir);
  ensureDir(queryDir);
  
  const botName = botUsername.replace('@', '');
  const queryFile = path.join(queryDir, `${botName}_query.txt`);
  
  // Baca query lama jika ada
  let oldQueries = [];
  if (fs.existsSync(queryFile)) {
    const content = fs.readFileSync(queryFile, "utf-8");
    oldQueries = content.split("\n").filter(q => q.trim().length > 0);
  }
  
  // Cek jika query sudah ada di baris pertama (query terbaru)
  if (oldQueries.length > 0 && oldQueries[0] === query) {
    console.log(`   ℹ️ Query untuk ${botUsername} tidak berubah`);
    return false;
  }
  
  // Tambahkan query baru di baris pertama
  const newContent = query + "\n" + oldQueries.join("\n");
  fs.writeFileSync(queryFile, newContent);
  console.log(`   ✅ Query baru untuk ${botUsername} disimpan: ${query}`);
  return true;
}

// Proses utama
async function main() {
  console.log("🤖 Telegram Query Bot Started");
  console.log("=============================");
  
  // Baca API credentials
  const apiId = await read({
    prompt: "⚙️ Masukkan API ID (dari https://my.telegram.org): ",
    silent: true,
    replace: "*",
  });

  const apiHash = await read({
    prompt: "⚙️ Masukkan API Hash (dari https://my.telegram.org): ",
    silent: true,
    replace: "*",
  });

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
    const client = await loginToTelegram(phoneNumber, apiId, apiHash);
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
          saveQuery(phoneNumber, botUsername, query);
          
          // Jika ada API URL, kirim query ke API
          if (apiUrl) {
            try {
              console.log(`   🌐 Mengirim query ke API: ${apiUrl}`);
              // Di sini Anda bisa menambahkan kode untuk mengirim query ke API
              // Contoh: await fetch(apiUrl, { method: 'POST', body: JSON.stringify({ query }) });
            } catch (error) {
              console.error(`   ❌ Gagal mengirim query ke API: ${error.message}`);
            }
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
