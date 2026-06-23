const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const FormData = require('form-data');

// ============================================================
// DATABASE
// ============================================================
const { 
    loadData,
    saveData,
    addKey,
    getStockCount,
    getTotalStock,
    reserveKey,
    addOrder,
    getOrders,
    getPendingOrders,
    getOrderById,
    generateOrderId,
    addPendingOrder,
    approveOrder,
    rejectOrder,
    PKG_LIST,
    LABEL_MAP
} = require('./database');

// ============================================================
// 🔥 KONFIGURASI - PAKAI TOKEN BARU!
// ============================================================
const BOT_TOKEN = '8950107483:AAGdp4njIQSCmesk5-22p1bRODNMm6YqIaw';
const ADMIN_ID = '6284402885';
const PORT = process.env.PORT || 3000;

// ============================================================
// 🔥 ERROR HANDLER GLOBAL
// ============================================================
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
});

// ============================================================
// EXPRESS SERVER
// ============================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// ============================================================
// TELEGRAM BOT - PAKAI TOKEN BARU!
// ============================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🤖 Bot @Keyskidbot connected!');

// State untuk addkeys
const userStates = new Map();

// ============================================================
// 🔥 FUNGSI REFRESH DATA
// ============================================================
function refreshData() {
    try {
        return loadData();
    } catch (e) {
        console.error('❌ Error reload data:', e.message);
        return null;
    }
}

// ============================================================
// 🔥 TRIGGER UPDATE KE WEBSITE
// ============================================================
async function triggerWebUpdate() {
    try {
        const url = `http://localhost:${PORT}/api/trigger-update`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update' })
        });
        if (response.ok) {
            console.log('📡 Website triggered update!');
        }
    } catch (e) {
        // Skip
    }
}

// ============================================================
// 🔥 API ENDPOINTS
// ============================================================

