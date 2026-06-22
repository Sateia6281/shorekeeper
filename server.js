const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = 3000;

// ============================================================
// ⚠️ KONFIGURASI HARDCODE - TOKEN TERLIHAT DI KODE!
// ============================================================
const BOT_TOKEN = '8950107483:AAEWtWky1Xe99ZN8SJvHhUo2EugtACiv0Cs';
const ADMIN_ID = '6284402885';
const DATA_FILE = path.join(__dirname, 'data.json');

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
        freeRequests: [],
        lastOrderId: 0,
        totalSold: 0,
        reviews: [
            {
                "name": "BUDI S.",
                "city": "JAKARTA",
                "rating": 5,
                "text": "MANTAP BRO LANGSUNG AKTIF! KEY DIKIRIM CEPET BANGET.",
                "time": "2 HARI LALU"
            },
            {
                "name": "CITRA R.",
                "city": "BANDUNG",
                "rating": 5,
                "text": "UDAH BELI 3X GAK PERNAH KECEWA. UNDETECTED BENERAN AMAN.",
                "time": "5 HARI LALU"
            }
        ],
        chatMessages: {}
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

function useKey(label) {
    if (!data.stock[label] || data.stock[label].length === 0) return null;
    const key = data.stock[label].shift();
    data.totalSold = (data.totalSold || 0) + 1;
    saveData(data);
    return key;
}

function removeKey(label, key) {
    if (data.stock[label]) {
        data.stock[label] = data.stock[label].filter(k => k !== key);
        saveData(data);
        return true;
    }
    return false;
}

function addOrder(order) {
    data.orders.push(order);
    saveData(data);
    return order;
}

function getOrders() { return data.orders; }
function getFreeRequests() { return data.freeRequests || []; }
function addFreeRequest(req) {
    if (!data.freeRequests) data.freeRequests = [];
    data.freeRequests.push(req);
    saveData(data);
    return req;
}

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

// ============================================================
// PAKET
// ============================================================
const PKGS = [
    { id: '1JAM', name: '1 JAM', idr: 'Rp 5.000', usd: '$0.3' },
    { id: '5JAM', name: '5 JAM', idr: 'Rp 10.000', usd: '$0.6' },
    { id: '1DAY', name: '1 HARI', idr: 'Rp 20.000', usd: '$1.2' },
    { id: '3DAY', name: '3 HARI', idr: 'Rp 50.000', usd: '$3' },
    { id: '7DAY', name: '7 HARI', idr: 'Rp 100.000', usd: '$6' },
    { id: '15DAY', name: '15 HARI', idr: 'Rp 150.000', usd: '$9' },
    { id: '30DAY', name: '30 HARI', idr: 'Rp 200.000', usd: '$12' },
    { id: 'Lifetime', name: 'LIFETIME', idr: 'Rp 300.000', usd: '$18' },
];

// ============================================================
// TELEGRAM BOT
// ============================================================
console.log('🤖 Starting Telegram Bot...');
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
    console.error('❌ Polling error:', err.code, err.message);
});

bot.on('error', (err) => {
    console.error('❌ Bot error:', err);
});

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
                [{ text: '❓ Bantuan', callback_data: 'help' }],
                [{ text: '🎁 Key Gratis', callback_data: 'free_key' }],
            ]
        }
    };
}

