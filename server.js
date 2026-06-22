// ============================================================
// SERVER.JS - FULL VERSION (TANPA BLOKIR USER!)
// ============================================================

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
const ADMIN_ID = '6284402885'; // HANYA UNTUK NOTIFIKASI!
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
// TELEGRAM BOT - SEMUA USER BISA AKSES!
// ============================================================
console.log('🤖 Mencoba start Telegram Bot...');
let bot = null;

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
    // MENU UNTUK SEMUA USER
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

    // ✅ SEMUA USER BISA AKSES /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from.first_name || 'User';
        bot.sendMessage(chatId,
            `🏠 SHOREKEEPER ELITE\n━━━━━━━━━━━━━━━\n\nSelamat datang ${name}! 🚀\n\nGunakan menu di bawah untuk memulai.`,
            getMainMenu()
        );
    });

    // ✅ SEMUA USER BISA AKSES /menu
    bot.onText(/\/menu/, (msg) => {
        bot.sendMessage(msg.chat.id, '📋 Menu Utama', getMainMenu());
    });

    // ✅ SEMUA USER BISA AKSES /buy
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

    // ✅ SEMUA USER BISA AKSES /stok
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

    // ✅ SEMUA USER BISA AKSES /tutorial
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

    // ✅ SEMUA USER BISA AKSES /free
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

    // ✅ SEMUA USER BISA AKSES /help
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId,
            '❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n' +
            '/start - Menu utama\n' +
            '/menu - Tampilkan menu\n' +
            '/buy - Lihat paket\n' +
            '/stok - Cek stok\n' +
            '/tutorial - Panduan\n' +
            '/free - Key gratis\n' +
            '/help - Bantuan ini\n\n' +
            '🌐 Website: https://shorekeeper-production.up.railway.app'
        );
    });

    // ============================================================
    // ADMIN COMMANDS - KHUSUS ADMIN
    // ============================================================
    // ✅ HANYA ADMIN YANG BISA AKSES COMMAND INI
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
        let text = '📋 PENDING ORDERS\n━━━━━━━━━━━━━━━\n\n';
        pending.forEach((o, i) => {
            text += `${i+1}. 🆔 ${o.orderId}\n`;
            text += `   📦 ${o.package} - ${o.price}\n`;
            text += `   📧 ${o.email}\n\n`;
        });
        text += `\n✅ /approve [orderId]\n❌ /reject [orderId]`;
        bot.sendMessage(chatId, text);
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
            // Kirim key ke user
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
    // CALLBACK QUERY - SEMUA USER BISA PAKAI
    // ============================================================
    bot.on('callback_query', async (callback) => {
        const chatId = callback.message.chat.id;
        const cbData = callback.data;
        bot.answerCallbackQuery(callback.id);

        if (cbData === 'buy_key') {
            let text = '📦 DAFTAR PAKET\n━━━━━━━━━━━━━━━\n\n';
            PKGS.forEach(pkg => {
                const count = getStockCount(pkg.id);
                const status = count > 0 ? `✅ ${count} tersisa` : '❌ HABIS';
                text += `${pkg.name} - ${pkg.idr}\n📊 ${status}\n\n`;
            });
            text += '━━━━━━━━━━━━━━━\n🌐 Beli via website: https://shorekeeper-production.up.railway.app';
            bot.sendMessage(chatId, text);
        } else if (cbData === 'cek_stok') {
            let reply = '📊 STOK KEY\n━━━━━━━━━━━━━━━\n\n';
            let total = 0;
            for (const [label, keys] of Object.entries(data.stock)) {
                reply += `📦 ${label}: ${keys.length} key\n`;
                total += keys.length;
            }
            reply += `\n━━━━━━━━━━━━━━━\n📊 TOTAL: ${total} key`;
            bot.sendMessage(chatId, reply);
        } else if (cbData === 'tutorial') {
            bot.sendMessage(chatId,
                '📖 TUTORIAL\n━━━━━━━━━━━━━━━\n\n' +
                '1️⃣ Download APK di website\n' +
                '2️⃣ Install di HP\n' +
                '3️⃣ Beli key\n' +
                '4️⃣ Masukkan key\n' +
                '5️⃣ Selesai! 🎉'
            );
        } else if (cbData === 'free_key') {
            bot.sendMessage(chatId,
                '🎁 KEY GRATIS 1 HARI\n━━━━━━━━━━━━━━━\n\n' +
                '1️⃣ Share link ke 3 grup\n' +
                '2️⃣ Screenshot bukti\n' +
                '3️⃣ Upload di website\n' +
                '4️⃣ Key langsung aktif!\n\n' +
                '🌐 https://shorekeeper-production.up.railway.app'
            );
        } else if (cbData === 'help') {
            bot.sendMessage(chatId,
                '❓ BANTUAN\n━━━━━━━━━━━━━━━\n\n' +
                '/start - Menu utama\n' +
                '/buy - Lihat paket\n' +
                '/stok - Cek stok\n' +
                '/tutorial - Panduan\n' +
                '/free - Key gratis\n' +
                '/help - Bantuan ini\n\n' +
                '🌐 https://shorekeeper-production.up.railway.app'
            );
        }
    });

    // ============================================================
    // AUTO-REPLY - SEMUA USER
    // ============================================================
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';
        if (text.startsWith('/')) return;

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
        pending: (data.pendingOrders || []).length
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
            `📦 ORDER BARU!\n🆔 ${order.orderId}\n📦 ${order.package}\n💰 ${order.price}\n📧 ${order.email}\n📱 ${order.phone}\n🔑 ${order.key}\n\n✅ /approve ${order.orderId}\n❌ /reject ${order.orderId}`
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
    console.log(`\n🌐 Website: http://localhost:${PORT}`);
});