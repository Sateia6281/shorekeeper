const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// KONFIGURASI
// ============================================================
const BOT_TOKEN = '8950107483:AAEWtWky1Xe99ZN8SJvHhUo2EugtACiv0Cs';
const ADMIN_ID = '6284402885';
const DATA_FILE = path.join(__dirname, 'data.json');

console.log('📂 __dirname:', __dirname);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html tidak ditemukan!');
    }
});

// ============================================================
// DATA MANAGER
// ============================================================
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }
    return {
        stock: {
            "1Jam": [],
            "5Jam": [],
            "1Day": [],
            "3Day": [],
            "7Day": [],
            "15Day": [],
            "30Day": [],
            "Lifetime": [],
            "Free1Day": []
        },
        orders: [],
        pendingOrders: [],
        lastOrderId: 0,
        totalSold: 0,
        reviews: [],
        chatMessages: {},
        promos: [],
        totalRevenue: 0
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('Error saving data:', e);
        return false;
    }
}

let data = loadData();

// ============================================================
// FUNGSI CRUD
// ============================================================
function getStock() { return data.stock; }
function getStockCount(label) { return (data.stock[label] || []).length; }

function addKey(label, key) {
    if (!data.stock[label]) data.stock[label] = [];
    if (!data.stock[label].includes(key)) {
        data.stock[label].push(key);
        saveData(data);
        return true;
    }
    return false;
}

function reserveKey(label) {
    if (!data.stock[label] || data.stock[label].length === 0) return null;
    const key = data.stock[label].shift();
    saveData(data);
    return key;
}

function returnKey(label, key) {
    if (!data.stock[label]) data.stock[label] = [];
    if (!data.stock[label].includes(key)) {
        data.stock[label].push(key);
        saveData(data);
        return true;
    }
    return false;
}

function confirmOrder(orderId) {
    const pendingIndex = data.pendingOrders.findIndex(o => o.orderId === orderId);
    if (pendingIndex === -1) return null;
    const order = data.pendingOrders[pendingIndex];
    data.pendingOrders.splice(pendingIndex, 1);
    order.status = 'approved';
    order.confirmedAt = new Date().toISOString();
    data.orders.push(order);
    data.totalSold = (data.totalSold || 0) + 1;
    data.totalRevenue = (data.totalRevenue || 0) + parseInt(order.price.replace(/\D/g, '')) || 0;
    saveData(data);
    return order;
}

function rejectOrder(orderId) {
    const pendingIndex = data.pendingOrders.findIndex(o => o.orderId === orderId);
    if (pendingIndex === -1) return null;
    const order = data.pendingOrders[pendingIndex];
    data.pendingOrders.splice(pendingIndex, 1);
    returnKey(order.packageId, order.key);
    saveData(data);
    return order;
}

function getPendingOrders() { return data.pendingOrders || []; }
function generateOrderId() {
    data.lastOrderId = (data.lastOrderId || 0) + 1;
    saveData(data);
    return 'ORD' + Date.now().toString(36).toUpperCase() + String(data.lastOrderId).padStart(4, '0');
}

function getTotalStock() {
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    return total;
}

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const PKGS = [
    { id: '1JAM', label: '1Jam', name: '1 JAM', idr: 'Rp 5.000', usd: '$0.3' },
    { id: '5JAM', label: '5Jam', name: '5 JAM', idr: 'Rp 10.000', usd: '$0.6' },
    { id: '1DAY', label: '1Day', name: '1 HARI', idr: 'Rp 20.000', usd: '$1.2' },
    { id: '3DAY', label: '3Day', name: '3 HARI', idr: 'Rp 50.000', usd: '$3' },
    { id: '7DAY', label: '7Day', name: '7 HARI', idr: 'Rp 100.000', usd: '$6' },
    { id: '15DAY', label: '15Day', name: '15 HARI', idr: 'Rp 150.000', usd: '$9' },
    { id: '30DAY', label: '30Day', name: '30 HARI', idr: 'Rp 200.000', usd: '$12' },
    { id: 'Lifetime', label: 'Lifetime', name: 'LIFETIME', idr: 'Rp 300.000', usd: '$18' },
];

// ============================================================
// PARSE BATCH TEXT
// ============================================================
function parseBatchText(text, defaultLabel = '1Day') {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const results = [];

    const labelMap = {
        '1jam': '1Jam', '1 jam': '1Jam', '1j': '1Jam',
        '5jam': '5Jam', '5 jam': '5Jam', '5j': '5Jam',
        '1day': '1Day', '1 day': '1Day', '1d': '1Day',
        '1hari': '1Day', '1 hari': '1Day',
        '3day': '3Day', '3 day': '3Day', '3d': '3Day',
        '3hari': '3Day', '3 hari': '3Day',
        '7day': '7Day', '7 day': '7Day', '7d': '7Day',
        '7hari': '7Day', '7 hari': '7Day',
        '15day': '15Day', '15 day': '15Day', '15d': '15Day',
        '15hari': '15Day', '15 hari': '15Day',
        '30day': '30Day', '30 day': '30Day', '30d': '30Day',
        '30hari': '30Day', '30 hari': '30Day',
        'lifetime': 'Lifetime', 'life': 'Lifetime', 'lt': 'Lifetime',
        'free': 'Free1Day', 'gratis': 'Free1Day'
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^(#|Kunci|Perangkat|Lamanya|Kedaluwarsa|Tindakan|Menunjukkan|entri|Mencari|Selamat|K R U N C H P O I N T)/i)) continue;
        if (trimmed.match(/^[─═━—\-]+$/)) continue;

        // Format: "BS-KEYEYSY 0/1 1HARI" atau "BS-KEYEYSY 1HARI"
        const statusMatch = trimmed.match(/^(BS-[A-Z0-9-]+)\s+(?:(\d+\/\d+)\s+)?([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life|FREE|free))/i);
        if (statusMatch) {
            const key = statusMatch[1];
            const status = statusMatch[2] || null;
            const labelText = statusMatch[3].trim().toLowerCase().replace(/\s+/g, ' ').trim();
            
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (labelText.includes(keyMap)) { foundLabel = value; break; }
            }
            
            results.push({ key, label: foundLabel || defaultLabel, status: status });
            continue;
        }

        // Format panel: "1097  BS  BS-KEYEYSY  0/1  1HARI"
        const panelMatch = trimmed.match(/^\s*(\d+)\s+BS\s+(BS-[A-Z0-9-]+)\s+(?:(\d+\/\d+)\s+)?([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life|FREE|free))/i);
        if (panelMatch) {
            const key = panelMatch[2];
            const status = panelMatch[3] || null;
            const labelText = panelMatch[4].trim().toLowerCase().replace(/\s+/g, ' ').trim();
            
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (labelText.includes(keyMap)) { foundLabel = value; break; }
            }
            
            results.push({ key, label: foundLabel || defaultLabel, status: status });
            continue;
        }

        // Key doang: "BS-KEYEYSY"
        const keyOnly = trimmed.match(/^(BS-[A-Z0-9-]+)$/);
        if (keyOnly) {
            const key = keyOnly[1];
            let detectedLabel = null;
            for (const [label, keys] of Object.entries(data.stock)) {
                if (keys.includes(key)) {
                    detectedLabel = label;
                    break;
                }
            }
            results.push({ key, label: detectedLabel || defaultLabel });
            continue;
        }

        // Key anywhere
        const anyKey = trimmed.match(/BS-[A-Z0-9-]+/);
        if (anyKey) {
            const key = anyKey[0];
            let detectedLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (trimmed.toLowerCase().includes(keyMap)) {
                    detectedLabel = value;
                    break;
                }
            }
            results.push({ key, label: detectedLabel || defaultLabel });
            continue;
        }
    }
    return results;
}

