const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// KONFIGURASI
// GANTI BOT_TOKEN DI BAWAH INI dengan token BARU dari @BotFather
// (token lama udah kebuka di chat, WAJIB di-revoke & ganti baru)
// ============================================================
require('dotenv').config();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID || 6284402885;
const DATA_FILE = path.join(__dirname, 'data.json');

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN belum di-set! Bikin file .env dan isi BOT_TOKEN=token_lo');
    process.exit(1);
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

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
    return getDefaultData();
}

function getDefaultData() {
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
            { name: 'BUDI S.', city: 'JAKARTA', rating: 5, text: 'MANTAP BRO LANGSUNG AKTIF! KEY DIKIRIM CEPET BANGET.', time: '2 HARI LALU' },
            { name: 'CITRA R.', city: 'BANDUNG', rating: 5, text: 'UDAH BELI 3X GAK PERNAH KECEWA. UNDETECTED BENERAN AMAN.', time: '5 HARI LALU' }
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
// TELEGRAM BOT (jalan bareng di proses yang sama -> data selalu sinkron)
// ============================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', (err) => {
    console.error('❌ Polling error:', err.code, err.message);
});

function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📦 Beli Key', callback_data: 'buy_key' }],
                [{ text: '📊 Cek Stok', callback_data: 'cek_stok' }],
                [{ text: '📖 Tutorial', callback_data: 'tutorial' }],
                [{ text: '❓ Bantuan', callback_data: 'help' }],
            ]
        }
    };
}

const userStates = new Map();
const botLabelMap = {
    '1jam': '1Jam', '5jam': '5Jam', '1day': '1Day',
    '3day': '3Day', '7day': '7Day', '15day': '15Day',
    '30day': '30Day', 'lifetime': 'Lifetime', 'life': 'Lifetime'
};

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        '🏠 SHOREKEEPER ELITE\n━━━━━━━━━━━━━━━\n\nSelamat datang! Gunakan menu dibawah.',
        getMainMenu()
    );
});

bot.onText(/\/buy|beli/i, (msg) => showPackagesBot(msg.chat.id));
bot.onText(/\/stok/, (msg) => showStockBot(msg.chat.id));

bot.onText(/\/addkey (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin');
        return;
    }
    const key = match[1].trim();
    const label = match[2].trim();
    const finalLabel = botLabelMap[label.toLowerCase()] || label;

    if (addKey(finalLabel, key)) {
        bot.sendMessage(chatId, `✅ Key ditambahkan!\n🔑 ${key}\n📦 ${finalLabel}`);
    } else {
        bot.sendMessage(chatId, `⚠️ Key ${key} sudah ada`);
    }
});

bot.onText(/\/batch ?(.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin');
        return;
    }
    const defaultLabel = match && match[1] ? match[1].trim() : '1Day';
    const finalLabel = botLabelMap[defaultLabel.toLowerCase()] || defaultLabel;

    userStates.set(chatId, { step: 'batch_import', defaultLabel: finalLabel });
    bot.sendMessage(chatId, `📥 Kirim daftar key sekarang (1 pesan, boleh banyak baris)\n📦 Default label: ${finalLabel}\n\nFormat yang didukung:\n• BS-7EHLVXBH\n• BS-7EHLVXBH 1 Day\n• 1097 BS BS-JLMQFM5I 0/1 1 Day`);
});

bot.onText(/\/delkey (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin');
        return;
    }
    const key = match[1].trim();
    let found = false;
    for (const label in data.stock) {
        if (data.stock[label].includes(key)) {
            removeKey(label, key);
            found = true;
            bot.sendMessage(chatId, `🗑️ Key dihapus!\n🔑 ${key}\n📦 ${label}`);
            break;
        }
    }
    if (!found) bot.sendMessage(chatId, `❌ Key ${key} tidak ditemukan`);
});

bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin');
        return;
    }
    for (const label in data.stock) data.stock[label] = [];
    saveData(data);
    bot.sendMessage(chatId, '🗑️ SEMUA KEY DIHAPUS!');
});

