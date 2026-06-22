const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// KONFIGURASI - TOKEN BARU!
// ============================================================
const BOT_TOKEN = '8950107483:AAE-GLbaL0SgsT9nzvh-LZCPPXw0vAVZ_yM';
const ADMIN_ID = '6284402885';
const DATA_FILE = path.join(__dirname, 'data.json');

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

function getStock() { return data.stock; }

function getStockCount(label) {
    if (!data.stock[label]) return 0;
    return data.stock[label].length;
}

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

function getTotalStock() {
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    return total;
}

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BS-';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateOrderId() {
    data.lastOrderId = (data.lastOrderId || 0) + 1;
    saveData(data);
    return 'ORD' + Date.now().toString(36).toUpperCase() + String(data.lastOrderId).padStart(4, '0');
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

function getKeyInfo(key) {
    for (const [pkgId, keys] of Object.entries(data.stock)) {
        if (keys.includes(key)) {
            return {
                key: key,
                package: pkgId,
                status: 'available'
            };
        }
    }
    const order = data.orders.find(o => o.key === key && o.status === 'approved');
    if (order) {
        return {
            key: key,
            package: order.packageId,
            status: 'active',
            packageName: order.package,
            expired: order.expired || 'Lifetime',
            created: order.createdAt
        };
    }
    return null;
}

const PKG_LIST = [
    { id: '1JAM', name: '1 JAM', price: 5000 },
    { id: '5JAM', name: '5 JAM', price: 10000 },
    { id: '1DAY', name: '1 HARI', price: 20000 },
    { id: '3DAY', name: '3 HARI', price: 50000 },
    { id: '7DAY', name: '7 HARI', price: 100000 },
    { id: '15DAY', name: '15 HARI', price: 150000 },
    { id: '30DAY', name: '30 HARI', price: 200000 },
    { id: 'Lifetime', name: 'LIFETIME', price: 300000 },
];

// ============================================================
// BOT - PAKAI WEBHOOK (BUKAN POLLING)
// ============================================================
console.log('🤖 Starting bot with webhook...');
let bot = null;
const userTransactions = new Map();
const userStates = new Map();