// ============================================================
// AUTO-REPLY KEYWORDS
// ============================================================
function getAutoReply(text) {
    const lower = text.toLowerCase();
    
    const replies = [
        { keywords: ['halo', 'hai', 'hey', 'hi', 'pagi', 'siang', 'malam'], 
          reply: '👋 Halo! Ada yang bisa dibantu? Ketik /start untuk menu lengkap.' },
        { keywords: ['harga', 'paket', 'berap', 'biaya', 'mahal', 'murah'], 
          reply: '📦 DAFTAR HARGA PAKET:\n\n1 Jam: Rp 5.000\n5 Jam: Rp 10.000\n1 Hari: Rp 20.000\n3 Hari: Rp 50.000\n7 Hari: Rp 100.000\n15 Hari: Rp 150.000\n30 Hari: Rp 200.000\nLifetime: Rp 300.000\n\nKetik /buy untuk detail.' },
        { keywords: ['stok', 'stock', 'tersedia', 'ada', 'sisa'], 
          reply: '📊 CEK STOK:\n\nKetik /stok untuk melihat stok key yang tersedia.' },
        { keywords: ['tutorial', 'cara', 'install', 'gunakan', 'pakai', 'setting'], 
          reply: '📖 TUTORIAL PEMAKAIAN:\n\n1. Download APK di shorekeeper.web.app\n2. Install di HP (izin install dari luar)\n3. Beli key di website atau via bot\n4. Masukkan key di aplikasi\n5. Aktifkan fitur yang diinginkan\n6. Selesai!\n\nKetik /tutorial untuk panduan lengkap.' },
        { keywords: ['aman', 'ban', 'diblokir', 'safety', 'keamanan', 'detected'], 
          reply: '🛡️ KEAMANAN:\n\nTool ini menggunakan metode bypass terbaru. Update rutin setiap ada patch game. Ribuan user aktif tanpa kena ban. Garansi 7 hari!' },
        { keywords: ['gratis', 'free', 'coba', 'test', 'demo'], 
          reply: '🎁 DAPATKAN KEY GRATIS!\n\nCukup share link website ke 3 grup Telegram, upload bukti, dan key 1 hari langsung aktif!\nKunjungi: shorekeeper.web.app' },
        { keywords: ['admin', 'owner', 'pemilik', 'cs', 'customer service'], 
          reply: '👤 ADMIN:\n\nHubungi admin via:\n• Telegram: @Keyskidbot\n• Website: shorekeeper.web.app\n\nJam aktif: 08.00 - 24.00 WIB' },
        { keywords: ['key', 'kunci', 'activate', 'aktif', 'aktivasi'], 
          reply: '🔑 INFO KEY:\n\n• Key dikirim setelah pembayaran diverifikasi\n• Aktivasi manual oleh admin (5-15 menit)\n• 1 key untuk 1 device\n• Cek key di website: shorekeeper.web.app' },
        { keywords: ['thank', 'thanks', 'makasih', 'terima kasih', 'trims'], 
          reply: '🙏 Sama-sama! Senang bisa membantu. Jangan lupa bintang 5 ya ⭐⭐⭐⭐⭐' },
        { keywords: ['download', 'unduh', 'apk'], 
          reply: '📥 DOWNLOAD APK:\n\nKunjungi: shorekeeper.web.app\nAtau klik link: https://shorekeeper.web.app' },
        { keywords: ['order', 'pesan', 'beli'], 
          reply: '🛒 CARA ORDER:\n\n1. Kunjungi shorekeeper.web.app\n2. Pilih paket yang diinginkan\n3. Upload bukti bayar\n4. Key dikirim dalam 5-15 menit\n\nAtau ketik /buy untuk lihat paket.' },
        { keywords: ['payment', 'bayar', 'pembayaran', 'transfer'], 
          reply: '💳 METODE PEMBAYARAN:\n\n• QRIS (BCA/OVO/DANA/GOPAY)\n• DANA / OVO: 0895401347006\n• BINANCE: 1232544379\n• GIFT CARD (Google Play/App Store/Steam)\n\nHubungi @Keyskidbot untuk detail.' },
    ];
    
    for (const item of replies) {
        for (const kw of item.keywords) {
            if (lower.includes(kw)) {
                return item.reply;
            }
        }
    }
    
    return null;
}

// ============================================================
// BOT COMMANDS
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'User';
    bot.sendMessage(chatId,
        `🏠 SHOREKEEPER ELITE\n━━━━━━━━━━━━━━━\n\nSelamat datang ${name}! 🚀\n\nGunakan menu di bawah untuk memulai.`,
        getMainMenu()
    );
});

bot.onText(/\/buy|beli/i, (msg) => showPackagesBot(msg.chat.id));
bot.onText(/\/stok/, (msg) => showStockBot(msg.chat.id));
bot.onText(/\/tutorial/, (msg) => showTutorialBot(msg.chat.id));
bot.onText(/\/help/, (msg) => showHelpBot(msg.chat.id));
bot.onText(/\/free/, (msg) => showFreeBot(msg.chat.id));

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

// ============================================================
// USER STATE UNTUK BATCH IMPORT
// ============================================================
const userStates = new Map();

bot.onText(/\/batch ?(.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin!');
        return;
    }
    const defaultLabel = match && match[1] ? match[1].trim() : '1Day';
    const finalLabel = labelMap[defaultLabel.toLowerCase()] || defaultLabel;

    userStates.set(chatId, { step: 'batch_import', defaultLabel: finalLabel });
    bot.sendMessage(chatId, `📥 Kirim daftar key sekarang (1 pesan, boleh banyak baris)\n📦 Default label: ${finalLabel}\n\nFormat yang didukung:\n• BS-7EHLVXBH\n• BS-7EHLVXBH 1 Day\n• 1097 BS BS-JLMQFM5I 0/1 1 Day\n\nKirim daftar key sekarang!`);
});

