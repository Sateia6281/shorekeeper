const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CONFIG BOT
const BOT_TOKEN = '8950107483:AAGdp4njIQSCmesk5-22p1bRODNMm6YqIaw';
const ADMIN_ID = '6284402885';

const { 
    loadData,
    saveData,
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
    addOrder,
    PKG_LIST,
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
        res.status(404).send('index.html not found!');
    }
});

// ============================================================
// API STOK
// ============================================================
app.get('/api/stock', (req, res) => {
    const freshData = loadData();
    let total = 0;
    for (const label in freshData.stock) {
        total += freshData.stock[label].length;
    }
    res.json({
        stock: freshData.stock,
        total: total,
        totalSold: freshData.totalSold || 0,
        pending: (freshData.pendingOrders || []).length,
        totalRevenue: freshData.totalRevenue || 0
    });
});

// ============================================================
// API TRIGGER UPDATE
// ============================================================
app.post('/api/trigger-update', (req, res) => {
    const freshData = loadData();
    let total = 0;
    for (const label in freshData.stock) {
        total += freshData.stock[label].length;
    }
    res.json({ 
        success: true, 
        total: total,
        pending: (freshData.pendingOrders || []).length,
        timestamp: new Date().toISOString() 
    });
});

// ============================================================
// 🔥 KIRIM NOTIFIKASI KE ADMIN - LANGSUNG KE TELEGRAM!
// ============================================================
async function sendNotificationToAdmin(orderId, packageName, price, email, phone, proofImage, username) {
    try {
        console.log('📤 Sending notification to admin...');
        
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', proofImage);
        formData.append('caption', 
            `📸 **NEW PAYMENT PROOF!**\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Package: ${packageName}\n` +
            `💰 Price: ${price}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}\n\n` +
            `📌 Click button below to verify:`
        );
        formData.append('parse_mode', 'Markdown');
        
        const response = await fetch(botUrl, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        console.log('📸 Photo sent:', result.ok);
        
        if (result.ok) {
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
        
        return true;
    } catch (e) {
        console.error('❌ Notif error:', e.message);
        return false;
    }
}

// ============================================================
// API ORDER CREATE - 🔥 RESPONSE CEPAT, NOTIF LANGSUNG!
// ============================================================
app.post('/api/order/create', async (req, res) => {
    const { packageId, email, phone, key, method, proofImage, userChatId, username } = req.body;
    
    if (!packageId || !email || !phone || !key) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
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
    
    // 🔥 RESPONSE LANGSUNG KEMBALI - CEPAT!
    res.json({ success: true, orderId: orderId, status: 'pending' });
    
    // 🔥 KIRIM NOTIFIKASI LANGSUNG KE TELEGRAM - TANPA TUNGGU!
    if (proofImage) {
        console.log('📤 Sending notification directly to Telegram...');
        sendNotificationToAdmin(
            orderId,
            pkg.name,
            'Rp ' + pkg.price.toLocaleString(),
            email,
            phone,
            proofImage,
            username || 'Customer'
        ).catch(e => console.log('⚠️ Notif error:', e.message));
    }
});

// ============================================================
// API CEK ORDER - 🔥 KEY HIDDEN JIKA PENDING!
// ============================================================
app.get('/api/order/:orderId', (req, res) => {
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
// API VALIDATE (JNI)
// ============================================================
app.post('/api/validate', (req, res) => {
    const data = loadData();
    const { user_key } = req.body;
    
    if (!user_key) {
        return res.json({ status: false, reason: 'Key tidak boleh kosong' });
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
});

// ============================================================
// API LAINNYA
// ============================================================

app.get('/api/payment', (req, res) => {
    res.json({
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

app.get('/api/stats', (req, res) => {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    res.json({
        totalOrders: data.orders.length,
        totalSold: data.totalSold || 0,
        totalStock: total,
        pending: (data.pendingOrders || []).length,
        totalRevenue: data.totalRevenue || 0,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/reviews', (req, res) => {
    const data = loadData();
    res.json({ reviews: data.reviews || [] });
});

app.post('/api/reviews', (req, res) => {
    const { name, city, rating, text } = req.body;
    if (!name || !rating || !text) {
        return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    const data = loadData();
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
// START SERVER
// ============================================================
app.listen(PORT, () => {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stock: ${total} keys`);
    console.log(`📋 Pending orders: ${(data.pendingOrders || []).length}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`🔑 JNI Endpoint: /api/validate`);
    console.log(`📦 Total orders: ${data.orders.length}\n`);
});