// ============================================================
// TELEGRAM BOT
// ============================================================
console.log('🤖 Mencoba start Telegram Bot...');
let bot = null;
let tempPromo = null;

try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('✅ Telegram Bot started!');

    bot.on('polling_error', (err) => {
        console.error('❌ Polling error:', err.code, err.message);
    });

    bot.on('error', (err) => {
        console.error('❌ Bot error:', err);
    });

    // ============================================================
    // USER STATE
    // ============================================================
    const userStates = new Map();

    // ============================================================
    // MENU UTAMA
    // ============================================================
    function getMainMenu() {
        return {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📦 Beli Key', callback_data: 'buy_key' }],
                    [{ text: '📊 Cek Stok', callback_data: 'cek_stok' }],
                    [{ text: '📖 Tutorial', callback_data: 'tutorial' }],
                    [{ text: '🎁 Key Gratis', callback_data: 'free_key' }],
                    [{ text: '❓ Bantuan', callback_data: 'help' }],
                ]
            }
        };
    }

    // ============================================================
    // COMMANDS UNTUK SEMUA USER
    // ============================================================
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'User';
        const isAdmin = String(chatId) === String(ADMIN_ID);
        
        let text = `🏠 SHOREKEEPER ELITE\n━━━━━━━━━━━━━━━\n\nSelamat datang ${name}! 🚀\n\n`;
        
        if (isAdmin) {
            const pending = getPendingOrders().length;
            const promos = (data.promos || []).length;
            text += `👑 **ADMIN MODE**\n📋 Pending: ${pending}\n📢 Promo aktif: ${promos}\n\n`;
        }
        
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...getMainMenu() });
    });

    bot.onText(/\/menu/, (msg) => {
        bot.sendMessage(msg.chat.id, '📋 Menu Utama', getMainMenu());
    });

    bot.onText(/\/buy|beli/i, (msg) => {
        const chatId = msg.chat.id;
        let text = '📦 DAFTAR PAKET\n━━━━━━━━━━━━━━━\n\n';
        PKGS.forEach(pkg => {
            const count = getStockCount(pkg.id);
            const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
            text += `${pkg.name} - ${pkg.idr}\n📊 ${status}\n\n`;
        });
        text += '━━━━━━━━━━━━━━━\n🌐 Beli via website: https://shorekeeper-production.up.railway.app';
        bot.sendMessage(chatId, text);
    });

    bot.onText(/\/stok/, (msg) => {
        const chatId = msg.chat.id;
        let reply = '📊 STOK KEY\n━━━━━━━━━━━━━━━\n\n';
        let total = 0;
        for (const [label, keys] of Object.entries(data.stock)) {
            reply += `📦 ${label}: ${keys.length} key\n`;
            total += keys.length;
        }
        reply += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key`;
        bot.sendMessage(chatId, reply);
    });

    bot.onText(/\/tutorial/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '📖 TUTORIAL\n━━━━━━━━━━━━━━━\n\n' +
            '1️⃣ Download APK di website\n' +
            '2️⃣ Install di HP (izin install dari luar)\n' +
            '3️⃣ Beli key di website atau via bot\n' +
            '4️⃣ Masukkan key di aplikasi\n' +
            '5️⃣ Aktifkan fitur yang diinginkan\n' +
            '6️⃣ Selesai! 🎉\n\n' +
            '📹 Video: youtube.com/@ZelewinGaming'
        );
    });

    bot.onText(/\/free/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '🎁 KEY GRATIS 1 HARI\n━━━━━━━━━━━━━━━\n\n' +
            'Cara mendapatkan:\n' +
            '1️⃣ Share link website ke 3 grup Telegram\n' +
            '2️⃣ Screenshot bukti share\n' +
            '3️⃣ Upload di website\n' +
            '4️⃣ Key langsung aktif!\n\n' +
            '🌐 Kunjungi: https://shorekeeper-production.up.railway.app'
        );
    });

    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        const isAdmin = String(chatId) === String(ADMIN_ID);
        
        let text = '❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n';
        text += '/start - Menu utama\n';
        text += '/menu - Tampilkan menu\n';
        text += '/buy - Lihat paket\n';
        text += '/stok - Cek stok\n';
        text += '/tutorial - Panduan\n';
        text += '/free - Key gratis\n';
        text += '/help - Bantuan ini\n';
        
        if (isAdmin) {
            text += '\n👑 **ADMIN COMMANDS:**\n';
            text += '/genkey - Generate key baru\n';
            text += '/batch - Import banyak key\n';
            text += '/pending - Lihat pending orders\n';
            text += '/approve [id] - Setujui order\n';
            text += '/reject [id] - Tolak order\n';
            text += '/promo - Menu promo lengkap\n';
            text += '/stats - Statistik lengkap\n';
            text += '/orders - Lihat semua order\n';
            text += '/search - Cari order\n';
            text += '/broadcast - Kirim pesan ke semua user\n';
            text += '/addkey [key] [label] - Tambah key\n';
            text += '/delkey [key] - Hapus key\n';
            text += '/resetstock - Reset SEMUA stok key\n';
        }
        
        text += '\n🌐 Website: https://shorekeeper-production.up.railway.app';
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // ============================================================
    // ADMIN COMMANDS
    // ============================================================
    const labelMap = {
        '1jam': '1Jam', '1 jam': '1Jam', '1j': '1Jam',
        '5jam': '5Jam', '5 jam': '5Jam', '5j': '5Jam',
        '1day': '1Day', '1 day': '1Day', '1d': '1Day',
        '3day': '3Day', '3 day': '3Day', '3d': '3Day',
        '7day': '7Day', '7 day': '7Day', '7d': '7Day',
        '15day': '15Day', '15 day': '15Day', '15d': '15Day',
        '30day': '30Day', '30 day': '30Day', '30d': '30Day',
        'lifetime': 'Lifetime', 'life': 'Lifetime', 'lt': 'Lifetime'
    };

    bot.onText(/\/addkey (.+) (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const key = match[1].trim();
        const label = match[2].trim();
        const finalLabel = labelMap[label.toLowerCase()] || label;
        if (addKey(finalLabel, key)) {
            bot.sendMessage(chatId, `✅ Key ditambahkan!\n🔑 ${key}\n📦 ${finalLabel}\n📊 Total stok: ${getTotalStock()}`);
        } else {
            bot.sendMessage(chatId, `⚠️ Key ${key} sudah ada di ${finalLabel}`);
        }
    });

    bot.onText(/\/delkey (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const key = match[1].trim();
        let found = false;
        for (const label in data.stock) {
            if (data.stock[label].includes(key)) {
                const idx = data.stock[label].indexOf(key);
                data.stock[label].splice(idx, 1);
                saveData(data);
                found = true;
                bot.sendMessage(chatId, `🗑️ Key dihapus!\n🔑 ${key}\n📦 ${label}`);
                break;
            }
        }
        if (!found) bot.sendMessage(chatId, `❌ Key ${key} tidak ditemukan`);
    });

    bot.onText(/\/resetstock$/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚠️ Ya, Hapus SEMUA Key', callback_data: 'resetstock_confirm' }],
                    [{ text: '❌ Batal', callback_data: 'resetstock_cancel' }]
                ]
            }
        };
        const totalBefore = getTotalStock();
        bot.sendMessage(
            chatId,
            `⚠️ **RESET SEMUA STOK KEY**\n━━━━━━━━━━━━━━━\n\nIni akan menghapus SEMUA key (${totalBefore} key) dari SEMUA paket.\nTindakan ini tidak bisa dibatalkan.\n\nLanjutkan?`,
            { parse_mode: 'Markdown', ...keyboard }
        );
    });

    // ============================================================
    // BATCH IMPORT
    // ============================================================
    bot.onText(/\/batch/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        userStates.set(chatId, { step: 'batch_import', defaultLabel: '1Day' });
        bot.sendMessage(chatId,
            '📥 **BATCH IMPORT KEY**\n━━━━━━━━━━━━━━━\n\n' +
            'Kirim daftar key sekarang (1 pesan, boleh banyak baris)\n\n' +
            'Format yang didukung:\n' +
            '• `BS-KEYEYSY 0/1 1HARI`\n' +
            '• `BS-KEYEYSY 1HARI`\n' +
            '• `BS-KEYEYSY`\n' +
            '• `1097 BS BS-KEYEYSY 0/1 1HARI`\n\n' +
            'Kirim daftar key sekarang!',
            { parse_mode: 'Markdown' }
        );
    });

    // ============================================================
    // GENERATE KEY
    // ============================================================
    bot.onText(/\/genkey/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1 JAM', callback_data: 'gen_1JAM' }],
                    [{ text: '5 JAM', callback_data: 'gen_5JAM' }],
                    [{ text: '1 HARI', callback_data: 'gen_1DAY' }],
                    [{ text: '3 HARI', callback_data: 'gen_3DAY' }],
                    [{ text: '⭐ 7 HARI', callback_data: 'gen_7DAY' }],
                    [{ text: '15 HARI', callback_data: 'gen_15DAY' }],
                    [{ text: '30 HARI', callback_data: 'gen_30DAY' }],
                    [{ text: '👑 LIFETIME', callback_data: 'gen_Lifetime' }],
                    [{ text: '🎁 FREE 1 HARI', callback_data: 'gen_Free1Day' }],
                    [{ text: '❌ BATAL', callback_data: 'gen_cancel' }],
                ]
            }
        };

        bot.sendMessage(chatId,
            '🔑 **GENERATE KEY BARU**\n━━━━━━━━━━━━━━━\n\n' +
            'Pilih paket di bawah untuk generate key:',
            { parse_mode: 'Markdown', ...keyboard }
        );
    });

    // ============================================================
    // PENDING ORDERS
    // ============================================================
    bot.onText(/\/pending/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const pending = getPendingOrders();
        if (pending.length === 0) {
            bot.sendMessage(chatId, '📋 Tidak ada pending orders.');
            return;
        }
        let text = '📋 **PENDING ORDERS**\n━━━━━━━━━━━━━━━\n\n';
        pending.forEach((o, i) => {
            text += `${i+1}. 🆔 ${o.orderId}\n`;
            text += `   📦 ${o.package} - ${o.price}\n`;
            text += `   📧 ${o.email}\n\n`;
        });
        text += `\n✅ /approve [orderId]\n❌ /reject [orderId]`;
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/approve (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const orderId = match[1].trim();
        const order = confirmOrder(orderId);
        if (order) {
            bot.sendMessage(chatId, `✅ ORDER DISETUJUI!\n🔑 ${order.key}\n📦 ${order.package}`);
            bot.sendMessage(order.userChatId || order.phone,
                `✅ KEY AKTIF!\n🔑 ${order.key}\n📦 ${order.package}`
            ).catch(() => {});
        } else {
            bot.sendMessage(chatId, `❌ Order ${orderId} tidak ditemukan!`);
        }
    });

    bot.onText(/\/reject (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }
        const orderId = match[1].trim();
        const order = rejectOrder(orderId);
        if (order) {
            bot.sendMessage(chatId, `❌ ORDER DITOLAK!\n🆔 ${order.orderId}\n💳 Key kembali ke stok.`);
        } else {
            bot.sendMessage(chatId, `❌ Order ${orderId} tidak ditemukan!`);
        }
    });

    // ============================================================
    // STATS
    // ============================================================
    bot.onText(/\/stats/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const totalOrders = data.orders.length;
        const totalPending = (data.pendingOrders || []).length;
        const totalStock = getTotalStock();
        const totalRevenue = data.totalRevenue || 0;
        const promos = (data.promos || []).length;

        let text = '📊 **STATISTIK SHOREKEEPER**\n━━━━━━━━━━━━━━━\n\n';
        text += `💰 Total Pendapatan: Rp ${totalRevenue.toLocaleString()}\n`;
        text += `📦 Total Order: ${totalOrders}\n`;
        text += `⏳ Pending: ${totalPending}\n`;
        text += `📊 Total Stok: ${totalStock}\n`;
        text += `📢 Promo Aktif: ${promos}\n`;
        text += `📅 Total Terjual: ${data.totalSold || 0}\n`;
        text += `━━━━━━━━━━━━━━━\n`;
        text += `📌 Update: ${new Date().toLocaleString('id-ID')}`;

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // ============================================================
    // ORDERS LIST
    // ============================================================
    bot.onText(/\/orders/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const orders = data.orders || [];
        if (orders.length === 0) {
            bot.sendMessage(chatId, '📋 Belum ada order.');
            return;
        }

        let text = '📋 **SEMUA ORDER**\n━━━━━━━━━━━━━━━\n\n';
        const recent = orders.slice(-10).reverse();
        recent.forEach((o, i) => {
            const status = o.status === 'approved' ? '✅ SUKSES' : '❌ DITOLAK';
            text += `${i+1}. 🆔 ${o.orderId}\n`;
            text += `   📦 ${o.package} - ${o.price}\n`;
            text += `   📊 ${status}\n\n`;
        });

        if (orders.length > 10) {
            text += `━━━━━━━━━━━━━━━\n📌 Total: ${orders.length} order (tampil 10 terakhir)`;
        }

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // ============================================================
    // SEARCH ORDER
    // ============================================================
    bot.onText(/\/search (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const query = match[1].trim().toUpperCase();
        const allOrders = [...(data.orders || []), ...(data.pendingOrders || [])];
        const found = allOrders.filter(o => 
            o.orderId.includes(query) || 
            (o.email && o.email.toUpperCase().includes(query)) ||
            (o.phone && o.phone.includes(query))
        );

        if (found.length === 0) {
            bot.sendMessage(chatId, `❌ Tidak ditemukan hasil untuk: ${query}`);
            return;
        }

        let text = `🔍 **HASIL PENCARIAN**\n━━━━━━━━━━━━━━━\n\n`;
        found.slice(0, 5).forEach(o => {
            const status = o.status === 'pending' ? '⏳ PENDING' : o.status === 'approved' ? '✅ SUKSES' : '❌ DITOLAK';
            text += `🆔 ${o.orderId}\n`;
            text += `📦 ${o.package} - ${o.price}\n`;
            text += `📧 ${o.email || '-'}\n`;
            text += `📊 ${status}\n\n`;
        });

        if (found.length > 5) {
            text += `━━━━━━━━━━━━━━━\n📌 Menampilkan 5 dari ${found.length} hasil`;
        }

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // ============================================================
    // BROADCAST
    // ============================================================
    bot.onText(/\/broadcast (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const message = match[1].trim();
        const allUsers = new Set();
        
        // Kumpulkan semua user dari orders
        (data.orders || []).forEach(o => {
            if (o.userChatId) allUsers.add(o.userChatId);
            if (o.phone) allUsers.add(o.phone);
        });

        // Kumpulkan dari pending orders
        (data.pendingOrders || []).forEach(o => {
            if (o.userChatId) allUsers.add(o.userChatId);
            if (o.phone) allUsers.add(o.phone);
        });

        if (allUsers.size === 0) {
            bot.sendMessage(chatId, '❌ Tidak ada user untuk dikirim broadcast.');
            return;
        }

        bot.sendMessage(chatId, `📢 Mengirim broadcast ke ${allUsers.size} user...`);

        let sent = 0;
        allUsers.forEach(userId => {
            bot.sendMessage(userId, 
                `📢 **BROADCAST**\n━━━━━━━━━━━━━━━\n\n${message}`
            ).then(() => {
                sent++;
            }).catch(() => {});
        });

        setTimeout(() => {
            bot.sendMessage(chatId, `✅ Broadcast terkirim ke ${sent} user dari ${allUsers.size} target.`);
        }, 3000);
    });

    // ============================================================
    // PROMO - MENU LENGKAP DENGAN TOMBOL
    // ============================================================
    bot.onText(/\/promo/, (msg) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 Lihat Promo Aktif', callback_data: 'promo_list' }],
                    [{ text: '➕ Buat Promo Baru', callback_data: 'promo_create' }],
                    [{ text: '🗑️ Hapus Promo', callback_data: 'promo_delete' }],
                    [{ text: '📢 Broadcast Promo', callback_data: 'promo_broadcast' }],
                ]
            }
        };

        const promos = data.promos || [];
        const activeCount = promos.filter(p => new Date(p.expiry) > new Date()).length;
        
        bot.sendMessage(chatId,
            `📢 **MENU PROMO**\n━━━━━━━━━━━━━━━\n\n` +
            `📋 Promo aktif: ${activeCount}\n` +
            `📦 Total promo: ${promos.length}\n\n` +
            `Pilih aksi di bawah:`,
            { parse_mode: 'Markdown', ...keyboard }
        );
    });

    // ============================================================
    // CALLBACK QUERY - SEMUA HANDLER
    // ============================================================
    bot.on('callback_query', async (callback) => {
        const chatId = callback.message.chat.id;
        const data_cb = callback.data;

        if (String(chatId) !== String(ADMIN_ID)) {
            bot.answerCallbackQuery(callback.id, { text: '⛔ Hanya untuk admin!', show_alert: true });
            return;
        }

        bot.answerCallbackQuery(callback.id);

        // ============================================================
        // GENERATE KEY
        // ============================================================
        if (data_cb.startsWith('gen_')) {
            const label = data_cb.replace('gen_', '');
            if (label === 'cancel') {
                bot.sendMessage(chatId, '❌ Generate key dibatalkan.');
                return;
            }

            const key = 'BS-' + generateRandomKey();
            if (addKey(label, key)) {
                const pkg = PKGS.find(p => p.id === label);
                const pkgName = pkg ? pkg.name : label;
                bot.sendMessage(chatId,
                    `✅ **KEY BERHASIL DIGENERATE!**\n━━━━━━━━━━━━━━━\n\n` +
                    `🔑 \`${key}\`\n` +
                    `📦 ${pkgName}\n` +
                    `📊 Stok ${label}: ${getStockCount(label)} key\n\n` +
                    `📋 Klik tombol di bawah untuk salin:`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 Salin Key', callback_data: `copy_${key}` }],
                                [{ text: '🔄 Generate Lagi', callback_data: 'genkey_again' }],
                            ]
                        }
                    }
                );
            } else {
                bot.sendMessage(chatId, `❌ Gagal generate key untuk ${label}`);
            }
            return;
        }

        if (data_cb === 'genkey_again') {
            bot.sendMessage(chatId, '🔑 Pilih paket lagi:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1 JAM', callback_data: 'gen_1JAM' }],
                        [{ text: '5 JAM', callback_data: 'gen_5JAM' }],
                        [{ text: '1 HARI', callback_data: 'gen_1DAY' }],
                        [{ text: '3 HARI', callback_data: 'gen_3DAY' }],
                        [{ text: '⭐ 7 HARI', callback_data: 'gen_7DAY' }],
                        [{ text: '15 HARI', callback_data: 'gen_15DAY' }],
                        [{ text: '30 HARI', callback_data: 'gen_30DAY' }],
                        [{ text: '👑 LIFETIME', callback_data: 'gen_Lifetime' }],
                        [{ text: '🎁 FREE 1 HARI', callback_data: 'gen_Free1Day' }],
                        [{ text: '❌ BATAL', callback_data: 'gen_cancel' }],
                    ]
                }
            });
            return;
        }

        if (data_cb.startsWith('copy_')) {
            const key = data_cb.replace('copy_', '');
            bot.sendMessage(chatId, `📋 Key: \`${key}\``, { parse_mode: 'Markdown' });
            return;
        }

        // ============================================================
        // PROMO
        // ============================================================
        if (data_cb === 'promo_list') {
            const promos = data.promos || [];
            if (promos.length === 0) {
                bot.sendMessage(chatId, '📋 Belum ada promo.');
                return;
            }

            let text = '📋 **DAFTAR PROMO**\n━━━━━━━━━━━━━━━\n\n';
            promos.forEach((p, i) => {
                const status = new Date(p.expiry) > new Date() ? '✅ Aktif' : '❌ Kadaluarsa';
                text += `${i+1}. 🆔 ${p.id}\n`;
                text += `   📦 ${p.package} - Diskon ${p.discount}%\n`;
                text += `   📅 Sampai: ${p.expiry}\n`;
                text += `   📊 Status: ${status}\n\n`;
            });
            text += `━━━━━━━━━━━━━━━\nTotal: ${promos.length} promo`;
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
            return;
        }

        if (data_cb === 'promo_create') {
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '1 JAM', callback_data: 'promo_pkg_1JAM' }],
                        [{ text: '5 JAM', callback_data: 'promo_pkg_5JAM' }],
                        [{ text: '1 HARI', callback_data: 'promo_pkg_1DAY' }],
                        [{ text: '3 HARI', callback_data: 'promo_pkg_3DAY' }],
                        [{ text: '⭐ 7 HARI', callback_data: 'promo_pkg_7DAY' }],
                        [{ text: '15 HARI', callback_data: 'promo_pkg_15DAY' }],
                        [{ text: '30 HARI', callback_data: 'promo_pkg_30DAY' }],
                        [{ text: '👑 LIFETIME', callback_data: 'promo_pkg_Lifetime' }],
                        [{ text: '❌ BATAL', callback_data: 'promo_cancel' }],
                    ]
                }
            };

            bot.sendMessage(chatId,
                '📦 **PILIH PAKET**\n━━━━━━━━━━━━━━━\n\n' +
                'Pilih paket yang mau didiskon:',
                { parse_mode: 'Markdown', ...keyboard }
            );
            return;
        }

        if (data_cb.startsWith('promo_pkg_')) {
            const packageId = data_cb.replace('promo_pkg_', '');
            if (packageId === 'cancel') {
                bot.sendMessage(chatId, '❌ Pembuatan promo dibatalkan.');
                return;
            }

            userStates.set(chatId, { step: 'promo_discount', packageId: packageId });
            bot.sendMessage(chatId,
                `💰 **MASUKKAN DISKON**\n━━━━━━━━━━━━━━━\n\n` +
                `📦 Paket: ${packageId}\n\n` +
                `Kirim **persentase diskon** (angka 1-100):\n` +
                `Contoh: \`50\` untuk diskon 50%`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (data_cb === 'promo_delete') {
            const promos = data.promos || [];
            if (promos.length === 0) {
                bot.sendMessage(chatId, '📋 Belum ada promo untuk dihapus.');
                return;
            }

            let keyboard = { reply_markup: { inline_keyboard: [] } };
            promos.forEach(p => {
                keyboard.reply_markup.inline_keyboard.push([
                    { text: `🗑️ ${p.id} - ${p.package} (${p.discount}%)`, callback_data: `promo_del_${p.id}` }
                ]);
            });
            keyboard.reply_markup.inline_keyboard.push([{ text: '❌ BATAL', callback_data: 'promo_cancel' }]);

            bot.sendMessage(chatId,
                '🗑️ **HAPUS PROMO**\n━━━━━━━━━━━━━━━\n\n' +
                'Pilih promo yang mau dihapus:',
                { parse_mode: 'Markdown', ...keyboard }
            );
            return;
        }

        if (data_cb.startsWith('promo_del_')) {
            const promoId = data_cb.replace('promo_del_', '');
            const promos = data.promos || [];
            const index = promos.findIndex(p => p.id === promoId);
            
            if (index === -1) {
                bot.sendMessage(chatId, `❌ Promo ${promoId} tidak ditemukan!`);
                return;
            }

            promos.splice(index, 1);
            saveData(data);
            bot.sendMessage(chatId, `✅ Promo ${promoId} berhasil dihapus!`);
            return;
        }

        if (data_cb === 'promo_broadcast') {
            const promos = data.promos || [];
            const active = promos.filter(p => new Date(p.expiry) > new Date());
            
            if (active.length === 0) {
                bot.sendMessage(chatId, '❌ Tidak ada promo aktif untuk di-broadcast.');
                return;
            }

            let message = '📢 **PROMO SPESIAL!**\n━━━━━━━━━━━━━━━\n\n';
            active.forEach(p => {
                const pkgName = PKGS.find(pkg => pkg.id === p.package)?.name || p.package;
                message += `📦 ${pkgName}\n`;
                message += `💰 Diskon ${p.discount}%\n`;
                message += `📅 Sampai: ${p.expiry}\n\n`;
            });
            message += `━━━━━━━━━━━━━━━\n🌐 Order sekarang: https://shorekeeper-production.up.railway.app`;

            const allUsers = new Set();
            (data.orders || []).forEach(o => {
                if (o.userChatId) allUsers.add(o.userChatId);
                if (o.phone) allUsers.add(o.phone);
            });
            (data.pendingOrders || []).forEach(o => {
                if (o.userChatId) allUsers.add(o.userChatId);
                if (o.phone) allUsers.add(o.phone);
            });

            if (allUsers.size === 0) {
                bot.sendMessage(chatId, '❌ Tidak ada user untuk dikirim broadcast.');
                return;
            }

            bot.sendMessage(chatId, `📢 Mengirim broadcast promo ke ${allUsers.size} user...`);

            let sent = 0;
            allUsers.forEach(userId => {
                bot.sendMessage(userId, message, { parse_mode: 'Markdown' })
                    .then(() => sent++)
                    .catch(() => {});
            });

            setTimeout(() => {
                bot.sendMessage(chatId, `✅ Broadcast promo terkirim ke ${sent} user.`);
            }, 3000);
            return;
        }

        if (data_cb === 'promo_cancel') {
            bot.sendMessage(chatId, '❌ Aksi dibatalkan.');
            userStates.delete(chatId);
            return;
        }

        if (data_cb === 'resetstock_confirm') {
            if (String(chatId) !== String(ADMIN_ID)) {
                bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
                return;
            }
            const totalBefore = getTotalStock();
            for (const label in data.stock) {
                data.stock[label] = [];
            }
            saveData(data);
            bot.sendMessage(chatId, `✅ SEMUA STOK DIRESET!\n━━━━━━━━━━━━━━━\n🗑️ ${totalBefore} key dihapus dari semua paket.\n📊 Total stok sekarang: 0 key`);
            return;
        }

        if (data_cb === 'resetstock_cancel') {
            bot.sendMessage(chatId, '❌ Reset stok dibatalkan.');
            return;
        }

        // ============================================================
        // MENU UTAMA
        // ============================================================
        if (data_cb === 'buy_key') {
            let text = '📦 DAFTAR PAKET\n━━━━━━━━━━━━━━━\n\n';
            PKGS.forEach(pkg => {
                const count = getStockCount(pkg.id);
                const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
                text += `${pkg.name} - ${pkg.idr}\n📊 ${status}\n\n`;
            });
            text += '━━━━━━━━━━━━━━━\n🌐 Beli via website: https://shorekeeper-production.up.railway.app';
            bot.sendMessage(chatId, text);
            return;
        }

        if (data_cb === 'cek_stok') {
            let reply = '📊 STOK KEY\n━━━━━━━━━━━━━━━\n\n';
            let total = 0;
            for (const [label, keys] of Object.entries(data.stock)) {
                reply += `📦 ${label}: ${keys.length} key\n`;
                total += keys.length;
            }
            reply += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key`;
            bot.sendMessage(chatId, reply);
            return;
        }

        if (data_cb === 'tutorial') {
            bot.sendMessage(chatId,
                '📖 TUTORIAL\n━━━━━━━━━━━━━━━\n\n' +
                '1️⃣ Download APK di website\n' +
                '2️⃣ Install di HP\n' +
                '3️⃣ Beli key\n' +
                '4️⃣ Masukkan key\n' +
                '5️⃣ Selesai! 🎉'
            );
            return;
        }

        if (data_cb === 'free_key') {
            bot.sendMessage(chatId,
                '🎁 KEY GRATIS 1 HARI\n━━━━━━━━━━━━━━━\n\n' +
                '1️⃣ Share link ke 3 grup\n' +
                '2️⃣ Screenshot bukti\n' +
                '3️⃣ Upload di website\n' +
                '4️⃣ Key langsung aktif!\n\n' +
                '🌐 https://shorekeeper-production.up.railway.app'
            );
            return;
        }

        if (data_cb === 'help') {
            const isAdmin = true;
            let text = '❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n';
            text += '/start - Menu utama\n';
            text += '/menu - Tampilkan menu\n';
            text += '/buy - Lihat paket\n';
            text += '/stok - Cek stok\n';
            text += '/tutorial - Panduan\n';
            text += '/free - Key gratis\n';
            text += '/help - Bantuan ini\n';
            
            if (isAdmin) {
                text += '\n👑 **ADMIN COMMANDS:**\n';
                text += '/genkey - Generate key baru\n';
                text += '/batch - Import banyak key\n';
                text += '/pending - Lihat pending orders\n';
                text += '/approve [id] - Setujui order\n';
                text += '/reject [id] - Tolak order\n';
                text += '/promo - Menu promo lengkap\n';
                text += '/stats - Statistik lengkap\n';
                text += '/orders - Lihat semua order\n';
                text += '/search - Cari order\n';
                text += '/broadcast - Kirim pesan ke semua user\n';
                text += '/addkey [key] [label] - Tambah key\n';
                text += '/delkey [key] - Hapus key\n';
                text += '/resetstock - Reset SEMUA stok key\n';
            }
            
            text += '\n🌐 Website: https://shorekeeper-production.up.railway.app';
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
            return;
        }
    });

    // ============================================================
    // MESSAGE HANDLER - BATCH & PROMO INPUT
    // ============================================================
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        if (text.startsWith('/')) return;

        // ============================================================
        // BATCH IMPORT
        // ============================================================
        if (userStates.has(chatId) && userStates.get(chatId).step === 'batch_import') {
            const state = userStates.get(chatId);
            const parsed = parseBatchText(text, state.defaultLabel);

            if (parsed.length === 0) {
                bot.sendMessage(chatId, '❌ Tidak ada key valid! Cek lagi formatnya.');
                userStates.delete(chatId);
                return;
            }

            let added = 0, duplicate = 0, summary = {};
            parsed.forEach(item => {
                if (addKey(item.label, item.key)) {
                    added++;
                    summary[item.label] = (summary[item.label] || 0) + 1;
                } else {
                    duplicate++;
                }
            });

            let reply = `✅ **BATCH IMPORT SELESAI!**\n━━━━━━━━━━━━━━━\n\n✅ ${added} key berhasil ditambahkan\n`;
            if (duplicate > 0) reply += `⚠️ ${duplicate} key duplikat\n`;
            reply += `\n📊 **PER PAKET:**\n`;
            for (const [label, count] of Object.entries(summary)) reply += `   ${label}: +${count}\n`;
            reply += `\n📦 Total stok sekarang: ${getTotalStock()} key`;

            bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
            userStates.delete(chatId);
            return;
        }

        // ============================================================
        // PROMO - INPUT DISKON
        // ============================================================
        if (userStates.has(chatId) && userStates.get(chatId).step === 'promo_discount') {
            const state = userStates.get(chatId);
            const discount = parseInt(text.trim());
            
            if (isNaN(discount) || discount < 1 || discount > 100) {
                bot.sendMessage(chatId, '❌ Masukkan angka 1-100!');
                return;
            }
            
            userStates.set(chatId, { step: 'promo_expiry', packageId: state.packageId, discount: discount });
            bot.sendMessage(chatId,
                `📅 **MASUKKAN TANGGAL KADALUARSA**\n━━━━━━━━━━━━━━━\n\n` +
                `📦 Paket: ${state.packageId}\n` +
                `💰 Diskon: ${discount}%\n\n` +
                `Kirim **tanggal kadaluarsa** (format: YYYY-MM-DD):\n` +
                `Contoh: \`2025-12-31\``,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // ============================================================
        // PROMO - INPUT EXPIRY
        // ============================================================
        if (userStates.has(chatId) && userStates.get(chatId).step === 'promo_expiry') {
            const state = userStates.get(chatId);
            const expiry = text.trim();
            
            if (!expiry.match(/^\d{4}-\d{2}-\d{2}$/)) {
                bot.sendMessage(chatId, '❌ Format salah! Gunakan YYYY-MM-DD');
                return;
            }
            
            const promoId = 'PROMO' + Date.now().toString(36).toUpperCase();
            const promo = {
                id: promoId,
                package: state.packageId,
                discount: state.discount,
                expiry: expiry,
                createdAt: new Date().toISOString()
            };
            
            if (!data.promos) data.promos = [];
            data.promos.push(promo);
            saveData(data);
            
            bot.sendMessage(chatId,
                `✅ **PROMO BERHASIL DIBUAT!**\n━━━━━━━━━━━━━━━\n\n` +
                `🆔 ${promoId}\n` +
                `📦 ${state.packageId}\n` +
                `💰 Diskon: ${state.discount}%\n` +
                `📅 Kadaluarsa: ${expiry}\n\n` +
                `📋 Ketik /listpromo untuk lihat semua promo.`,
                { parse_mode: 'Markdown' }
            );
            
            userStates.delete(chatId);
            return;
        }

        // ============================================================
        // AUTO-REPLY
        // ============================================================
        const lower = text.toLowerCase();
        let reply = null;

        if (lower.includes('halo') || lower.includes('hai')) {
            reply = '👋 Halo! Ada yang bisa dibantu? Ketik /start untuk menu.';
        } else if (lower.includes('harga') || lower.includes('paket')) {
            reply = '📦 Harga paket:\n1 Jam: Rp 5.000\n1 Hari: Rp 20.000\n7 Hari: Rp 100.000\nLifetime: Rp 300.000\n\nKetik /buy untuk detail.';
        } else if (lower.includes('stok')) {
            reply = '📊 Ketik /stok untuk cek stok key.';
        } else if (lower.includes('tutorial') || lower.includes('cara')) {
            reply = '📖 Ketik /tutorial untuk panduan lengkap.';
        } else if (lower.includes('gratis') || lower.includes('free')) {
            reply = '🎁 Ketik /free untuk info key gratis.';
        } else if (lower.includes('admin') || lower.includes('cs')) {
            reply = '📞 Hubungi admin: @Keyskidbot';
        } else if (lower.includes('thank') || lower.includes('makasih')) {
            reply = '🙏 Sama-sama! Senang bisa membantu! ⭐⭐⭐⭐⭐';
        } else {
            reply = '✅ Pesan diterima! Ketik /start untuk menu utama.';
        }

        bot.sendMessage(chatId, reply);
    });

} catch (error) {
    console.error('❌ Bot GAGAL start:', error.message);
    console.log('⚠️ Web TETAP berjalan meskipun bot mati!');
}