// ===== STOK =====
app.get('/api/stock', (req, res) => {
    try {
        const fresh = refreshData();
        if (!fresh) {
            return res.status(500).json({ success: false, message: 'Data error' });
        }
        
        let total = 0;
        for (const label in fresh.stock) {
            total += fresh.stock[label].length;
        }
        
        res.json({
            success: true,
            stock: fresh.stock,
            total: total,
            totalSold: fresh.totalSold || 0,
            pending: (fresh.pendingOrders || []).length,
            totalRevenue: fresh.totalRevenue || 0,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error('❌ /api/stock error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== TRIGGER UPDATE =====
app.post('/api/trigger-update', (req, res) => {
    try {
        const fresh = refreshData();
        res.json({
            success: true,
            total: getTotalStock(),
            pending: (fresh?.pendingOrders || []).length,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// 🔥 ORDER CREATE - DENGAN NOTIFIKASI YANG PASTI JALAN!
// ============================================================
app.post('/api/order/create', async (req, res) => {
    try {
        console.log('📩 Order request received!');
        const { packageId, email, phone, key, method, proofImage, userChatId, username } = req.body;
        
        if (!packageId || !email || !phone || !key) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const normalizedPkgId = LABEL_MAP[packageId.toUpperCase().replace(/\s+/g, '')] || packageId;
        const pkg = PKG_LIST.find(p => p.id === normalizedPkgId);
        
        if (!pkg) {
            return res.status(400).json({ success: false, message: 'Package not found' });
        }
        
        const stock = getStockCount(normalizedPkgId);
        if (stock === 0) {
            return res.status(400).json({ success: false, message: 'Stok habis!' });
        }
        
        const orderId = generateOrderId();
        const order = {
            orderId: orderId,
            package: pkg.name,
            packageId: normalizedPkgId,
            price: 'Rp ' + pkg.price.toLocaleString(),
            priceNumber: pkg.price,
            key: key,
            email: email,
            phone: phone,
            username: username || 'Customer',
            method: method || 'qris',
            status: 'pending',
            createdAt: new Date().toISOString(),
            proofImage: proofImage || null,
            type: 'paid',
            userChatId: userChatId || null
        };
        
        addPendingOrder(order);
        refreshData();
        console.log('✅ Order saved, ID:', orderId);
        
        // ============================================================
        // 🔥 KIRIM NOTIFIKASI KE ADMIN - PASTI JALAN!
        // ============================================================
        if (proofImage) {
            console.log('📤 Sending notification to admin...');
            try {
                await notifyAdmin(orderId, pkg.name, pkg.price, email, phone, proofImage, username);
                console.log('✅ Notification sent successfully!');
            } catch (e) {
                console.error('❌ Gagal kirim notifikasi:', e.message);
                // TAPI ORDER TETAP BERHASIL!
            }
        } else {
            console.log('⚠️ No proof image, skipping notification');
        }
        
        await triggerWebUpdate();
        
        res.json({ success: true, orderId: orderId, status: 'pending' });
        
    } catch (e) {
        console.error('❌ /api/order/create error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== CEK ORDER =====
app.get('/api/order/:orderId', (req, res) => {
    try {
        refreshData();
        const { orderId } = req.params;
        const order = getOrderById(orderId);
        if (order) {
            return res.json({ success: true, order: order });
        }
        res.json({ success: false, message: 'Order not found' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== FREE KEY =====
app.post('/api/free/request', (req, res) => {
    try {
        const { userId, key } = req.body;
        if (!userId || !key) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const stock = getStockCount('Free1Day');
        if (stock === 0) {
            return res.status(400).json({ success: false, message: 'Stok gratis habis!' });
        }
        
        const orderId = 'FREE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
        const order = {
            orderId: orderId,
            userId: userId,
            package: 'GRATIS 1 HARI',
            packageId: 'Free1Day',
            price: 'Rp 0',
            priceNumber: 0,
            key: key,
            status: 'approved',
            createdAt: new Date().toISOString(),
            type: 'free'
        };
        
        addOrder(order);
        refreshData();
        triggerWebUpdate();
        
        res.json({ success: true, orderId: orderId, key: key });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== VALIDATE KEY (JNI) =====
app.post('/api/validate', (req, res) => {
    try {
        const fresh = refreshData();
        const { user_key } = req.body;
        
        if (!user_key) {
            return res.json({ status: false, reason: 'Key tidak boleh kosong' });
        }
        
        let foundKey = null;
        let foundPkg = null;
        
        for (const label in fresh.stock) {
            if (fresh.stock[label].includes(user_key)) {
                foundKey = user_key;
                foundPkg = label;
                break;
            }
        }
        
        if (!foundKey) {
            const order = fresh.orders.find(o => o.key === user_key && o.status === 'approved');
            if (order) {
                foundKey = order.key;
                foundPkg = order.packageId;
            }
        }
        
        if (!foundKey) {
            return res.json({ status: false, reason: 'Key tidak valid!' });
        }
        
        const now = Math.floor(Date.now() / 1000);
        const token = 'SK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const pkg = PKG_LIST.find(p => p.id === foundPkg);
        const pkgName = pkg ? pkg.name : foundPkg;
        
        const daysMap = {
            '2Jam': 0.08, '5Jam': 0.2, '1Day': 1, '3Day': 3,
            '7Day': 7, '14Day': 14, '30Day': 30, '60Day': 60
        };
        const expDays = daysMap[foundPkg] || 30;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + expDays);
        const expStr = expDate.toISOString().split('T')[0];
        
        res.json({
            status: true,
            data: {
                token: token,
                rng: now,
                EXP: expStr,
                MOD_NAME: 'Shorekeeper Elite',
                MOD_STATUS: '✅ SAFE',
                username: 'User',
                package: pkgName,
                days_left: expDays,
                created: new Date().toISOString(),
                menu_block: false,
                floating_text: 'Shorekeeper Elite • ' + pkgName,
                sig: ''
            }
        });
    } catch (e) {
        console.error('❌ /api/validate error:', e.message);
        res.status(500).json({ status: false, reason: 'Server error' });
    }
});

// ===== PAYMENT INFO =====
app.get('/api/payment', (req, res) => {
    res.json({
        success: true,
        qris: { image: 'qris.jpg', nominal: 'Sesuai paket yang dipilih' },
        dana: { number: '0895401347006', name: 'SHOREKEEPER' },
        ovo: { number: '0895401347006', name: 'SHOREKEEPER' },
        gopay: { number: '0895401347006', name: 'SHOREKEEPER' },
        giftcard: { info: 'Kirim ke @Zelewin atau @Yuangme' },
        admin: [
            { name: '@Zelewin', link: 'https://t.me/Zelewin' },
            { name: '@Yuangme', link: 'https://t.me/Yuangme' }
        ]
    });
});

// ===== GAMES =====
app.get('/api/games', (req, res) => {
    res.json([
        { id: 'bloodstrike', name: 'Blood Strike', icon: 'bloodstrike-icon.png' },
        { id: 'freefire', name: 'Free Fire', icon: 'freefire-icon.png' },
        { id: 'mlbb', name: 'Mobile Legends', icon: 'mlbb-icon.png' },
        { id: 'pubg', name: 'PUBG Mobile', icon: 'pubg-icon.png' },
        { id: 'arenabreakout', name: 'Arena Breakout', icon: 'arenabreakout-icon.png' },
        { id: 'sausageman', name: 'Sausage Man', icon: 'sausageman-icon.png' }
    ]);
});

// ===== STATS =====
app.get('/api/stats', (req, res) => {
    try {
        const fresh = refreshData();
        res.json({
            success: true,
            totalOrders: fresh.orders.length,
            totalSold: fresh.totalSold || 0,
            totalStock: getTotalStock(),
            pending: (fresh.pendingOrders || []).length,
            totalRevenue: fresh.totalRevenue || 0,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== REVIEWS =====
app.get('/api/reviews', (req, res) => {
    try {
        const fresh = refreshData();
        res.json({ success: true, reviews: fresh.reviews || [] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/reviews', (req, res) => {
    try {
        const { name, city, rating, text } = req.body;
        if (!name || !rating || !text) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }
        const fresh = refreshData();
        if (!fresh.reviews) fresh.reviews = [];
        fresh.reviews.push({
            name: name.toUpperCase(),
            city: city ? city.toUpperCase() : '',
            rating: rating,
            text: text,
            time: 'BARU SAJA'
        });
        saveData(fresh);
        res.json({ success: true, reviews: fresh.reviews });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== 404 =====
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
    console.error('💥 Express Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
});

// ============================================================
// 🔥 NOTIFIKASI ADMIN - PAKAI BOT @Keyskidbot!
// ============================================================
async function notifyAdmin(orderId, packageName, price, email, phone, proofImage, username) {
    try {
        console.log('📤 Sending notification...');
        console.log('📸 Proof image length:', proofImage ? proofImage.length : 0);
        
        // Kirim foto ke admin
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', proofImage);
        formData.append('caption', 
            `📸 **BUKTI PEMBAYARAN BARU!**\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Paket: ${packageName}\n` +
            `💰 Harga: Rp ${price.toLocaleString()}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}\n\n` +
            `📌 Klik tombol di bawah untuk verifikasi:`
        );
        formData.append('parse_mode', 'Markdown');
        
        console.log('📤 Sending photo to Telegram...');
        const response = await fetch(botUrl, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('📸 Response:', JSON.stringify(result).substring(0, 200));
        
        if (result.ok) {
            console.log('✅ Photo sent!');
            
            // Kirim tombol verifikasi
            const keyboardUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const keyboardData = {
                chat_id: ADMIN_ID,
                text: `🔑 **Verifikasi Order:** ${orderId}\n\nKlik tombol di bawah:`,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ SETUJU', callback_data: `approve_${orderId}` },
                            { text: '❌ TOLAK', callback_data: `reject_${orderId}` }
                        ]
                    ]
                },
                parse_mode: 'Markdown'
            };
            
            console.log('⌨️ Sending keyboard...');
            const kbResponse = await fetch(keyboardUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keyboardData)
            });
            
            const kbResult = await kbResponse.json();
            console.log('⌨️ Keyboard response:', JSON.stringify(kbResult).substring(0, 200));
            
            if (kbResult.ok) {
                console.log('✅ Keyboard sent!');
            } else {
                console.log('❌ Keyboard failed:', kbResult);
            }
        } else {
            console.log('❌ Photo failed:', result);
        }
        
    } catch (e) {
        console.error('❌ Notify error:', e.message);
        console.error(e.stack);
    }
}

// ============================================================
// 🤖 TELEGRAM BOT HANDLERS - @Keyskidbot
// ============================================================

// ===== START =====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '👋 **KEY SKID BOT**\n─────────────────\n\n';
    text += '🛒 **PEMBELI:**\n';
    text += '   /buy - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key\n';
        text += '   /addfreekey [key] - Tambah 1 key gratis\n';
        text += '   /addfreekeys - Tambah banyak key gratis\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /pkg - Daftar paket\n';
    }
    
    text += '\n❓ /help - Bantuan';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== HELP =====
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '❓ **BANTUAN**\n─────────────────\n\n';
    text += '🛒 **PEMBELI:**\n';
    text += '   /buy - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key\n';
        text += '   /addfreekey [key] - Tambah 1 key gratis\n';
        text += '   /addfreekeys - Tambah banyak key gratis\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /pkg - Daftar paket\n';
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== BUY =====
bot.onText(/\/buy/, (msg) => {
    const chatId = msg.chat.id;
    refreshData();
    
    let text = '🛒 **DAFTAR PAKET**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        const stock = getStockCount(pkg.id);
        const status = stock > 0 ? `✅ Stok: ${stock}` : '❌ HABIS';
        text += `📌 *${pkg.name}*\n`;
        text += `   💰 Rp ${pkg.price.toLocaleString()}\n`;
        text += `   📊 ${status}\n`;
        text += `   📝 /order ${pkg.id}\n\n`;
    });
    
    text += '─────────────────\n';
    text += '📝 Cara order: /order [paket]\n';
    text += 'Contoh: /order 1HARI';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== ORDER =====
bot.onText(/\/order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';
    const packageInput = match[1].trim().toUpperCase();
    
    refreshData();
    
    let pkg = PKG_LIST.find(p => p.id === packageInput);
    if (!pkg) {
        pkg = PKG_LIST.find(p => p.name === packageInput || p.name.includes(packageInput));
    }
    
    if (!pkg) {
        bot.sendMessage(chatId, 
            `❌ Paket *${packageInput}* tidak ditemukan!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const stock = getStockCount(pkg.id);
    if (stock === 0) {
        bot.sendMessage(chatId, 
            `❌ Stok *${pkg.name}* habis!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    await bot.sendMessage(chatId, 
        `⏳ Memproses order *${pkg.name}*...`,
        { parse_mode: 'Markdown' }
    );
    
    try {
        const key = reserveKey(pkg.id);
        if (!key) {
            bot.sendMessage(chatId, '❌ Stok habis!');
            return;
        }
        
        const orderId = generateOrderId();
        
        const order = {
            orderId: orderId,
            userId: userId,
            username: username,
            package: pkg.name,
            packageId: pkg.id,
            price: `Rp ${pkg.price.toLocaleString()}`,
            priceNumber: pkg.price,
            key: key,
            status: 'approved',
            createdAt: new Date().toISOString(),
            type: 'direct'
        };
        addOrder(order);
        refreshData();
        
        await triggerWebUpdate();
        
        bot.sendMessage(chatId,
            `✅ **ORDER BERHASIL!**\n─────────────────\n\n` +
            `🔑 **KEY:** \`${key}\`\n` +
            `📦 Paket: ${pkg.name}\n` +
            `💰 Harga: Rp ${pkg.price.toLocaleString()}\n` +
            `🆔 Order ID: \`${orderId}\``,
            { parse_mode: 'Markdown' }
        );
        
        bot.sendMessage(ADMIN_ID,
            `🛒 **ORDER BARU!**\n─────────────────\n\n` +
            `👤 ${username}\n` +
            `📦 ${pkg.name}\n` +
            `💰 Rp ${pkg.price.toLocaleString()}\n` +
            `🔑 \`${key}\`\n` +
            `🆔 ${orderId}`,
            { parse_mode: 'Markdown' }
        );
        
    } catch (error) {
        console.error('❌ Error order:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// ===== CEK =====
bot.onText(/\/cek (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();
    
    refreshData();
    const order = getOrderById(orderId);
    
    if (!order) {
        bot.sendMessage(chatId,
            `❌ Order ID *${orderId}* tidak ditemukan!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let statusText = '';
    let statusEmoji = '';
    
    if (order.status === 'approved') {
        statusText = 'AKTIF ✅';
        statusEmoji = '✅';
    } else if (order.status === 'pending') {
        statusText = 'MENUNGGU VERIFIKASI ⏳';
        statusEmoji = '⏳';
    } else {
        statusText = 'DITOLAK ❌';
        statusEmoji = '❌';
    }
    
    let text = `🔍 **CEK ORDER**\n─────────────────\n\n`;
    text += `🆔 Order: \`${order.orderId}\`\n`;
    text += `📦 Paket: ${order.package}\n`;
    text += `💰 Harga: ${order.price || 'Gratis'}\n`;
    text += `📊 Status: ${statusEmoji} ${statusText}\n`;
    
    if (order.key && order.status === 'approved') {
        text += `\n🔑 **KEY:** \`${order.key}\``;
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== STOK =====
bot.onText(/\/stok/, (msg) => {
    const chatId = msg.chat.id;
    refreshData();
    
    let text = '📊 **STOK KEY**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        const count = getStockCount(pkg.id);
        const status = count > 0 ? `✅ ${count}` : '❌ 0';
        text += `📦 ${pkg.name}: ${status}\n`;
    });
    
    const freeCount = getStockCount('Free1Day');
    text += `🎁 FREE 1 HARI: ${freeCount > 0 ? `✅ ${freeCount}` : '❌ 0'}\n`;
    
    const total = getTotalStock();
    text += `\n─────────────────\n📦 Total: ${total} key`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== PAYMENT =====
bot.onText(/\/payment/, async (msg) => {
    const chatId = msg.chat.id;
    
    let text = '💳 **METODE PEMBAYARAN**\n─────────────────\n\n';
    text += '💰 **QRIS:**\n';
    text += '   Scan QRIS di website\n\n';
    text += '💰 **DANA / OVO / GOPAY:**\n';
    text += '   📞 0895401347006\n';
    text += '   👤 A/N SHOREKEEPER\n\n';
    text += '💰 **GIFT CARD:**\n';
    text += '   Kirim ke @Zelewin atau @Yuangme\n\n';
    text += '👤 **ADMIN:**\n';
    text += '   @Zelewin\n';
    text += '   @Yuangme';
    
    try {
        await bot.sendPhoto(chatId, 'qris.jpg', {
            caption: text,
            parse_mode: 'Markdown'
        });
    } catch (e) {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
});

// ============================================================
// 🔴 ADMIN COMMANDS
// ============================================================

// ===== ADDKEY =====
bot.onText(/\/addkey (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    const packageInput = match[1].trim().toUpperCase();
    const key = match[2].trim().toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === packageInput);
    if (!pkg) {
        bot.sendMessage(chatId, 
            `❌ Paket *${packageInput}* tidak ditemukan!\n📋 Paket: 2Jam, 5Jam, 1Day, 3Day, 7Day, 14Day, 30Day, 60Day`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (!key.startsWith('BS-')) {
        bot.sendMessage(chatId, 
            `❌ Format key salah! Harus diawali *BS-*\nContoh: BS-ABC123XYZ`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const success = addKey(packageInput, key);
    refreshData();
    
    if (success) {
        triggerWebUpdate();
        
        bot.sendMessage(chatId,
            `✅ **KEY BERHASIL DITAMBAHKAN!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `📦 ${pkg.name}\n` +
            `📊 Stok ${pkg.name}: ${getStockCount(packageInput)} key`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            `⚠️ Key *${key}* sudah ada di stok *${pkg.name}*!`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ===== ADDKEYS =====
bot.onText(/\/addkeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    bot.sendMessage(chatId,
        '📝 **TAMBAH BANYAK KEY**\n─────────────────\n\n' +
        'Kirim daftar key (SUPPORT FORMAT PANEL!):\n\n' +
        '📌 Format Panel:\n' +
        '`1313  BS  BS-ADF0P1TT  0/1  1 Day  (not started yet)`\n\n' +
        '📌 Format Simple:\n' +
        '`BS-ABC123 0/1 1Day`\n\n' +
        '📌 Format Minimal:\n' +
        '`BS-ABC123`\n\n' +
        '📌 Kirim dalam 1 pesan, bisa banyak baris!',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_keys' });
});

// ===== ADDFREEKEY =====
bot.onText(/\/addfreekey (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    const key = match[1].trim().toUpperCase();
    
    if (!key.startsWith('BS-')) {
        bot.sendMessage(chatId, 
            `❌ Format key salah! Harus diawali *BS-*`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const success = addKey('Free1Day', key);
    refreshData();
    
    if (success) {
        triggerWebUpdate();
        
        bot.sendMessage(chatId,
            `✅ **KEY GRATIS BERHASIL DITAMBAHKAN!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `🎁 FREE 1 HARI\n` +
            `📊 Stok FREE: ${getStockCount('Free1Day')} key`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            `⚠️ Key *${key}* sudah ada di stok FREE!`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ===== ADDFREEKEYS =====
bot.onText(/\/addfreekeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    bot.sendMessage(chatId,
        '🎁 **TAMBAH BANYAK KEY GRATIS**\n─────────────────\n\n' +
        'Kirim daftar key gratis:\n\n' +
        'Format: `BS-ABC123`\n\n' +
        'Semua key masuk ke stok FREE 1 HARI',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_free_keys' });
});

// ===== ORDERS =====
bot.onText(/\/orders/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    refreshData();
    const orders = getOrders();
    const pending = getPendingOrders();
    
    if (orders.length === 0 && pending.length === 0) {
        bot.sendMessage(chatId, '📋 Belum ada order.');
        return;
    }
    
    let text = '📋 **DAFTAR ORDER**\n─────────────────\n\n';
    text += `📊 Total: ${orders.length + pending.length} order\n\n`;
    
    if (pending.length > 0) {
        text += `⏳ **PENDING (${pending.length})**\n`;
        pending.slice(-5).forEach(o => {
            text += `• ${o.orderId} - ${o.package} (${o.price})\n`;
        });
        text += '\n';
    }
    
    if (orders.length > 0) {
        text += `✅ **SUKSES (${orders.length})**\n`;
        orders.slice(-10).forEach(o => {
            text += `• ${o.orderId} - ${o.package} - ${o.username || '-'}\n`;
        });
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== STATS =====
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    refreshData();
    const data = loadData();
    const orders = getOrders();
    const pending = getPendingOrders();
    const totalStock = getTotalStock();
    
    let text = '📊 **STATISTIK**\n─────────────────\n\n';
    text += `📦 Total Stok: ${totalStock}\n`;
    text += `📋 Total Order: ${orders.length}\n`;
    text += `⏳ Pending: ${pending.length}\n`;
    text += `💰 Revenue: Rp ${(data.totalRevenue || 0).toLocaleString()}\n`;
    text += `📈 Terjual: ${data.totalSold || 0}\n`;
    text += `\n🕐 ${new Date().toLocaleString('id-ID')}`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== PKG =====
bot.onText(/\/pkg/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    refreshData();
    
    let text = '📦 **DAFTAR PAKET**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        text += `📌 ${pkg.name}\n`;
        text += `   💰 Rp ${pkg.price.toLocaleString()}\n`;
        text += `   📊 Stok: ${getStockCount(pkg.id)}\n\n`;
    });
    
    text += `🎁 FREE 1 HARI: ${getStockCount('Free1Day')} key`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// CALLBACK: SETUJU / TOLAK ORDER
// ============================================================
bot.on('callback_query', async (callback) => {
    console.log('📩 Callback received:', callback.data);
    
    const chatId = callback.message.chat.id;
    const data = callback.data;
    const messageId = callback.message.message_id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        await bot.answerCallbackQuery(callback.id, { 
            text: '⛔ Hanya admin!', 
            show_alert: true 
        });
        return;
    }
    
    await bot.answerCallbackQuery(callback.id);
    console.log('✅ Admin verified');
    
    if (data.startsWith('approve_')) {
        const orderId = data.replace('approve_', '');
        console.log('✅ Approving order:', orderId);
        refreshData();
        
        const order = getOrderById(orderId);
        if (!order) {
            await bot.editMessageText(`❌ Order ${orderId} tidak ditemukan!`, {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const approved = approveOrder(orderId);
        refreshData();
        
        if (approved) {
            await triggerWebUpdate();
            
            await bot.editMessageText(
                `✅ **ORDER DISETUJUI!**\n─────────────────\n\n` +
                `🆔 ${orderId}\n` +
                `📦 ${order.package}\n` +
                `👤 ${order.username || 'Customer'}\n` +
                `🔑 \`${order.key}\`\n\n` +
                `📌 Key sudah aktif!`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `✅ **PEMBAYARAN DISETUJUI!**\n─────────────────\n\n` +
                    `🔑 **KEY:** \`${order.key}\`\n` +
                    `📦 Paket: ${order.package}\n\n` +
                    `💡 Key sudah aktif! Terima kasih!`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    }
    
    if (data.startsWith('reject_')) {
        const orderId = data.replace('reject_', '');
        console.log('❌ Rejecting order:', orderId);
        refreshData();
        
        const order = getOrderById(orderId);
        if (!order) {
            await bot.editMessageText(`❌ Order ${orderId} tidak ditemukan!`, {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const rejected = rejectOrder(orderId);
        refreshData();
        
        if (rejected) {
            await bot.editMessageText(
                `❌ **ORDER DITOLAK!**\n─────────────────\n\n` +
                `🆔 ${orderId}\n` +
                `📦 ${order.package}\n` +
                `👤 ${order.username || 'Customer'}\n\n` +
                `📌 User sudah diberitahu.`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `❌ **PEMBAYARAN DITOLAK!**\n─────────────────\n\n` +
                    `🆔 ${orderId}\n` +
                    `📌 Bukti transfer tidak valid / tidak jelas.\n` +
                    `🔄 Silahkan kirim ulang bukti yang jelas.`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    }
});

// ============================================================
// HANDLE PESAN DARI USER (BUAT ADDKEYS + ADDFREEKEYS)
// ============================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    if (text.startsWith('/')) return;
    
    const state = userStates.get(chatId);
    if (!state) return;
    
    // ===== ADDKEYS =====
    if (state.step === 'waiting_keys') {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        let added = 0;
        let skipped = 0;
        let failed = 0;
        let results = [];

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Format Panel
            const panelMatch = trimmed.match(/^\d+\s+BS\s+(BS-[A-Z0-9-]+)\s+([01]\/[0-9]+)\s+([\d]+\s+(?:Day|Days|Hari|JAM|Jam))/i);
            if (panelMatch) {
                const key = panelMatch[1].toUpperCase();
                const status = panelMatch[2];
                const packageRaw = panelMatch[3].trim();
                
                if (status.startsWith('1/')) {
                    skipped++;
                    results.push(`⏭️ ${key} - SUDAH DIPAKAI (skip)`);
                    continue;
                }
                
                let packageId = '';
                const daysMatch = packageRaw.match(/(\d+)/);
                if (daysMatch) {
                    const days = parseInt(daysMatch[1]);
                    if (days === 1) packageId = '1Day';
                    else if (days === 2) packageId = '2Jam';
                    else if (days === 3) packageId = '3Day';
                    else if (days === 5) packageId = '5Jam';
                    else if (days === 7) packageId = '7Day';
                    else if (days === 14) packageId = '14Day';
                    else if (days === 30) packageId = '30Day';
                    else if (days === 60) packageId = '60Day';
                    else {
                        failed++;
                        results.push(`❌ ${key} - Hari tidak dikenal: ${days}`);
                        continue;
                    }
                } else {
                    failed++;
                    results.push(`❌ ${key} - Tidak bisa detect paket`);
                    continue;
                }
                
                const success = addKey(packageId, key);
                refreshData();
                
                if (success) {
                    added++;
                    await triggerWebUpdate();
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            // Format: BS-ABC123 0/1 1HARI
            const match2 = trimmed.match(/^(BS-[A-Z0-9-]+)\s+([01]\/[0-9]+)\s+([A-Z0-9 ]+)$/i);
            if (match2) {
                const key = match2[1].toUpperCase();
                const status = match2[2];
                const packageRaw = match2[3].toUpperCase().trim();
                
                if (status.startsWith('1/')) {
                    skipped++;
                    results.push(`⏭️ ${key} - SUDAH DIPAKAI (skip)`);
                    continue;
                }
                
                const packageMap = {
                    '1JAM': '2Jam', '2JAM': '2Jam', '5JAM': '5Jam',
                    '1HARI': '1Day', '1DAY': '1Day',
                    '3HARI': '3Day', '3DAY': '3Day',
                    '7HARI': '7Day', '7DAY': '7Day',
                    '14HARI': '14Day', '14DAY': '14Day',
                    '30HARI': '30Day', '30DAY': '30Day',
                    '60HARI': '60Day', '60DAY': '60Day'
                };
                
                let packageId = packageMap[packageRaw.replace(/\s+/g, '')];
                if (!packageId) {
                    const found = PKG_LIST.find(p => 
                        packageRaw.includes(p.id.toUpperCase()) || 
                        p.id.toUpperCase().includes(packageRaw)
                    );
                    if (found) packageId = found.id;
                }
                
                if (!packageId) {
                    failed++;
                    results.push(`❌ ${key} - Paket tidak dikenal: ${packageRaw}`);
                    continue;
                }
                
                const success = addKey(packageId, key);
                refreshData();
                
                if (success) {
                    added++;
                    await triggerWebUpdate();
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            // Format: PAKET|KEY
            const match3 = trimmed.match(/^(.+)\|(BS-[A-Z0-9-]+)$/i);
            if (match3) {
                const packageRaw = match3[1].trim().toUpperCase();
                const key = match3[2].trim().toUpperCase();
                
                const packageMap = {
                    '1JAM': '2Jam', '2JAM': '2Jam', '5JAM': '5Jam',
                    '1HARI': '1Day', '1DAY': '1Day',
                    '3HARI': '3Day', '3DAY': '3Day',
                    '7HARI': '7Day', '7DAY': '7Day',
                    '14HARI': '14Day', '14DAY': '14Day',
                    '30HARI': '30Day', '30DAY': '30Day',
                    '60HARI': '60Day', '60DAY': '60Day'
                };
                
                let packageId = packageMap[packageRaw.replace(/\s+/g, '')];
                if (!packageId) {
                    const found = PKG_LIST.find(p => 
                        packageRaw.includes(p.id.toUpperCase()) || 
                        p.id.toUpperCase().includes(packageRaw)
                    );
                    if (found) packageId = found.id;
                }
                
                if (!packageId) {
                    failed++;
                    results.push(`❌ ${key} - Paket tidak dikenal: ${packageRaw}`);
                    continue;
                }
                
                const success = addKey(packageId, key);
                refreshData();
                
                if (success) {
                    added++;
                    await triggerWebUpdate();
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            // Hanya key
            const keyOnly = trimmed.match(/^(BS-[A-Z0-9-]+)$/i);
            if (keyOnly) {
                const key = keyOnly[1].toUpperCase();
                const fresh = loadData();
                let found = false;
                for (const label in fresh.stock) {
                    if (fresh.stock[label].includes(key)) {
                        found = true;
                        results.push(`⏭️ ${key} - SUDAH ADA di stok (skip)`);
                        break;
                    }
                }
                if (!found) {
                    failed++;
                    results.push(`❌ ${key} - Harus sertakan paket! Contoh: /addkey 1Day ${key}`);
                }
                continue;
            }
            
            failed++;
            results.push(`❌ Format salah: ${trimmed.substring(0, 60)}...`);
        }
        
        let reply = '📊 **HASIL TAMBAH KEY**\n─────────────────\n\n';
        reply += `✅ Berhasil: ${added}\n`;
        reply += `⏭️ Skipped (sudah dipakai): ${skipped}\n`;
        reply += `❌ Gagal: ${failed}\n\n`;
        reply += '📋 **DETAIL:**\n';
        reply += results.slice(0, 20).join('\n');
        
        if (results.length > 20) {
            reply += `\n\n... dan ${results.length - 20} lainnya`;
        }
        
        bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
        userStates.delete(chatId);
        return;
    }
    
    // ===== ADDFREEKEYS =====
    if (state.step === 'waiting_free_keys') {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        let added = 0;
        let failed = 0;
        let results = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            const match = trimmed.match(/(BS-[A-Z0-9-]+)/i);
            if (match) {
                const key = match[1].toUpperCase();
                const success = addKey('Free1Day', key);
                refreshData();
                
                if (success) {
                    added++;
                    await triggerWebUpdate();
                    results.push(`✅ ${key} → FREE 1 HARI`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok FREE`);
                }
            } else {
                failed++;
                results.push(`❌ Format salah: ${trimmed.substring(0, 30)}...`);
            }
        }
        
        let reply = '🎁 **HASIL TAMBAH KEY GRATIS**\n─────────────────\n\n';
        reply += `✅ Berhasil: ${added}\n`;
        reply += `❌ Gagal: ${failed}\n\n`;
        reply += '📋 **DETAIL:**\n';
        reply += results.slice(0, 20).join('\n');
        
        if (results.length > 20) {
            reply += `\n\n... dan ${results.length - 20} lainnya`;
        }
        reply += `\n\n📊 Total stok FREE: ${getStockCount('Free1Day')} key`;
        
        bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
        userStates.delete(chatId);
        return;
    }
});

// ============================================================
// 🚀 START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 SHOREKEEPER SERVER + BOT`);
    console.log(`${'='.repeat(50)}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`🤖 Bot: @Keyskidbot`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Total orders: ${getOrders().length}`);
    console.log(`⏳ Pending: ${getPendingOrders().length}`);
    console.log(`${'='.repeat(50)}\n`);
});

console.log('✅ Server + Bot siap!');
console.log('🛒 Pembeli: /buy, /order, /cek, /stok, /payment');
console.log('🔑 Admin: /addkey, /addkeys, /addfreekey, /addfreekeys, /orders, /stats');
console.log('⚡ Notifikasi akan dikirim ke admin!');