bot.onText(/\/sync/, (msg) => {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya untuk admin');
        return;
    }
    bot.sendMessage(chatId, `✅ Data tersimpan! Total: ${getTotalStock()} key`);
});

function parseBatchTextBot(text, defaultLabel = '1Day') {
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
            for (const [keyMap, value] of Object.entries(botLabelMap)) {
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
            for (const [keyMap, value] of Object.entries(botLabelMap)) {
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
            for (const [keyMap, value] of Object.entries(botLabelMap)) {
                if (trimmed.toLowerCase().includes(keyMap)) { detectedLabel = value; break; }
            }
            results.push({ key: anyKey[0], label: detectedLabel });
            continue;
        }
    }
    return results;
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    if (text.startsWith('/')) return;

    if (userStates.has(chatId) && userStates.get(chatId).step === 'batch_import') {
        const state = userStates.get(chatId);
        const parsed = parseBatchTextBot(text, state.defaultLabel);

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

    if (String(chatId) !== String(ADMIN_ID)) {
        const name = msg.from.first_name || 'User';
        bot.sendMessage(ADMIN_ID, `💬 DARI USER\n👤 ${name}\n🆔 ${chatId}\n📝 ${text}`);
        bot.sendMessage(chatId, '✅ Pesan terkirim ke admin!');
    }
});

bot.on('callback_query', async (callback) => {
    const chatId = callback.message.chat.id;
    const cbData = callback.data;
    bot.answerCallbackQuery(callback.id);

    if (cbData === 'buy_key') return showPackagesBot(chatId);
    if (cbData === 'cek_stok') return showStockBot(chatId);
    if (cbData === 'tutorial') {
        return bot.sendMessage(chatId, `📖 TUTORIAL\n━━━━━━━━━━━━━━━\n\n1. Download APK di shorekeeper.web.app\n2. Install di HP\n3. Beli key & dapatkan key\n4. Masukkan key di aplikasi\n5. Selesai!`);
    }
    if (cbData === 'help') {
        return bot.sendMessage(chatId, `❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n/buy - Beli key\n/stok - Cek stok\n/tutorial - Cara aktivasi\n/start - Menu utama\n\n🌐 Website: shorekeeper.web.app`);
    }
});

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

// ============================================================
// API ENDPOINTS
// ============================================================

// GET ALL DATA
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

// GET STOCK
app.get('/api/stock', (req, res) => {
    res.json({
        stock: data.stock,
        total: getTotalStock(),
        totalSold: data.totalSold || 0,
        timestamp: new Date().toISOString()
    });
});

// UPDATE STOCK
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

// TAMBAH KEY
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

// AMBIL KEY
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

// CREATE ORDER
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
    
    // Kirim notifikasi ke Telegram
    sendTelegramNotification(order);
    
    res.json({ 
        success: true, 
        orderId: orderId,
        key: key,
        message: 'Order created successfully!'
    });
});

// CEK ORDER
app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = data.orders.find(o => o.orderId === orderId);
    
    if (order) {
        res.json({ success: true, order: order });
    } else {
        res.json({ success: false, message: 'Order not found' });
    }
});

// FREE REQUEST
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
    
    res.json({ success: true, orderId: orderId, key: key });
});

// REVIEWS
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

// CHAT MESSAGES
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

// STATISTIK
app.get('/api/stats', (req, res) => {
    res.json({
        totalOrders: data.orders.length,
        totalFree: (data.freeRequests || []).length,
        totalSold: data.totalSold || 0,
        totalStock: getTotalStock(),
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// TELEGRAM HELPER
// ============================================================
async function sendTelegramNotification(order) {
    const text = `📦 ORDER BARU DARI WEBSITE
━━━━━━━━━━━━━━━

🆔 ${order.orderId}
📦 ${order.package}
💰 ${order.price}
🔑 ${order.key}
📧 ${order.email}
📱 ${order.phone}
💳 ${order.method}
📅 ${order.createdAt}`;

    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_ID,
                text: text
            })
        });
    } catch (e) {
        console.error('Telegram notification error:', e);
    }
}