// ============================================================
// API ENDPOINTS
// ============================================================
app.get('/api/stock', (req, res) => {
    res.json({
        stock: data.stock,
        total: getTotalStock(),
        totalSold: data.totalSold || 0,
        pending: (data.pendingOrders || []).length,
        promos: (data.promos || []).filter(p => new Date(p.expiry) > new Date())
    });
});

app.post('/api/stock/update', (req, res) => {
    const { stock } = req.body;
    if (!stock || typeof stock !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid stock data' });
    }
    for (const label in data.stock) {
        if (stock[label] !== undefined) {
            data.stock[label] = stock[label];
        }
    }
    saveData(data);
    res.json({ success: true, total: getTotalStock() });
});

app.post('/api/order/create', (req, res) => {
    const { packageId, email, phone, key, method, proofImage, userChatId } = req.body;
    if (!packageId || !email || !phone || !key) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const pkg = PKGS.find(p => p.id === packageId);
    if (!pkg) {
        return res.status(400).json({ success: false, message: 'Package not found' });
    }
    const orderId = generateOrderId();
    const order = {
        orderId: orderId,
        package: pkg.name,
        packageId: packageId,
        price: pkg.idr,
        key: key,
        email: email,
        phone: phone,
        method: method || 'qris',
        status: 'pending',
        createdAt: new Date().toISOString(),
        proofImage: proofImage || null,
        type: 'paid',
        userChatId: userChatId || null
    };
    if (!data.pendingOrders) data.pendingOrders = [];
    data.pendingOrders.push(order);
    saveData(data);
    if (bot) {
        bot.sendMessage(ADMIN_ID,
            `📦 **ORDER BARU!**\n━━━━━━━━━━━━━━━\n\n` +
            `🆔 ${order.orderId}\n` +
            `📦 ${order.package}\n` +
            `💰 ${order.price}\n` +
            `📧 ${order.email}\n` +
            `📱 ${order.phone}\n` +
            `🔑 \`${order.key}\`\n\n` +
            `✅ /approve ${order.orderId}\n` +
            `❌ /reject ${order.orderId}`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
    }
    res.json({ success: true, orderId: orderId, status: 'pending' });
});

app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const pending = (data.pendingOrders || []).find(o => o.orderId === orderId);
    if (pending) {
        return res.json({ success: true, order: { ...pending, status: 'pending' } });
    }
    const order = data.orders.find(o => o.orderId === orderId);
    if (order) {
        return res.json({ success: true, order: order });
    }
    res.json({ success: false, message: 'Order not found' });
});

