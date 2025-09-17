# Auto Query bot

A tool for automatically to get Query

# Auto Query Bot

### 1. Install Node.js and NPM

Make sure you have Node.js v16 or higher installed. Node **v18+ is recommended** (because newer Node includes global `fetch`).

```bash
# Debian/Ubuntu example (may install older Node version from distro repo)
sudo apt update
sudo apt install nodejs npm

# Check versions
node --version   # must show v16+ (v18+ recommended)
npm --version
```

If you need a specific Node version, use Node Version Manager (nvm):

```bash
# Install nvm (if not installed)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
# After installing nvm, restart your shell, then:
nvm install 18
nvm use 18
node --version
```

### 2. Setup Project

```bash
# Create project folder
mkdir telegram-query-bot
cd telegram-query-bot

# Initialize npm (optional)
npm init -y

# Install dependencies (if using node <18 or prefer node-fetch)
npm install telegram node-fetch read
```

> Note: If you run Node.js v18 or later, `fetch` is available globally and `node-fetch` is optional. Installing `node-fetch` ensures compatibility across older Node versions.

### 3. Create Configuration Files

Create `phone.txt` (one phone number per line, international format):

```
+628123456789
+628987654321
```

Create `bot.txt` (format: `@bot_username|api_url`, `api_url` optional):

```
@animix_game_bot|https://pro-api.animix.tech
@another_bot|https://api.example.com
```

### 4. Obtain API ID and API Hash

1. Visit: `https://my.telegram.org`
2. Log in with your Telegram account.
3. Go to **API Development Tools** → **Create new application**.
4. Note down **API ID** and **API Hash**.

You can either enter a **global API ID/API Hash** when the script asks, or provide per-account credentials (the script will save per-account credentials to `sessions/<phone>/credentials.json`).

### 5. Run the Script

Make sure your script file is named e.g. `telegram-query.js`. Then:

```bash
# Run once
node telegram-query.js

# To run 24/7 with PM2
npm install -g pm2
pm2 start telegram-query.js --name "telegram-query"
pm2 startup
pm2 save
```

### 6. Monitor Logs

```bash
# If using PM2
pm2 logs telegram-query

# If running directly, the script runs in the foreground and logs to your terminal.
```

---

## Script Behavior & Features

* ✅ Supports logging in with multiple phone numbers from `phone.txt`.
* ✅ Uses saved sessions in `sessions/<phone>/session.txt` to avoid re-requesting OTP on subsequent runs.
* ✅ If a session file does not exist, the script will prompt for OTP once during that manual login, then save the session.
* ✅ Stores per-phone credentials (API ID/API Hash) in `sessions/<phone>/credentials.json` when provided.
* ✅ Automatically queries Telegram bots listed in `bot.txt`.
* ✅ Supports `@bot_username|https://api.url` format in `bot.txt` (API URL optional).
* ✅ Saves query results to `queries/<phone>/<bot>_query.txt`. **Only the latest query is saved (old content is overwritten)** — the file will contain the most recent query.
* ✅ Runs fetch to `api_url` (if provided) — example POST is included in the script (adjust body/headers as required by the target API).
* ✅ Runs on a schedule (every 6 hours by default).
* ✅ Error handling for invalid sessions; script will skip numbers whose session cannot be restored to avoid repeated OTP prompts.
* ✅ Suitable to run 24/7 (use PM2 or another process manager for reliability).

> Important: The script is designed to **not** re-login automatically (and hence not force additional OTP prompts) if a saved session is present. If a saved session expires and you want to refresh it, you will need to perform a manual login for that phone/account.

---

## Recommended Packages to Install

```bash
npm install telegram read node-fetch
```

(If you use Node 18+, `node-fetch` is optional because `fetch` is global; but installing `node-fetch` makes the script compatible with older Node versions.)

---

## Quick Checklist

1. Create `phone.txt` (one phone per line).
2. Create `bot.txt` (one bot per line, format `@bot|api_url`).
3. Install dependencies (`npm install`).
4. Run `node telegram-query.js` and provide API ID/API Hash (global or per-account) when prompted.
5. If a phone has no session, login once (OTP) to create and save the session. Subsequent runs will use the saved session.

---