try {
    bot = new TelegramBot(BOT_TOKEN);

    const WEBHOOK_URL = 'https://shorekeeper-skcheat.up.railway.app/webhook';
    bot.setWebHook(WEBHOOK_URL).then(() => {
        console.log('✅ Webhook set to:', WEBHOOK_URL);
    }).catch((err) => {
        console.error('❌ Webhook error:', err);
    });

    console.log('✅ Bot ready!');

    // ============================================================
    // WEBHOOK ENDPOINT
    // ============================================================
    app.post('/webhook', (req, res) => {
        try {
            bot.processUpdate(req.body);
            res.sendStatus(200);
        } catch (error) {
            console.error('❌ Webhook error:', error);
            res.sendStatus(500);
        }
    });

    // ============================================================
    // BOT COMMANDS
    // ============================================================
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'User';
        const isAdmin = String(chatId) === String(ADMIN_ID);

        const keyboard = {
            reply_markup: {
                keyboard: [
                    ['🛒 Beli Key', '📊 Cek Stok'],
                    ['🎁 Key Gratis', '❓ Bantuan']
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        };

        let text = `👋 Halo ${name}!\n\n🏠 **SHOREKEEPER ELITE**\n━━━━━━━━━━━━━━━\n\n🔫 Blood Strike Tool #1 Indonesia\n✅ No Root • Undetected\n\n`;

        if (isAdmin) {
            const pending = getPendingOrders().length;
            const totalStock = getTotalStock();
            text += `👑 **ADMIN MODE**\n📋 Pending: ${pending}\n📊 Total Stok: ${totalStock}\n\n`;
        }

        text += `📌 Pilih menu di bawah:`;
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
    });

    bot.onText(/\/menu/, (msg) => {
        bot.sendMessage(msg.chat.id, '📋 Menu Utama', {
            reply_markup: {
                keyboard: [
                    ['🛒 Beli Key', '📊 Cek Stok'],
                    ['🎁 Key Gratis', '❓ Bantuan']
                ],
                resize_keyboard: true
            }
        });
    });

    bot.onText(/🛒 Beli Key/, (msg) => {
        const chatId = msg.chat.id;
        
        let text = '📦 **DAFTAR PAKET**\n━━━━━━━━━━━━━━━\n\n';
        const keyboard = { reply_markup: { inline_keyboard: [] } };
        
        PKG_LIST.forEach(pkg => {
            const count = getStockCount(pkg.id);
            const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
            text += `📌 ${pkg.name}\n   💰 Rp ${pkg.price.toLocaleString()}\n   📊 ${status}\n\n`;
            
            keyboard.reply_markup.inline_keyboard.push([
                { text: `${pkg.name} - Rp ${pkg.price.toLocaleString()}`, callback_data: `buy_${pkg.id}` }
            ]);
        });
        
        keyboard.reply_markup.inline_keyboard.push([
            { text: '❌ Batal', callback_data: 'cancel_buy' }
        ]);
        
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
    });

    bot.onText(/📊 Cek Stok/, (msg) => {
        const chatId = msg.chat.id;
        let text = '📊 **STOK KEY**\n━━━━━━━━━━━━━━━\n\n';
        let total = 0;
        PKG_LIST.forEach(pkg => {
            const count = getStockCount(pkg.id);
            const status = count > 0 ? `✅ ${count}` : '❌ 0';
            text += `📦 ${pkg.name}: ${status}\n`;
            total += count;
        });
        text += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key tersedia`;
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/🎁 Key Gratis/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '🎁 **KEY GRATIS 1 HARI**\n━━━━━━━━━━━━━━━\n\n' +
            'Cara mendapatkan:\n' +
            '1️⃣ Share link website ke 3 grup Telegram\n' +
            '2️⃣ Screenshot bukti share\n' +
            '3️⃣ Upload di website\n' +
            '4️⃣ Key langsung aktif!\n\n' +
            '🌐 https://shorekeeper-skcheat.up.railway.app',
            { parse_mode: 'Markdown' }
        );
    });

    bot.onText(/❓ Bantuan/, (msg) => {
        const chatId = msg.chat.id;
        const isAdmin = String(chatId) === String(ADMIN_ID);
        
        let text = '❓ **BANTUAN**\n━━━━━━━━━━━━━━━\n\n';
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
            text += '/addkey [key] [paket] - Tambah key\n';
            text += '/delkey [key] - Hapus key\n';
            text += '/batch - Import banyak key\n';
            text += '/pending - Lihat pending orders\n';
            text += '/approve [id] - Setujui order\n';
            text += '/reject [id] - Tolak order\n';
            text += '/stats - Statistik lengkap\n';
            text += '/orders - Lihat semua order\n';
            text += '/search [keyword] - Cari order\n';
            text += '/broadcast [pesan] - Kirim ke semua user\n';
            text += '/resetstock - Reset semua stok\n';
        }
        
        text += '\n🌐 https://shorekeeper-skcheat.up.railway.app';
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/help/, (msg) => {
        bot.sendMessage(msg.chat.id, '❓ Ketik /start untuk menu utama');
    });

    bot.onText(/\/stok/, (msg) => {
        const chatId = msg.chat.id;
        let text = '📊 **STOK KEY**\n━━━━━━━━━━━━━━━\n\n';
        let total = 0;
        PKG_LIST.forEach(pkg => {
            const count = getStockCount(pkg.id);
            const status = count > 0 ? `✅ ${count}` : '❌ 0';
            text += `📦 ${pkg.name}: ${status}\n`;
            total += count;
        });
        text += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key tersedia`;
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/buy/, (msg) => {
        const chatId = msg.chat.id;
        let text = '📦 **DAFTAR PAKET**\n━━━━━━━━━━━━━━━\n\n';
        PKG_LIST.forEach(pkg => {
            const count = getStockCount(pkg.id);
            const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
            text += `📌 ${pkg.name}\n   💰 Rp ${pkg.price.toLocaleString()}\n   📊 ${status}\n\n`;
        });
        text += '━━━━━━━━━━━━━━━\n🌐 Beli via website: https://shorekeeper-skcheat.up.railway.app';
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/free/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '🎁 **KEY GRATIS 1 HARI**\n━━━━━━━━━━━━━━━\n\n' +
            '1️⃣ Share link ke 3 grup Telegram\n' +
            '2️⃣ Screenshot bukti\n' +
            '3️⃣ Upload di website\n' +
            '4️⃣ Key langsung aktif!\n\n' +
            '🌐 https://shorekeeper-skcheat.up.railway.app',
            { parse_mode: 'Markdown' }
        );
    });

    bot.onText(/\/tutorial/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '📖 **TUTORIAL**\n━━━━━━━━━━━━━━━\n\n' +
            '1️⃣ Download APK di website\n' +
            '2️⃣ Install di HP (izin install dari luar)\n' +
            '3️⃣ Beli key di website atau via bot\n' +
            '4️⃣ Masukkan key di aplikasi\n' +
            '5️⃣ Aktifkan fitur yang diinginkan\n' +
            '6️⃣ Selesai! 🎉\n\n' +
            '📹 Video: youtube.com/@ZelewinGaming',
            { parse_mode: 'Markdown' }
        );
    });

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
            '🔑 **GENERATE KEY BARU**\n━━━━━━━━━━━━━━━\n\nPilih paket di bawah:',
            { parse_mode: 'Markdown', ...keyboard }
        );
    });

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
            'Format:\n' +
            '• `BS-KEYEYSY 0/1 1HARI`\n' +
            '• `BS-KEYEYSY 1HARI`\n' +
            '• `BS-KEYEYSY`\n' +
            '• `1097 BS BS-KEYEYSY 0/1 1HARI`\n\n' +
            'Kirim sekarang!',
            { parse_mode: 'Markdown' }
        );
    });

    function parseBatchText(text, defaultLabel = '1Day') {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const results = [];

        const labelMapLocal = {
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

            const statusMatch = trimmed.match(/^(BS-[A-Z0-9-]+)\s+(?:(\d+\/\d+)\s+)?([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life|FREE|free))/i);
            if (statusMatch) {
                const key = statusMatch[1];
                const status = statusMatch[2] || null;
                const labelText = statusMatch[3].trim().toLowerCase().replace(/\s+/g, ' ').trim();
                
                let foundLabel = null;
                for (const [keyMap, value] of Object.entries(labelMapLocal)) {
                    if (labelText.includes(keyMap)) { foundLabel = value; break; }
                }
                
                results.push({ key, label: foundLabel || defaultLabel, status: status });
                continue;
            }

            const panelMatch = trimmed.match(/^\s*(\d+)\s+BS\s+(BS-[A-Z0-9-]+)\s+(?:(\d+\/\d+)\s+)?([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life|FREE|free))/i);
            if (panelMatch) {
                const key = panelMatch[2];
                const status = panelMatch[3] || null;
                const labelText = panelMatch[4].trim().toLowerCase().replace(/\s+/g, ' ').trim();
                
                let foundLabel = null;
                for (const [keyMap, value] of Object.entries(labelMapLocal)) {
                    if (labelText.includes(keyMap)) { foundLabel = value; break; }
                }
                
                results.push({ key, label: foundLabel || defaultLabel, status: status });
                continue;
            }

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

            const anyKey = trimmed.match(/BS-[A-Z0-9-]+/);
            if (anyKey) {
                const key = anyKey[0];
                let detectedLabel = null;
                for (const [keyMap, value] of Object.entries(labelMapLocal)) {
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
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `✅ **KEY AKTIF!**\n━━━━━━━━━━━━━━━\n\n🔑 ${order.key}\n📦 ${order.package}\n🌐 https://shorekeeper-skcheat.up.railway.app`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
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
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `❌ **PEMBAYARAN DITOLAK**\n━━━━━━━━━━━━━━━\n\n🆔 ${order.orderId}\n📌 Bukti transfer tidak valid.\n🔄 Silahkan kirim ulang bukti yang jelas.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
        } else {
            bot.sendMessage(chatId, `❌ Order ${orderId} tidak ditemukan!`);
        }
    });

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

        let text = '📊 **STATISTIK SHOREKEEPER**\n━━━━━━━━━━━━━━━\n\n';
        text += `💰 Total Pendapatan: Rp ${totalRevenue.toLocaleString()}\n`;
        text += `📦 Total Order: ${totalOrders}\n`;
        text += `⏳ Pending: ${totalPending}\n`;
        text += `📊 Total Stok: ${totalStock}\n`;
        text += `📅 Total Terjual: ${data.totalSold || 0}\n`;
        text += `━━━━━━━━━━━━━━━\n📌 Update: ${new Date().toLocaleString('id-ID')}`;

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

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

    bot.onText(/\/broadcast (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        if (String(chatId) !== String(ADMIN_ID)) {
            bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
            return;
        }

        const message = match[1].trim();
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

        bot.sendMessage(chatId, `📢 Mengirim broadcast ke ${allUsers.size} user...`);

        let sent = 0;
        allUsers.forEach(userId => {
            bot.sendMessage(userId, 
                `📢 **BROADCAST**\n━━━━━━━━━━━━━━━\n\n${message}`,
                { parse_mode: 'Markdown' }
            ).then(() => sent++).catch(() => {});
        });

        setTimeout(() => {
            bot.sendMessage(chatId, `✅ Broadcast terkirim ke ${sent} user dari ${allUsers.size} target.`);
        }, 3000);
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
    // CALLBACK QUERY - DIPERBAIKI!
    // ============================================================
    bot.on('callback_query', async (callback) => {
        try {
            const chatId = callback.message.chat.id;
            const data_cb = callback.data;
            const isAdmin = String(chatId) === String(ADMIN_ID);

            await bot.answerCallbackQuery(callback.id);

            console.log('📩 Callback received:', data_cb);
            console.log('👤 Chat ID:', chatId);
            console.log('👑 Is Admin:', isAdmin);

            // ============================================================
            // GENERATE KEY
            // ============================================================
            if (data_cb.startsWith('gen_')) {
                console.log('🔑 Generate key triggered for:', data_cb);
                
                if (!isAdmin) {
                    await bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
                    return;
                }
                
                const label = data_cb.replace('gen_', '');
                if (label === 'cancel') {
                    await bot.sendMessage(chatId, '❌ Generate key dibatalkan.');
                    return;
                }

                const key = generateRandomKey();
                console.log('🔑 Generated key:', key, 'for label:', label);
                
                if (addKey(label, key)) {
                    const pkg = PKG_LIST.find(p => p.id === label);
                    const pkgName = pkg ? pkg.name : label;
                    await bot.sendMessage(chatId,
                        `✅ **KEY BERHASIL DIGENERATE!**\n━━━━━━━━━━━━━━━\n\n🔑 \`${key}\`\n📦 ${pkgName}\n📊 Stok ${label}: ${getStockCount(label)} key\n\n📋 Klik tombol di bawah untuk salin:`,
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
                    console.log('✅ Key sent to admin:', key);
                } else {
                    await bot.sendMessage(chatId, `❌ Gagal generate key untuk ${label}`);
                    console.log('❌ Failed to generate key for:', label);
                }
                return;
            }

            // ============================================================
            // GENKEY AGAIN
            // ============================================================
            if (data_cb === 'genkey_again') {
                console.log('🔄 Genkey again triggered');
                
                if (!isAdmin) {
                    await bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
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

                await bot.sendMessage(chatId, '🔑 Pilih paket lagi:', keyboard);
                return;
            }

            // ============================================================
            // COPY KEY
            // ============================================================
            if (data_cb.startsWith('copy_')) {
                const key = data_cb.replace('copy_', '');
                await bot.sendMessage(chatId, `📋 Key: \`${key}\``, { parse_mode: 'Markdown' });
                return;
            }

            // ============================================================
            // RESET STOCK
            // ============================================================
            if (data_cb === 'resetstock_confirm') {
                if (!isAdmin) {
                    await bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
                    return;
                }
                const totalBefore = getTotalStock();
                for (const label in data.stock) {
                    data.stock[label] = [];
                }
                saveData(data);
                await bot.sendMessage(chatId, `✅ SEMUA STOK DIRESET!\n━━━━━━━━━━━━━━━\n🗑️ ${totalBefore} key dihapus dari semua paket.\n📊 Total stok sekarang: 0 key`);
                return;
            }

            if (data_cb === 'resetstock_cancel') {
                await bot.sendMessage(chatId, '❌ Reset stok dibatalkan.');
                return;
            }

            // ============================================================
            // BELI KEY
            // ============================================================
            if (data_cb.startsWith('buy_')) {
                console.log('🛒 Buy key triggered:', data_cb);
                
                const pkgId = data_cb.replace('buy_', '');
                const pkg = PKG_LIST.find(p => p.id === pkgId);
                
                if (!pkg) {
                    await bot.sendMessage(chatId, '❌ Paket tidak ditemukan!');
                    return;
                }
                
                if (getStockCount(pkgId) === 0) {
                    await bot.sendMessage(chatId, 
                        `❌ Stok **${pkg.name}** habis! Silahkan pilih paket lain.`,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }
                
                const orderId = generateOrderId();
                userTransactions.set(chatId, {
                    step: 'waiting_payment',
                    packageId: pkgId,
                    packageName: pkg.name,
                    price: pkg.price,
                    orderId: orderId,
                    userChatId: chatId
                });
                
                const qrisFile = `qris-${pkgId.toLowerCase()}.jpg`;
                
                const caption = 
                    `💳 **INSTRUKSI PEMBAYARAN**\n━━━━━━━━━━━━━━━\n\n` +
                    `📦 Paket: ${pkg.name}\n` +
                    `💰 Harga: Rp ${pkg.price.toLocaleString()}\n\n` +
                    `📌 **CARA BAYAR:**\n` +
                    `━━━━━━━━━━━━━━━\n` +
                    `1️⃣ SCAN QRIS di bawah ini\n` +
                    `   (QRIS khusus untuk paket ${pkg.name})\n\n` +
                    `2️⃣ Transfer sesuai nominal: Rp ${pkg.price.toLocaleString()}\n\n` +
                    `3️⃣ Kirim **FOTO BUKTI TRANSFER**\n` +
                    `   (langsung kirim gambarnya ya!)\n\n` +
                    `🆔 Order ID: \`${orderId}\`\n\n` +
                    `⏳ Admin akan verifikasi dalam 5-15 menit`;
                
                try {
                    await bot.sendPhoto(chatId, qrisFile, {
                        caption: caption,
                        parse_mode: 'Markdown'
                    });
                } catch (err) {
                    console.error('QRIS file not found:', qrisFile);
                    await bot.sendMessage(chatId,
                        `❌ Maaf, QRIS untuk paket ini sedang tidak tersedia.\n` +
                        `Silahkan transfer ke:\n` +
                        `📱 DANA/OVO: 0895401347006\n\n` +
                        `🆔 Order ID: \`${orderId}\``,
                        { parse_mode: 'Markdown' }
                    );
                }
                
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '❌ Batal', callback_data: 'cancel_buy' }]
                        ]
                    }
                };
                
                await bot.sendMessage(chatId, '📸 Setelah bayar, kirim foto buktinya ya!', keyboard);
                return;
            }

            // ============================================================
            // BATAL BELI
            // ============================================================
            if (data_cb === 'cancel_buy') {
                userTransactions.delete(chatId);
                await bot.sendMessage(chatId, '❌ Transaksi dibatalkan.');
                return;
            }

            // ============================================================
            // APPROVE ORDER
            // ============================================================
            if (data_cb.startsWith('approve_')) {
                console.log('✅ Approve triggered:', data_cb);
                
                if (!isAdmin) {
                    await bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
                    return;
                }
                
                const orderId = data_cb.replace('approve_', '');
                
                let userChatId = null;
                let trans = null;
                for (const [chat, t] of userTransactions) {
                    if (t.orderId === orderId) {
                        userChatId = chat;
                        trans = t;
                        break;
                    }
                }
                
                if (!trans) {
                    await bot.sendMessage(chatId, '❌ Transaksi tidak ditemukan!');
                    return;
                }
                
                const key = reserveKey(trans.packageId);
                
                if (!key) {
                    await bot.sendMessage(chatId, '❌ Stok habis!');
                    if (userChatId) {
                        await bot.sendMessage(userChatId, '❌ Maaf, stok sedang habis. Admin akan refund.');
                    }
                    return;
                }
                
                const order = {
                    orderId: orderId,
                    package: trans.packageName,
                    packageId: trans.packageId,
                    price: 'Rp ' + trans.price.toLocaleString(),
                    key: key,
                    email: '-',
                    phone: '-',
                    status: 'approved',
                    createdAt: new Date().toISOString(),
                    type: 'bot',
                    userChatId: userChatId
                };
                data.orders.push(order);
                data.totalSold = (data.totalSold || 0) + 1;
                data.totalRevenue = (data.totalRevenue || 0) + trans.price;
                saveData(data);
                
                if (userChatId) {
                    await bot.sendMessage(userChatId,
                        `🎉 **PEMBAYARAN DISETUJUI!**\n━━━━━━━━━━━━━━━\n\n` +
                        `🔑 **KEY ANDA:**\n\`${key}\`\n\n` +
                        `📦 Paket: ${trans.packageName}\n` +
                        `🆔 Order: ${orderId}\n\n` +
                        `📌 Cara pakai:\n` +
                        `1️⃣ Download APK di website\n` +
                        `2️⃣ Install & buka aplikasi\n` +
                        `3️⃣ Masukkan key di atas\n` +
                        `4️⃣ FITUR LANGSUNG AKTIF! 🚀\n\n` +
                        `🌐 https://shorekeeper-skcheat.up.railway.app`,
                        { parse_mode: 'Markdown' }
                    );
                }
                
                userTransactions.delete(userChatId);
                
                await bot.sendMessage(chatId, 
                    `✅ **KEY TERKIRIM!**\n━━━━━━━━━━━━━━━\n\n🔑 ${key}\n📦 ${trans.packageName}\n👤 User: ${userChatId || 'Unknown'}`
                );
                return;
            }

            // ============================================================
            // REJECT ORDER
            // ============================================================
            if (data_cb.startsWith('reject_')) {
                console.log('❌ Reject triggered:', data_cb);
                
                if (!isAdmin) {
                    await bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
                    return;
                }
                
                const orderId = data_cb.replace('reject_', '');
                
                let userChatId = null;
                let trans = null;
                for (const [chat, t] of userTransactions) {
                    if (t.orderId === orderId) {
                        userChatId = chat;
                        trans = t;
                        break;
                    }
                }
                
                if (!trans) {
                    await bot.sendMessage(chatId, '❌ Transaksi tidak ditemukan!');
                    return;
                }
                
                if (userChatId) {
                    await bot.sendMessage(userChatId,
                        `❌ **PEMBAYARAN DITOLAK**\n━━━━━━━━━━━━━━━\n\n🆔 ${orderId}\n📌 Bukti transfer tidak valid / tidak jelas.\n🔄 Silahkan kirim ulang bukti yang jelas.`
                    );
                }
                
                userTransactions.delete(userChatId);
                await bot.sendMessage(chatId, `✅ Order ${orderId} ditolak. User sudah diberitahu.`);
                return;
            }

            console.log('⚠️ Unknown callback:', data_cb);
            await bot.answerCallbackQuery(callback.id, { text: '⚠️ Perintah tidak dikenal!' });

        } catch (error) {
            console.error('❌ Callback error:', error);
            try {
                await bot.sendMessage(callback.message.chat.id, '❌ Terjadi error! Coba lagi nanti.');
            } catch (e) {}
        }
    });

    // ============================================================
    // HANDLE PHOTO (BUKTI TRANSFER)
    // ============================================================
    bot.on('photo', async (msg) => {
        const chatId = msg.chat.id;
        const trans = userTransactions.get(chatId);
        
        if (!trans || trans.step !== 'waiting_payment') {
            bot.sendMessage(chatId, 
                '📸 Bukti diterima! Tapi tidak ada transaksi aktif.\nKetik /start untuk mulai beli.'
            );
            return;
        }
        
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        
        bot.sendMessage(chatId,
            `✅ **BUKTI DITERIMA!**\n━━━━━━━━━━━━━━━\n\n` +
            `📸 Bukti pembayaran sudah masuk.\n` +
            `⏳ Admin akan verifikasi segera.\n\n` +
            `🆔 Order ID: \`${trans.orderId}\``,
            { parse_mode: 'Markdown' }
        );
        
        const adminText = 
            `📸 **BUKTI PEMBAYARAN BARU!**\n━━━━━━━━━━━━━━━\n\n` +
            `🆔 Order: ${trans.orderId}\n` +
            `📦 Paket: ${trans.packageName}\n` +
            `💰 Harga: Rp ${trans.price.toLocaleString()}\n` +
            `👤 User: ${msg.from.first_name || 'Unknown'}\n` +
            `🆔 Chat: ${chatId}\n\n` +
            `📌 Klik tombol di bawah untuk approve:`;
        
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Approve & Kirim Key', callback_data: `approve_${trans.orderId}` }],
                    [{ text: '❌ Tolak', callback_data: `reject_${trans.orderId}` }]
                ]
            }
        };
        
        bot.sendPhoto(ADMIN_ID, fileId, {
            caption: adminText,
            parse_mode: 'Markdown',
            ...keyboard
        });
        
        trans.step = 'admin_review';
        trans.photoId = fileId;
        userTransactions.set(chatId, trans);
    });

    // ============================================================
    // BATCH IMPORT - MESSAGE HANDLER
    // ============================================================
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        if (text.startsWith('/')) return;

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

        if (msg.photo) return;

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
        } else if (lower.includes('terima kasih') || lower.includes('makasih') || lower.includes('thank')) {
            reply = '🙏 Sama-sama! Senang bisa membantu! ⭐⭐⭐⭐⭐';
        } else if (lower.length > 3) {
            reply = '✅ Pesan diterima! Ketik /start untuk menu utama.';
        }

        if (reply) {
            bot.sendMessage(chatId, reply);
        }
    });

} catch (error) {
    console.error('❌ Bot error:', error);
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
    const pkg = PKG_LIST.find(p => p.id === packageId);
    if (!pkg) {
        return res.status(400).json({ success: false, message: 'Package not found' });
    }
    const orderId = generateOrderId();
    const order = {
        orderId: orderId,
        package: pkg.name,
        packageId: packageId,
        price: 'Rp ' + pkg.price.toLocaleString(),
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
// JNI ENDPOINTS
// ============================================================
app.post('/krunchpoint/connect', (req, res) => {
    const { user_key, serial, challenge } = req.body;
    
    console.log('🔑 Krunchpoint JNI request:', { user_key, serial });
    
    if (!user_key) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak boleh kosong' 
        });
    }
    
    const keyInfo = getKeyInfo(user_key);
    
    if (!keyInfo) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak valid! Pastikan key benar.' 
        });
    }
    
    if (keyInfo.status === 'pending') {
        return res.json({ 
            status: false, 
            reason: 'Key belum aktif! Tunggu verifikasi admin.' 
        });
    }
    
    const now = new Date();
    const rng = Math.floor(now.getTime() / 1000);
    const token = 'SK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === keyInfo.package);
    const pkgName = pkg ? pkg.name : keyInfo.package;
    
    const response = {
        status: true,
        data: {
            token: token,
            rng: rng,
            EXP: keyInfo.expired || 'Lifetime',
            MOD_NAME: 'Shorekeeper Elite',
            MOD_STATUS: '✅ SAFE',
            username: 'User',
            package: pkgName,
            days_left: 'Lifetime',
            created: keyInfo.created || now.toISOString(),
            menu_block: false,
            floating_text: 'Shorekeeper Elite • ' + pkgName,
            sig: ''
        }
    };
    
    console.log('✅ Krunchpoint Key valid:', user_key, 'Package:', pkgName);
    res.json(response);
});

