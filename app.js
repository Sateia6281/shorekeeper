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
// 🔥 KONFIGURASI
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
// TELEGRAM BOT
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
// 🔥 NOTIFIKASI KE ADMIN - VIA TELEGRAM BOT
// ============================================================
app.post('/api/notify-admin', async (req, res) => {
    const { orderId, packageName, price, email, phone, proofImage, username } = req.body;
    
    if (!proofImage) {
        return res.json({ success: false, message: 'No proof image' });
    }
    
    try {
        console.log('📤 Sending notification to admin...');
        
        // Kirim foto ke admin
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', proofImage);
        formData.append('caption', 
            `📸 NEW PAYMENT PROOF!\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Package: ${packageName}\n` +
            `💰 Price: ${price}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}\n\n` +
            `📌 Click below to verify:`
        );
        formData.append('parse_mode', 'Markdown');
        
        const response = await fetch(botUrl, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        console.log('📸 Photo sent:', result.ok);
        
        if (result.ok) {
            // Kirim tombol verifikasi
            const keyboardUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const keyboardData = {
                chat_id: ADMIN_ID,
                text: `🔑 **Verify Order:** ${orderId}\n\nClick button below:`,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ APPROVE', callback_data: `approve_${orderId}` },
                            { text: '❌ REJECT', callback_data: `reject_${orderId}` }
                        ]
                    ]
                },
                parse_mode: 'Markdown'
            };
            
            const kbResponse = await fetch(keyboardUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keyboardData)
            });
            const kbResult = await kbResponse.json();
            console.log('⌨️ Keyboard sent:', kbResult.ok);
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Notif error:', e.message);
        res.json({ success: false, message: e.message });
    }
});

