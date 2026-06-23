const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CONFIG BOT (SAMA DENGAN BOT.JS)
const BOT_TOKEN = '8950107483:AAE-GLbaL0SgsT9nzvh-LZCPPXw0vAVZ_yM';
const ADMIN_ID = '6284402885';

const { 
    data,
    loadData,
    getStockCount,
    getTotalStock,
    getOrders,
    getPendingOrders,
    getOrderById,
    generateOrderId,
    addPendingOrder,
    approveOrder,
    rejectOrder,
    reserveKey,
    addKey,
    PKG_LIST,
    saveData,
    LABEL_MAP
} = require('./database');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// ============================================================
// SERVE INDEX.HTML
// ============================================================
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html tidak ditemukan!');
    }
});

// ============================================================
// API STOK - RELOAD FRESH DARI FILE!
// ============================================================
app.get('/api/stock', (req, res) => {
    const freshData = loadData();  // 🔥 RELOAD FRESH DARI FILE!
    res.json({
        stock: freshData.stock,
        total: getTotalStock(),
        totalSold: freshData.totalSold || 0,
        pending: (freshData.pendingOrders || []).length,
        totalRevenue: freshData.totalRevenue || 0
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

// ============================================================
// API TRIGGER - PANGGIL DARI BOT BUAT UPDATE WEB (REAL TIME!)
// ============================================================
app.post('/api/trigger-update', (req, res) => {
    // 🔥 RELOAD DATA FRESH DARI FILE!
    data = loadData();
    
    console.log('📡 Website update triggered!');
    console.log('📊 Stok terbaru:', getTotalStock(), 'key');
    
    res.json({ 
        success: true, 
        message: 'Data reloaded', 
        stock: data.stock,
        total: getTotalStock(),
        timestamp: new Date().toISOString() 
    });
});

// ============================================================
// API ORDER
// ============================================================
app.post('/api/order/create', async (req, res) => {
    const { packageId, email, phone, key, method, proofImage, userChatId, username } = req.body;
    if (!packageId || !email || !phone || !key) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Normalisasi packageId
    const normalizedPkgId = LABEL_MAP[packageId.toUpperCase().replace(/\s+/g, '')] || packageId;
    
    const pkg = PKG_LIST.find(p => p.id === normalizedPkgId);
    if (!pkg) {
        return res.status(400).json({ success: false, message: 'Package not found' });
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
    
    // 🔥 KIRIM NOTIFIKASI KE ADMIN
    if (proofImage) {
        try {
            const notifyUrl = `http://localhost:${PORT}/api/notify`;
            await fetch(notifyUrl, {
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
            });
        } catch (e) {
            console.log('Gagal kirim notifikasi:', e.message);
        }
    }
    
    res.json({ success: true, orderId: orderId, status: 'pending' });
});

app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = getOrderById(orderId);
    if (order) {
        return res.json({ success: true, order: order });
    }
    res.json({ success: false, message: 'Order not found' });
});

// ============================================================
// API NOTIFIKASI KE BOT
// ============================================================
app.post('/api/notify', async (req, res) => {
    const { orderId, packageName, price, email, phone, proofImage, username } = req.body;
    
    if (!orderId || !proofImage) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    try {
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', proofImage);
        formData.append('caption', 
            `📸 **BUKTI PEMBAYARAN BARU!**\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Paket: ${packageName}\n` +
            `💰 Harga: ${price}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}\n\n` +
            `📌 Klik tombol di bawah untuk verifikasi:`
        );
        formData.append('parse_mode', 'Markdown');
        
        const response = await fetch(botUrl, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.ok) {
            const keyboardUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            const keyboardData = {
                chat_id: ADMIN_ID,
                text: `🔑 **Verifikasi Order:** ${orderId}`,
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
            
            await fetch(keyboardUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keyboardData)
            });
        }
        
        res.json({ success: true, message: 'Notifikasi terkirim ke admin' });
    } catch (error) {
        console.error('Error kirim notifikasi:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================
// API FREE KEY
// ============================================================
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
        priceNumber: 0,
        key: key,
        status: 'approved',
        createdAt: new Date().toISOString(),
        type: 'free'
    };
    
    addOrder(order);
    
    res.json({ success: true, orderId: orderId, key: key });
});

// ============================================================
// API REVIEWS
// ============================================================
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

// ============================================================
// API CHAT
// ============================================================
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

// ============================================================
// API STATS
// ============================================================
app.get('/api/stats', (req, res) => {
    res.json({
        totalOrders: data.orders.length,
        totalSold: data.totalSold || 0,
        totalStock: getTotalStock(),
        pending: (data.pendingOrders || []).length,
        totalRevenue: data.totalRevenue || 0,
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// API PAYMENT
// ============================================================
app.get('/api/payment', (req, res) => {
    res.json({
        qris: {
            image: 'qris.jpg',
            nominal: 'Sesuai paket yang dipilih'
        },
        dana: {
            number: '0895401347006',
            name: 'SHOREKEEPER'
        },
        ovo: {
            number: '0895401347006',
            name: 'SHOREKEEPER'
        },
        gopay: {
            number: '0895401347006',
            name: 'SHOREKEEPER'
        },
        giftcard: {
            info: 'Kirim ke @Zelewin atau @Yuangme'
        },
        admin: [
            { name: '@Zelewin', link: 'https://t.me/Zelewin' },
            { name: '@Yuangme', link: 'https://t.me/Yuangme' }
        ]
    });
});

// ============================================================
// API GAMES
// ============================================================
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

// ============================================================
// JNI ENDPOINT - VALIDASI KEY
// ============================================================
app.post('/api/validate', (req, res) => {
    const { user_key, serial, challenge } = req.body;
    
    console.log('🔑 Validasi key dari JNI:', user_key);
    
    if (!user_key) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak boleh kosong' 
        });
    }
    
    let foundKey = null;
    let foundPkg = null;
    
    for (const label in data.stock) {
        if (data.stock[label].includes(user_key)) {
            foundKey = user_key;
            foundPkg = label;
            break;
        }
    }
    
    if (!foundKey) {
        const order = data.orders.find(o => o.key === user_key && o.status === 'approved');
        if (order) {
            foundKey = order.key;
            foundPkg = order.packageId;
        }
    }
    
    if (!foundKey) {
        return res.json({ 
            status: false, 
            reason: 'Key tidak valid! Pastikan key benar.' 
        });
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
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stok: ${getTotalStock()} key`);
    console.log(`📋 Pending orders: ${(data.pendingOrders || []).length}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`🔑 JNI Endpoint: /api/validate`);
    console.log(`💳 Payment Endpoint: /api/payment`);
    console.log(`🎮 Games Endpoint: /api/games`);
    console.log(`⚡ Real-time trigger: /api/trigger-update`);
    console.log(`📦 Total orders: ${data.orders.length}\n`);
});