// ============================================================
// PARSE BATCH TEXT
// ============================================================
function parseBatchText(text, defaultLabel = '1Day') {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const results = [];
    let currentLabel = defaultLabel;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^(#|Kunci|Perangkat|Lamanya|Kedaluwarsa|Tindakan|Menunjukkan|entri|Mencari|Selamat|K R U N C H P O I N T)/i)) continue;
        if (trimmed.match(/^[─═━—\-]+$/)) continue;

        const panelMatch = trimmed.match(/^\s*(\d+)\s+BS\s+(BS-[A-Z0-9]+)\s+\d+\/\d+\s+([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life))\s*(?:\(.*?\))?/);
        if (panelMatch) {
            const key = panelMatch[2];
            const normalized = panelMatch[3].trim().toLowerCase().replace(/\s+/g, ' ').trim();
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (normalized.includes(keyMap)) { foundLabel = value; break; }
            }
            results.push({ key, label: foundLabel || defaultLabel });
            continue;
        }

        const simpleWithLabel = trimmed.match(/^(BS-[A-Z0-9]+)\s+([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life))/i);
        if (simpleWithLabel) {
            const key = simpleWithLabel[1];
            const normalized = simpleWithLabel[2].trim().toLowerCase().replace(/\s+/g, ' ').trim();
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (normalized.includes(keyMap)) { foundLabel = value; break; }
            }
            results.push({ key, label: foundLabel || defaultLabel });
            continue;
        }

        const keyOnly = trimmed.match(/^(BS-[A-Z0-9]+)$/);
        if (keyOnly) {
            results.push({ key: keyOnly[1], label: currentLabel });
            continue;
        }

        const anyKey = trimmed.match(/BS-[A-Z0-9]+/);
        if (anyKey) {
            let detectedLabel = currentLabel;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (trimmed.toLowerCase().includes(keyMap)) { detectedLabel = value; break; }
            }
            results.push({ key: anyKey[0], label: detectedLabel });
            continue;
        }
    }
    return results;
}

// ============================================================
// HELPERS
// ============================================================
function showPackagesBot(chatId) {
    let text = '📦 DAFTAR PAKET\n━━━━━━━━━━━━━━━\n\n';
    PKGS.forEach(pkg => {
        const count = getStockCount(pkg.id);
        const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
        text += `${pkg.name} - ${pkg.idr}\n📊 ${status}\n\n`;
    });
    text += '━━━━━━━━━━━━━━━\n🌐 Beli via website: shorekeeper.web.app';
    bot.sendMessage(chatId, text);
}