app.post('/connect', (req, res) => {
    const { user_key, serial, challenge } = req.body;
    
    console.log('🔑 SKCheat JNI request:', { user_key, serial });
    
    if (!user_key) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak boleh kosong' 
        });
    }
    
    const keyInfo = getKeyInfo(user_key);
    
    if (!keyInfo) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak valid! Pastikan key benar.' 
        });
    }
    
    if (keyInfo.status === 'pending') {
        return res.json({ 
            status: false, 
            reason: 'Key belum aktif! Tunggu verifikasi admin.' 
        });
    }
    
    const now = new Date();
    const rng = Math.floor(now.getTime() / 1000);
    const token = 'SK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === keyInfo.package);
    const pkgName = pkg ? pkg.name : keyInfo.package;
    
    const response = {
        status: true,
        data: {
            token: token,
            rng: rng,
            EXP: keyInfo.expired || 'Lifetime',
            MOD_NAME: 'Shorekeeper Elite',
            MOD_STATUS: '✅ SAFE',
            username: 'User',
            package: pkgName,
            days_left: 'Lifetime',
            created: keyInfo.created || now.toISOString(),
            menu_block: false,
            floating_text: 'Shorekeeper Elite • ' + pkgName,
            sig: ''
        }
    };
    
    console.log('✅ SKCheat Key valid:', user_key, 'Package:', pkgName);
    res.json(response);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Pending orders: ${(data.pendingOrders || []).length}`);
    console.log(`\n🌐 Website: http://localhost:${PORT}`);
    console.log(`🔗 JNI Krunchpoint: /krunchpoint/connect`);
    console.log(`🔗 JNI SKCheat: /connect`);
    console.log(`🔗 Webhook URL: https://shorekeeper-skcheat.up.railway.app/webhook`);
});