// ============================================================
// 🔥 ORDER CREATE - TANPA AWAIT NOTIF!
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
        
        // 🔥 RESPONSE LANGSUNG KEMBALI - JANGAN TUNGGU NOTIFIKASI!
        res.json({ success: true, orderId: orderId, status: 'pending' });
        
        // 🔥 KIRIM NOTIFIKASI DI BACKGROUND - TIDAK MENUNGGU!
        if (proofImage) {
            console.log('📤 Sending notification in background...');
            fetch(`http://localhost:${PORT}/api/notify-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    packageName: pkg.name,
                    price: 'Rp ' + pkg.price.toLocaleString(),
                    email: email,
                    phone: phone,
                    proofImage: proofImage,
                    username: username || 'Customer'
                })
            }).catch(e => console.log('⚠️ Notif error:', e.message));
        } else {
            console.log('⚠️ No proof image, skipping notification');
        }
        
        // 🔥 TRIGGER UPDATE DI BACKGROUND
        triggerWebUpdate().catch(e => {});
        
    } catch (e) {
        console.error('❌ /api/order/create error:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ===== CEK ORDER - 🔥 KEY HIDDEN JIKA PENDING! =====
app.get('/api/order/:orderId', (req, res) => {
    try {
        refreshData();
        const { orderId } = req.params;
        const order = getOrderById(orderId);
        
        if (order) {
            // 🔥 JANGAN KIRIM KEY KALAU STATUS PENDING!
            const result = { ...order };
            if (order.status === 'pending') {
                result.key = null;
                result.message = 'Menunggu verifikasi admin';
            }
            return res.json({ success: true, order: result });
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
// 🤖 TELEGRAM BOT HANDLERS
// ============================================================

// ===== START =====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '👋 **KEY SKID BOT**\n─────────────────\n\n';
    text += '🛒 **BUYER:**\n';
    text += '   /buy - View packages & prices\n';
    text += '   /order [package] - Order key\n';
    text += '   /cek [order_id] - Check key status\n';
    text += '   /stok - Check key stock\n';
    text += '   /payment - Payment methods\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [package] [key] - Add 1 key\n';
        text += '   /addkeys - Add multiple keys\n';
        text += '   /addfreekey [key] - Add 1 free key\n';
        text += '   /addfreekeys - Add multiple free keys\n';
        text += '   /orders - View all orders\n';
        text += '   /stats - Statistics\n';
        text += '   /pkg - Package list\n';
        text += '   /addapk - Upload APK file\n';
    }
    
    text += '\n❓ /help - Help';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== HELP =====
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '❓ **HELP**\n─────────────────\n\n';
    text += '🛒 **BUYER:**\n';
    text += '   /buy - View packages & prices\n';
    text += '   /order [package] - Order key\n';
    text += '   /cek [order_id] - Check key status\n';
    text += '   /stok - Check key stock\n';
    text += '   /payment - Payment methods\n';
    text += '   /apk - Download APK\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [package] [key] - Add 1 key\n';
        text += '   /addkeys - Add multiple keys\n';
        text += '   /addfreekey [key] - Add 1 free key\n';
        text += '   /addfreekeys - Add multiple free keys\n';
        text += '   /orders - View all orders\n';
        text += '   /stats - Statistics\n';
        text += '   /pkg - Package list\n';
        text += '   /addapk - Upload APK file\n';
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== BUY =====
bot.onText(/\/buy/, (msg) => {
    const chatId = msg.chat.id;
    refreshData();
    
    let text = '🛒 **PACKAGES**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        const stock = getStockCount(pkg.id);
        const status = stock > 0 ? `✅ Stock: ${stock}` : '❌ OUT OF STOCK';
        text += `📌 *${pkg.name}*\n`;
        text += `   💰 Rp ${pkg.price.toLocaleString()}\n`;
        text += `   📊 ${status}\n`;
        text += `   📝 /order ${pkg.id}\n\n`;
    });
    
    text += '─────────────────\n';
    text += '📝 How to order: /order [package]\n';
    text += 'Example: /order 1HARI';
    
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
            `❌ Package *${packageInput}* not found!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const stock = getStockCount(pkg.id);
    if (stock === 0) {
        bot.sendMessage(chatId, 
            `❌ Stock *${pkg.name}* is empty!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    await bot.sendMessage(chatId, 
        `⏳ Processing order *${pkg.name}*...`,
        { parse_mode: 'Markdown' }
    );
    
    try {
        const key = reserveKey(pkg.id);
        if (!key) {
            bot.sendMessage(chatId, '❌ Out of stock!');
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
            `✅ **ORDER SUCCESS!**\n─────────────────\n\n` +
            `🔑 **KEY:** \`${key}\`\n` +
            `📦 Package: ${pkg.name}\n` +
            `💰 Price: Rp ${pkg.price.toLocaleString()}\n` +
            `🆔 Order ID: \`${orderId}\``,
            { parse_mode: 'Markdown' }
        );
        
        // Kirim APK otomatis
        try {
            const data = loadData();
            if (data.apkFile && data.apkFile.fileId) {
                await bot.sendDocument(chatId, data.apkFile.fileId, {
                    caption: `📦 **SHOREKEEPER ELITE APK**\n\n🔑 Key: \`${key}\`\n📦 Package: ${pkg.name}`,
                    parse_mode: 'Markdown'
                });
            }
        } catch (e) {}
        
        bot.sendMessage(ADMIN_ID,
            `🛒 **NEW ORDER!**\n─────────────────\n\n` +
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
            `❌ Order ID *${orderId}* not found!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let statusText = '';
    let statusEmoji = '';
    
    if (order.status === 'approved') {
        statusText = 'ACTIVE ✅';
        statusEmoji = '✅';
    } else if (order.status === 'pending') {
        statusText = 'WAITING VERIFICATION ⏳';
        statusEmoji = '⏳';
    } else {
        statusText = 'REJECTED ❌';
        statusEmoji = '❌';
    }
    
    let text = `🔍 **CHECK ORDER**\n─────────────────\n\n`;
    text += `🆔 Order: \`${order.orderId}\`\n`;
    text += `📦 Package: ${order.package}\n`;
    text += `💰 Price: ${order.price || 'Free'}\n`;
    text += `📊 Status: ${statusEmoji} ${statusText}\n`;
    
    if (order.key && order.status === 'approved') {
        text += `\n🔑 **KEY:** \`${order.key}\``;
    }
    
    if (order.status === 'pending') {
        text += `\n\n⏳ Please wait for admin verification.`;
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== STOK =====
bot.onText(/\/stok/, (msg) => {
    const chatId = msg.chat.id;
    refreshData();
    
    let text = '📊 **KEY STOCK**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        const count = getStockCount(pkg.id);
        const status = count > 0 ? `✅ ${count}` : '❌ 0';
        text += `📦 ${pkg.name}: ${status}\n`;
    });
    
    const freeCount = getStockCount('Free1Day');
    text += `🎁 FREE 1 DAY: ${freeCount > 0 ? `✅ ${freeCount}` : '❌ 0'}\n`;
    
    const total = getTotalStock();
    text += `\n─────────────────\n📦 Total: ${total} keys`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== PAYMENT =====
bot.onText(/\/payment/, async (msg) => {
    const chatId = msg.chat.id;
    
    let text = '💳 **PAYMENT METHODS**\n─────────────────\n\n';
    text += '💰 **QRIS:**\n';
    text += '   Scan QRIS on website\n\n';
    text += '💰 **DANA / OVO / GOPAY:**\n';
    text += '   📞 0895401347006\n';
    text += '   👤 A/N SHOREKEEPER\n\n';
    text += '💰 **GIFT CARD:**\n';
    text += '   Send to @Zelewin or @Yuangme\n\n';
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

// ===== APK - DOWNLOAD =====
bot.onText(/\/apk/, async (msg) => {
    const chatId = msg.chat.id;
    
    const data = loadData();
    const apkFile = data.apkFile;
    
    if (!apkFile || !apkFile.fileId) {
        bot.sendMessage(chatId,
            '❌ **APK not available!**\n─────────────────\n\n' +
            'Contact admin to get APK.\n' +
            '📞 @Zelewin or @Yuangme',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    try {
        await bot.sendDocument(chatId, apkFile.fileId, {
            caption: 
                `📦 **SHOREKEEPER ELITE APK**\n─────────────────\n\n` +
                `🔑 Install APK, then enter key.\n` +
                `📌 Key can be obtained from:\n` +
                `   • /buy - Buy key\n` +
                `   • /order [package] - Order key\n` +
                `   • /cek [order_id] - Check key\n\n` +
                `💡 Need help? Contact admin:\n` +
                `   @Zelewin / @Yuangme`,
            parse_mode: 'Markdown'
        });
    } catch (e) {
        console.error('❌ Error send APK:', e.message);
        bot.sendMessage(chatId, `❌ Failed to send APK: ${e.message}`);
    }
});

// ===== DOWNLOAD =====
bot.onText(/\/download/, (msg) => {
    bot.emit('text', { ...msg, text: '/apk' });
});

// ============================================================
// 🔴 ADMIN COMMANDS
// ============================================================

// ===== ADDKEY =====
bot.onText(/\/addkey (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    const packageInput = match[1].trim().toUpperCase();
    const key = match[2].trim().toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === packageInput);
    if (!pkg) {
        bot.sendMessage(chatId, 
            `❌ Package *${packageInput}* not found!\n📋 Packages: 2Jam, 5Jam, 1Day, 3Day, 7Day, 14Day, 30Day, 60Day`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (!key.startsWith('BS-')) {
        bot.sendMessage(chatId, 
            `❌ Invalid key format! Must start with *BS-*\nExample: BS-ABC123XYZ`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const success = addKey(packageInput, key);
    refreshData();
    
    if (success) {
        triggerWebUpdate();
        
        bot.sendMessage(chatId,
            `✅ **KEY ADDED!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `📦 ${pkg.name}\n` +
            `📊 Stock ${pkg.name}: ${getStockCount(packageInput)} keys`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            `⚠️ Key *${key}* already exists in *${pkg.name}* stock!`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ===== ADDKEYS =====
bot.onText(/\/addkeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }

    bot.sendMessage(chatId,
        '📝 **ADD MULTIPLE KEYS**\n─────────────────\n\n' +
        'Send key list (SUPPORTS PANEL FORMAT!):\n\n' +
        '📌 Panel Format:\n' +
        '`1313  BS  BS-ADF0P1TT  0/1  1 Day  (not started yet)`\n\n' +
        '📌 Simple Format:\n' +
        '`BS-ABC123 0/1 1Day`\n\n' +
        '📌 Minimal Format:\n' +
        '`BS-ABC123`\n\n' +
        '📌 Send in 1 message, multiple lines allowed!',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_keys' });
});

// ===== ADDFREEKEY =====
bot.onText(/\/addfreekey (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    const key = match[1].trim().toUpperCase();
    
    if (!key.startsWith('BS-')) {
        bot.sendMessage(chatId, 
            `❌ Invalid key format! Must start with *BS-*`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const success = addKey('Free1Day', key);
    refreshData();
    
    if (success) {
        triggerWebUpdate();
        
        bot.sendMessage(chatId,
            `✅ **FREE KEY ADDED!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `🎁 FREE 1 DAY\n` +
            `📊 Free stock: ${getStockCount('Free1Day')} keys`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            `⚠️ Key *${key}* already exists in FREE stock!`,
            { parse_mode: 'Markdown' }
        );
    }
});

// ===== ADDFREEKEYS =====
bot.onText(/\/addfreekeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }

    bot.sendMessage(chatId,
        '🎁 **ADD MULTIPLE FREE KEYS**\n─────────────────\n\n' +
        'Send free key list:\n\n' +
        'Format: `BS-ABC123`\n\n' +
        'All keys go to FREE 1 DAY stock',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_free_keys' });
});

// ===== ADDAPK =====
bot.onText(/\/addapk/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }

    bot.sendMessage(chatId,
        '📦 **UPLOAD APK**\n─────────────────\n\n' +
        'Send APK file now!\n' +
        'File will be saved and sent to buyers.',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_apk' });
});

// ===== ORDERS =====
bot.onText(/\/orders/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    refreshData();
    const orders = getOrders();
    const pending = getPendingOrders();
    
    if (orders.length === 0 && pending.length === 0) {
        bot.sendMessage(chatId, '📋 No orders yet.');
        return;
    }
    
    let text = '📋 **ORDERS**\n─────────────────\n\n';
    text += `📊 Total: ${orders.length + pending.length} orders\n\n`;
    
    if (pending.length > 0) {
        text += `⏳ **PENDING (${pending.length})**\n`;
        pending.slice(-5).forEach(o => {
            text += `• ${o.orderId} - ${o.package} (${o.price})\n`;
        });
        text += '\n';
    }
    
    if (orders.length > 0) {
        text += `✅ **SUCCESS (${orders.length})**\n`;
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
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    refreshData();
    const data = loadData();
    const orders = getOrders();
    const pending = getPendingOrders();
    const totalStock = getTotalStock();
    
    let text = '📊 **STATISTICS**\n─────────────────\n\n';
    text += `📦 Total Stock: ${totalStock}\n`;
    text += `📋 Total Orders: ${orders.length}\n`;
    text += `⏳ Pending: ${pending.length}\n`;
    text += `💰 Revenue: Rp ${(data.totalRevenue || 0).toLocaleString()}\n`;
    text += `📈 Sold: ${data.totalSold || 0}\n`;
    text += `\n🕐 ${new Date().toLocaleString('id-ID')}`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ===== PKG =====
bot.onText(/\/pkg/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    refreshData();
    
    let text = '📦 **PACKAGES**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        text += `📌 ${pkg.name}\n`;
        text += `   💰 Rp ${pkg.price.toLocaleString()}\n`;
        text += `   📊 Stock: ${getStockCount(pkg.id)}\n\n`;
    });
    
    text += `🎁 FREE 1 DAY: ${getStockCount('Free1Day')} keys`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// CALLBACK: APPROVE / REJECT ORDER
// ============================================================
bot.on('callback_query', async (callback) => {
    console.log('📩 Callback received:', callback.data);
    
    const chatId = callback.message.chat.id;
    const data = callback.data;
    const messageId = callback.message.message_id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        await bot.answerCallbackQuery(callback.id, { 
            text: '⛔ Admin only!', 
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
            await bot.editMessageText(`❌ Order ${orderId} not found!`, {
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
                `✅ **ORDER APPROVED!**\n─────────────────\n\n` +
                `🆔 ${orderId}\n` +
                `📦 ${order.package}\n` +
                `👤 ${order.username || 'Customer'}\n` +
                `🔑 \`${order.key}\`\n\n` +
                `📌 Key is now active!`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `✅ **PAYMENT APPROVED!**\n─────────────────\n\n` +
                    `🔑 **KEY:** \`${order.key}\`\n` +
                    `📦 Package: ${order.package}\n\n` +
                    `💡 Key is now active! Thank you!`,
                    { parse_mode: 'Markdown' }
                );
                
                // Kirim APK otomatis ke user
                try {
                    const data = loadData();
                    if (data.apkFile && data.apkFile.fileId) {
                        await bot.sendDocument(order.userChatId, data.apkFile.fileId, {
                            caption: `📦 **SHOREKEEPER ELITE APK**\n\n🔑 Key: \`${order.key}\`\n📦 Package: ${order.package}`,
                            parse_mode: 'Markdown'
                        });
                    }
                } catch (e) {}
            }
        }
    }
    
    if (data.startsWith('reject_')) {
        const orderId = data.replace('reject_', '');
        console.log('❌ Rejecting order:', orderId);
        refreshData();
        
        const order = getOrderById(orderId);
        if (!order) {
            await bot.editMessageText(`❌ Order ${orderId} not found!`, {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const rejected = rejectOrder(orderId);
        refreshData();
        
        if (rejected) {
            await bot.editMessageText(
                `❌ **ORDER REJECTED!**\n─────────────────\n\n` +
                `🆔 ${orderId}\n` +
                `📦 ${order.package}\n` +
                `👤 ${order.username || 'Customer'}\n\n` +
                `📌 User has been notified.`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
            if (order.userChatId) {
                bot.sendMessage(order.userChatId,
                    `❌ **PAYMENT REJECTED!**\n─────────────────\n\n` +
                    `🆔 ${orderId}\n` +
                    `📌 Payment proof is invalid / unclear.\n` +
                    `🔄 Please resend a clear proof.`,
                    { parse_mode: 'Markdown' }
                );
            }
        }
    }
});

// ============================================================
// HANDLE FILE APK DARI ADMIN
// ============================================================
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const state = userStates.get(chatId);
    
    if (!state || state.step !== 'waiting_apk') return;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Admin only!');
        return;
    }
    
    const file = msg.document;
    const fileName = file.file_name || 'Shorekeeper.apk';
    
    if (!fileName.endsWith('.apk')) {
        bot.sendMessage(chatId, '❌ Must be APK file! (.apk)');
        return;
    }
    
    try {
        const fileId = file.file_id;
        const data = loadData();
        if (!data.apkFile) data.apkFile = {};
        data.apkFile.fileId = fileId;
        data.apkFile.fileName = fileName;
        data.apkFile.updatedAt = new Date().toISOString();
        saveData(data);
        
        bot.sendMessage(chatId,
            `✅ **APK SAVED!**\n─────────────────\n\n` +
            `📦 File: ${fileName}\n` +
            `🕐 Updated: ${new Date().toLocaleString('id-ID')}\n\n` +
            `📌 Buyers can get it with:\n` +
            `   /apk - Download APK\n` +
            `   /download - Download APK`,
            { parse_mode: 'Markdown' }
        );
        
        userStates.delete(chatId);
        
    } catch (e) {
        console.error('❌ Error save APK:', e.message);
        bot.sendMessage(chatId, `❌ Failed to save file: ${e.message}`);
    }
});

// ============================================================
// HANDLE PESAN DARI USER (BUAT ADDKEYS + ADDFREEKEYS)
// ============================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    if (text.startsWith('/')) return;
    if (msg.document) return; // handled above
    
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
                    results.push(`⏭️ ${key} - ALREADY USED (skip)`);
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
                        results.push(`❌ ${key} - Unknown days: ${days}`);
                        continue;
                    }
                } else {
                    failed++;
                    results.push(`❌ ${key} - Cannot detect package`);
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
                    results.push(`⚠️ ${key} - Already in stock`);
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
                    results.push(`⏭️ ${key} - ALREADY USED (skip)`);
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
                    results.push(`❌ ${key} - Unknown package: ${packageRaw}`);
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
                    results.push(`⚠️ ${key} - Already in stock`);
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
                    results.push(`❌ ${key} - Unknown package: ${packageRaw}`);
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
                    results.push(`⚠️ ${key} - Already in stock`);
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
                        results.push(`⏭️ ${key} - ALREADY IN STOCK (skip)`);
                        break;
                    }
                }
                if (!found) {
                    failed++;
                    results.push(`❌ ${key} - Must include package! Example: /addkey 1Day ${key}`);
                }
                continue;
            }
            
            failed++;
            results.push(`❌ Invalid format: ${trimmed.substring(0, 60)}...`);
        }
        
        let reply = '📊 **ADD KEY RESULTS**\n─────────────────\n\n';
        reply += `✅ Success: ${added}\n`;
        reply += `⏭️ Skipped (already used): ${skipped}\n`;
        reply += `❌ Failed: ${failed}\n\n`;
        reply += '📋 **DETAILS:**\n';
        reply += results.slice(0, 20).join('\n');
        
        if (results.length > 20) {
            reply += `\n\n... and ${results.length - 20} more`;
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
                    results.push(`✅ ${key} → FREE 1 DAY`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Already in FREE stock`);
                }
            } else {
                failed++;
                results.push(`❌ Invalid format: ${trimmed.substring(0, 30)}...`);
            }
        }
        
        let reply = '🎁 **ADD FREE KEY RESULTS**\n─────────────────\n\n';
        reply += `✅ Success: ${added}\n`;
        reply += `❌ Failed: ${failed}\n\n`;
        reply += '📋 **DETAILS:**\n';
        reply += results.slice(0, 20).join('\n');
        
        if (results.length > 20) {
            reply += `\n\n... and ${results.length - 20} more`;
        }
        reply += `\n\n📊 Total FREE stock: ${getStockCount('Free1Day')} keys`;
        
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
    console.log(`📊 Total stock: ${getTotalStock()} keys`);
    console.log(`📋 Total orders: ${getOrders().length}`);
    console.log(`⏳ Pending: ${getPendingOrders().length}`);
    console.log(`${'='.repeat(50)}\n`);
});

console.log('✅ Server + Bot ready!');
console.log('🛒 Buyer: /buy, /order, /cek, /stok, /payment, /apk');
console.log('🔑 Admin: /addkey, /addkeys, /addfreekey, /addfreekeys, /addapk, /orders, /stats');
console.log('⚡ Notifications sent in background!');