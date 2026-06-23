const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Import database
const { 
    data,
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
    PKG_LIST
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
// API STOK
// ============================================================
app.get('/api/stock', (req, res) => {
    res.json({
        stock: data.stock,
        total: getTotalStock(),
        totalSold: data.totalSold || 0,
        pending: (data.pendingOrders || []).length,
        totalRevenue: data.totalRevenue || 0
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
    const { saveData } = require('./database');
    saveData(data);
    res.json({ success: true, total: getTotalStock() });
});

// ============================================================
// API ORDER
// ============================================================
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
        priceNumber: pkg.price,
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
    
    addPendingOrder(order);
    
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
    
    const { addOrder } = require('./database');
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
    const { saveData } = require('./database');
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
    const { saveData } = require('./database');
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
    
    // Cek di stok
    let foundKey = null;
    let foundPkg = null;
    
    for (const label in data.stock) {
        if (data.stock[label].includes(user_key)) {
            foundKey = user_key;
            foundPkg = label;
            break;
        }
    }
    
    // Cek di orders yang sudah approved
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
    
    // Key valid!
    const now = Math.floor(Date.now() / 1000);
    const token = 'SK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === foundPkg);
    const pkgName = pkg ? pkg.name : foundPkg;
    
    // Hitung expired (Lifetime = 3650 hari, lainnya 30 hari)
    const expDays = foundPkg === 'Lifetime' ? 3650 : 30;
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
    console.log(`📦 Total orders: ${data.orders.length}\n`);
});