function showStockBot(chatId) {
    let reply = '📊 STOK KEY\n━━━━━━━━━━━━━━━\n\n';
    let total = 0;
    for (const [label, keys] of Object.entries(data.stock)) {
        reply += `📦 ${label}: ${keys.length} key\n`;
        total += keys.length;
    }
    reply += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key`;
    bot.sendMessage(chatId, reply);
}

function showTutorialBot(chatId) {
    bot.sendMessage(chatId, 
        '📖 TUTORIAL\n━━━━━━━━━━━━━━━\n\n' +
        '1️⃣ Download APK di shorekeeper.web.app\n' +
        '2️⃣ Install di HP (izin install dari luar)\n' +
        '3️⃣ Beli key di website atau via bot\n' +
        '4️⃣ Masukkan key di aplikasi\n' +
        '5️⃣ Aktifkan fitur yang diinginkan\n' +
        '6️⃣ Selesai! 🎉\n\n' +
        '📹 Video: youtube.com/@ZelewinGaming'
    );
}

function showHelpBot(chatId) {
    bot.sendMessage(chatId,
        '❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n' +
        '/start - Menu utama\n' +
        '/buy - Lihat paket\n' +
        '/stok - Cek stok\n' +
        '/tutorial - Panduan\n' +
        '/free - Key gratis\n' +
        '/help - Bantuan ini\n\n' +
        '🌐 Website: shorekeeper.web.app\n' +
        '📢 Channel: @ShorekeeperID'
    );
}

function showFreeBot(chatId) {
    bot.sendMessage(chatId,
        '🎁 KEY GRATIS 1 HARI\n━━━━━━━━━━━━━━━\n\n' +
        'Cara mendapatkan:\n' +
        '1️⃣ Share link website ke 3 grup Telegram\n' +
        '2️⃣ Screenshot bukti share\n' +
        '3️⃣ Upload di website\n' +
        '4️⃣ Key langsung aktif!\n\n' +
        '🌐 Kunjungi: shorekeeper.web.app'
    );
}

// ============================================================
// CALLBACK QUERY
// ============================================================
bot.on('callback_query', async (callback) => {
    const chatId = callback.message.chat.id;
    const cbData = callback.data;
    bot.answerCallbackQuery(callback.id);

    if (cbData === 'buy_key') return showPackagesBot(chatId);
    if (cbData === 'cek_stok') return showStockBot(chatId);
    if (cbData === 'tutorial') return showTutorialBot(chatId);
    if (cbData === 'help') return showHelpBot(chatId);
    if (cbData === 'free_key') return showFreeBot(chatId);
});

// ============================================================
// MESSAGE HANDLER
// ============================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    if (text.startsWith('/')) return;

    // BATCH IMPORT
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

        let reply = `✅ BATCH IMPORT SELESAI!\n━━━━━━━━━━━━━━━\n\n✅ ${added} key berhasil ditambahkan\n`;
        if (duplicate > 0) reply += `⚠️ ${duplicate} key duplikat\n`;
        reply += `\n📊 PER PAKET:\n`;
        for (const [label, count] of Object.entries(summary)) reply += `   ${label}: +${count}\n`;
        reply += `\n📦 Total stok sekarang: ${getTotalStock()} key`;

        bot.sendMessage(chatId, reply);
        userStates.delete(chatId);
        return;
    }

    // ADMIN: REPLY CHAT
    const replyMatch = text.match(/^REPLY\s+(\S+)\s+([\s\S]+)/i);
    if (replyMatch && isAdmin) {
        const targetChatId = replyMatch[1];
        const replyText = replyMatch[2].trim();

        if (!data.chatMessages) data.chatMessages = {};
        if (!data.chatMessages[targetChatId]) data.chatMessages[targetChatId] = [];
        data.chatMessages[targetChatId].push({
            from: 'admin',
            text: replyText,
            time: new Date().toISOString()
        });
        saveData(data);

        try {
            bot.sendMessage(targetChatId, `👤 ADMIN: ${replyText}`);
            bot.sendMessage(chatId, `✅ Balasan terkirim ke chat ${targetChatId}`);
        } catch (e) {
            bot.sendMessage(chatId, `❌ Gagal kirim ke user: ${e.message}`);
        }
        return;
    }

    // AUTO-REPLY UNTUK USER
    if (!isAdmin) {
        const name = msg.from.first_name || msg.from.username || 'User';
        const username = msg.from.username ? `@${msg.from.username}` : '';
        const chatInfo = msg.from.username ? `👤 ${name} (${username})` : `👤 ${name}`;
        
        bot.sendMessage(ADMIN_ID, 
            `💬 PESAN DARI USER\n━━━━━━━━━━━━━━━\n${chatInfo}\n🆔 ${chatId}\n📝 ${text}\n\n📌 Balas dengan: REPLY ${chatId} [pesan]`
        );

        const autoReply = getAutoReply(text);
        if (autoReply) {
            bot.sendMessage(chatId, autoReply);
        } else {
            bot.sendMessage(chatId, 
                '✅ Pesan terkirim ke admin! Kami akan balas secepatnya.\n\n' +
                '💡 Ketik /start untuk menu utama.'
            );
        }
        return;
    }

    // ADMIN: Menu
    if (isAdmin) {
        bot.sendMessage(chatId,
            '👑 MENU ADMIN\n━━━━━━━━━━━━━━━\n\n' +
            '/addkey [key] [label] - Tambah key\n' +
            '/delkey [key] - Hapus key\n' +
            '/batch [label] - Import banyak key\n' +
            '/stok - Cek stok\n' +
            '/reset - Hapus semua key\n' +
            '/sync - Info data\n\n' +
            '📌 Balas chat user:\n' +
            'REPLY [chatId] [pesan]'
        );
    }
});

// ============================================================
// NOTIFIKASI
// ============================================================
async function sendTelegramNotification(text) {
    try {
        await bot.sendMessage(ADMIN_ID, text);
    } catch (e) {
        console.error('Telegram notification error:', e);
    }
}

app.post('/api/notify', (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.length > 2000) {
        return res.status(400).json({ success: false, message: 'Invalid text' });
    }
    sendTelegramNotification(text);
    res.json({ success: true });
});

// ============================================================
// API ENDPOINTS
// ============================================================

app.get('/api/data', (req, res) => {
    res.json({
        stock: data.stock,
        orders: data.orders,
        freeRequests: data.freeRequests,
        reviews: data.reviews || [],
        totalSold: data.totalSold || 0,
        totalStock: getTotalStock(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/stock', (req, res) => {
    res.json({
        stock: data.stock,
        total: getTotalStock(),
        totalSold: data.totalSold || 0,
        timestamp: new Date().toISOString()
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
    res.json({ 
        success: true, 
        message: 'Stock updated!',
        total: getTotalStock()
    });
});

app.post('/api/key/add', (req, res) => {
    const { key, label } = req.body;
    if (!key || !label) {
        return res.status(400).json({ success: false, message: 'Key and label required' });
    }
    
    const result = addKey(label, key);
    res.json({ 
        success: result, 
        message: result ? 'Key added!' : 'Key already exists',
        stockCount: getStockCount(label)
    });
});

app.post('/api/key/use', (req, res) => {
    const { label } = req.body;
    if (!label) {
        return res.status(400).json({ success: false, message: 'Label required' });
    }
    
    const key = useKey(label);
    if (key) {
        res.json({ success: true, key: key });
    } else {
        res.json({ success: false, message: 'Stock empty!' });
    }
});

app.post('/api/order/create', (req, res) => {
    const { packageId, email, phone, key, method, proofImage } = req.body;
    
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
        userId: `WEB-${Date.now()}`,
        package: pkg.name,
        packageId: packageId,
        price: pkg.idr,
        key: key,
        email: email,
        phone: phone,
        method: method || 'qris',
        status: 'approved',
        createdAt: new Date().toISOString(),
        proofImage: proofImage || null,
        type: 'paid'
    };
    
    addOrder(order);
    
    sendTelegramNotification(
        `📦 ORDER BARU DARI WEBSITE\n━━━━━━━━━━━━━━━\n\n` +
        `🆔 ${order.orderId}\n📦 ${order.package}\n💰 ${order.price}\n🔑 ${order.key}\n📧 ${order.email}\n📱 ${order.phone}\n💳 ${order.method}\n📅 ${order.createdAt}`
    );
    
    res.json({ 
        success: true, 
        orderId: orderId,
        key: key,
        message: 'Order created successfully!'
    });
});

app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = data.orders.find(o => o.orderId === orderId);
    
    if (order) {
        res.json({ success: true, order: order });
    } else {
        res.json({ success: false, message: 'Order not found' });
    }
});

app.post('/api/free/request', (req, res) => {
    const { userId, key } = req.body;
    
    if (!userId || !key) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const orderId = 'FREE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    
    const freeReq = {
        userId: userId,
        orderId: orderId,
        key: key,
        status: 'approved',
        created: new Date().toISOString(),
        type: 'free'
    };
    
    addFreeRequest(freeReq);
    
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
    addOrder(order);
    
    sendTelegramNotification(
        `🎁 FREE KEY DIAMBIL!\n━━━━━━━━━━━━━━━\n\n` +
        `🆔 ${orderId}\n🔑 ${key}\n📅 ${order.createdAt}`
    );
    
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
        totalFree: (data.freeRequests || []).length,
        totalSold: data.totalSold || 0,
        totalStock: getTotalStock(),
        timestamp: new Date().toISOString()
    });
});

app.post('/api/batch/parse', (req, res) => {
    const { text, defaultLabel } = req.body;
    if (!text) {
        return res.status(400).json({ success: false, message: 'Text required' });
    }
    
    const results = parseBatchText(text, defaultLabel || '1Day');
    res.json({ success: true, results });
});

app.post('/api/batch/import', (req, res) => {
    const { keys, label } = req.body;
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ success: false, message: 'Keys array required' });
    }
    
    let added = 0;
    let duplicate = 0;
    
    keys.forEach(key => {
        if (addKey(label, key)) {
            added++;
        } else {
            duplicate++;
        }
    });
    
    res.json({
        success: true,
        added: added,
        duplicate: duplicate,
        total: added + duplicate,
        stockCount: getStockCount(label)
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📁 Data file: ${DATA_FILE}`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Total orders: ${data.orders.length}`);
    console.log(`\n📌 Bot Status:`);
    console.log(`   🤖 Bot: ✅ Running`);
    console.log(`   👤 Admin ID: ${ADMIN_ID}`);
    console.log(`\n📌 API Endpoints:`);
    console.log(`   GET  /api/stock - Lihat stok`);
    console.log(`   GET  /api/data - Lihat semua data`);
    console.log(`   POST /api/key/add - Tambah key`);
    console.log(`   POST /api/order/create - Buat order`);
    console.log(`   GET  /api/order/:id - Cek order`);
    console.log(`\n🌐 Website: http://localhost:${PORT}`);
});