app.post('/api/free/request', (req, res) => {
    const { userId, key } = req.body;
    if (!userId || !key) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const orderId = 'FREE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    const order = {
        orderId: orderId,
        userId: userId,
        package: 'GRATIS 1 HARI',
        packageId: 'Free1Day',
        price: 'Rp 0',
        key: key,
        status: 'approved',
        createdAt: new Date().toISOString(),
        type: 'free'
    };
    data.orders.push(order);
    saveData(data);
    if (bot) {
        bot.sendMessage(ADMIN_ID, `🎁 FREE KEY DIAMBIL!\n🆔 ${orderId}\n🔑 ${key}`).catch(() => {});
    }
    res.json({ success: true, orderId: orderId, key: key });
});

app.get('/api/reviews', (req, res) => {
    res.json({ reviews: data.reviews || [] });
});

app.post('/api/reviews', (req, res) => {
    const { name, city, rating, text } = req.body;
    if (!name || !rating || !text) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    if (!data.reviews) data.reviews = [];
    data.reviews.push({
        name: name.toUpperCase(),
        city: city ? city.toUpperCase() : '',
        rating: rating,
        text: text,
        time: 'BARU SAJA'
    });
    saveData(data);
    res.json({ success: true, reviews: data.reviews });
});

app.get('/api/chat/:chatId', (req, res) => {
    const { chatId } = req.params;
    const messages = data.chatMessages?.[chatId] || [];
    res.json({ messages });
});

app.post('/api/chat/:chatId', (req, res) => {
    const { chatId } = req.params;
    const { from, text } = req.body;
    if (!data.chatMessages) data.chatMessages = {};
    if (!data.chatMessages[chatId]) data.chatMessages[chatId] = [];
    data.chatMessages[chatId].push({
        from: from || 'user',
        text: text,
        time: new Date().toISOString()
    });
    saveData(data);
    res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
    res.json({
        totalOrders: data.orders.length,
        totalSold: data.totalSold || 0,
        totalStock: getTotalStock(),
        pending: (data.pendingOrders || []).length,
        totalRevenue: data.totalRevenue || 0,
        promos: (data.promos || []).length,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Pending orders: ${(data.pendingOrders || []).length}`);
    console.log(`📢 Promos: ${(data.promos || []).length}`);
    console.log(`\n🌐 Website: http://localhost:${PORT}`);
});