// ============================================================
// BATCH IMPORT - PARSE FORMAT PANEL
// ============================================================
app.post('/api/batch/parse', (req, res) => {
    const { text, defaultLabel } = req.body;
    if (!text) {
        return res.status(400).json({ success: false, message: 'Text required' });
    }
    
    const results = parseBatchText(text, defaultLabel || '1Day');
    res.json({ success: true, results });
});

function parseBatchText(text, defaultLabel = '1Day') {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const results = [];
    
    const labelMap = {
        '1 jam': '1Jam', '1jam': '1Jam',
        '5 jam': '5Jam', '5jam': '5Jam',
        '1 day': '1Day', '1day': '1Day',
        '3 day': '3Day', '3day': '3Day',
        '7 day': '7Day', '7day': '7Day',
        '15 day': '15Day', '15day': '15Day',
        '30 day': '30Day', '30day': '30Day',
        'lifetime': 'Lifetime', 'life': 'Lifetime'
    };
    
    let currentLabel = defaultLabel;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip header
        if (trimmed.match(/^(#|Kunci|Perangkat|Lamanya|Kedaluwarsa|Tindakan|Menunjukkan|entri|Mencari|Selamat|K R U N C H P O I N T)/i)) continue;
        if (trimmed.match(/^[─═━—\-]+$/)) continue;
        
        // Format panel: "1097  BS  BS-JLMQFM5I  0/1  1 Day"
        const panelMatch = trimmed.match(/^\s*(\d+)\s+BS\s+(BS-[A-Z0-9]+)\s+\d+\/\d+\s+([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life))\s*(?:\(.*?\))?/);
        if (panelMatch) {
            const key = panelMatch[2];
            let label = panelMatch[3].trim();
            const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
            
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (normalized.includes(keyMap.toLowerCase())) {
                    foundLabel = value;
                    break;
                }
            }
            
            results.push({ key, label: foundLabel || defaultLabel });
            continue;
        }
        
        // Key + Label: "BS-7EHLVXBH  1 Day"
        const simpleWithLabel = trimmed.match(/^(BS-[A-Z0-9]+)\s+([\d\s]+(?:Day|day|Jam|jam|Hari|hari|Lifetime|life))/i);
        if (simpleWithLabel) {
            const key = simpleWithLabel[1];
            let label = simpleWithLabel[2].trim();
            const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
            
            let foundLabel = null;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (normalized.includes(keyMap.toLowerCase())) {
                    foundLabel = value;
                    break;
                }
            }
            
            results.push({ key, label: foundLabel || defaultLabel });
            continue;
        }
        
        // Only key: "BS-7EHLVXBH"
        const keyOnly = trimmed.match(/^(BS-[A-Z0-9]+)$/);
        if (keyOnly) {
            results.push({ key: keyOnly[1], label: currentLabel });
            continue;
        }
        
        // Key anywhere
        const anyKey = trimmed.match(/BS-[A-Z0-9]+/);
        if (anyKey) {
            let detectedLabel = currentLabel;
            for (const [keyMap, value] of Object.entries(labelMap)) {
                if (trimmed.toLowerCase().includes(keyMap)) {
                    detectedLabel = value;
                    break;
                }
            }
            results.push({ key: anyKey[0], label: detectedLabel });
            continue;
        }
    }
    
    return results;
}

// BATCH IMPORT - SIMPAN KE STOK
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
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Data file: ${DATA_FILE}`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Total orders: ${data.orders.length}`);
    console.log(`\n📌 API Endpoints:`);
    console.log(`   GET  /api/stock - Lihat stok`);
    console.log(`   GET  /api/data - Lihat semua data`);
    console.log(`   POST /api/key/add - Tambah key`);
    console.log(`   POST /api/order/create - Buat order`);
    console.log(`   GET  /api/order/:id - Cek order`);
    console.log(`   POST /api/batch/parse - Parse batch text`);
    console.log(`   POST /api/batch/import - Import batch keys`);
    console.log(`\n🌐 Website: http://localhost:${PORT}`);
});