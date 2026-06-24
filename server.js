const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CONFIG BOT - TOKEN TERBARU!
const BOT_TOKEN = '8950107483:AAGtvDaNSXEA-fULAPn86B6r5jCEn2fEM-A';
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

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html not found!');
    }
});

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

async function sendNotificationToAdmin(orderId, packageName, price, email, phone, proofImage, username) {
    try {
        console.log('📤 Sending notification to admin...');
        
        if (!proofImage || proofImage.length < 100) {
            console.log('❌ Proof image too short / invalid!');
            const fallbackUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: `📸 **NEW PAYMENT PROOF!**\n─────────────────\n\n` +
                        `🆔 Order: ${orderId}\n` +
                        `👤 User: ${username || 'Customer'}\n` +
                        `📦 Package: ${packageName}\n` +
                        `💰 Price: ${price}\n` +
                        `📧 Email: ${email}\n` +
                        `📱 WA: ${phone}\n\n` +
                        `⚠️ GAGAL KIRIM FOTO! Cek web.`,
                    parse_mode: 'Markdown'
                })
            });
            return false;
        }
        
        let imageBuffer;
        let contentType = 'image/jpeg';
        let extension = 'jpg';
        
        if (proofImage.startsWith('data:image')) {
            const matches = proofImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (matches) {
                contentType = `image/${matches[1]}`;
                extension = matches[1];
                imageBuffer = Buffer.from(matches[2], 'base64');
            } else {
                imageBuffer = Buffer.from(proofImage, 'base64');
            }
        } else {
            imageBuffer = Buffer.from(proofImage, 'base64');
        }
        
        console.log('📸 Image buffer size:', imageBuffer.length);
        
        const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const CRLF = '\r\n';
        
        let formData = '';
        formData += '--' + boundary + CRLF;
        formData += 'Content-Disposition: form-data; name="chat_id"' + CRLF + CRLF;
        formData += ADMIN_ID + CRLF;
        
        formData += '--' + boundary + CRLF;
        formData += `Content-Disposition: form-data; name="photo"; filename="proof.${extension}"` + CRLF;
        formData += `Content-Type: ${contentType}` + CRLF + CRLF;
        
        const caption = 
            `📸 **NEW PAYMENT PROOF!**\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Package: ${packageName}\n` +
            `💰 Price: ${price}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}\n\n` +
            `📌 Click button below to verify:`;
        
        const captionPart = Buffer.from(
            '--' + boundary + CRLF +
            'Content-Disposition: form-data; name="caption"' + CRLF + CRLF +
            caption + CRLF +
            '--' + boundary + '--' + CRLF
        );
        
        const finalBody = Buffer.concat([
            Buffer.from(formData),
            imageBuffer,
            Buffer.from(CRLF),
            captionPart
        ]);
        
        const response = await fetch(botUrl, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': finalBody.length
            },
            body: finalBody
        });
        
        const result = await response.json();
        console.log('📸 Response:', JSON.stringify(result));
        
        if (result.ok) {
            console.log('✅ Photo sent!');
            
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
            
            return true;
        } else {
            console.log('❌ Photo failed:', result);
            return false;
        }
    } catch (e) {
        console.error('❌ Notif error:', e.message);
        return false;
    }
}

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
    
    res.json({ success: true, orderId: orderId, status: 'pending' });
    
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

app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    const order = getOrderById(orderId);
    
    if (order) {
        const result = { ...order };
        if (order.status === 'pending') {
            result.key = null;
            result.message = 'Menunggu verifikasi admin';
        }
        return res.json({ success: true, order: result });
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
        priceNumber: 0,
        key: key,
        status: 'approved',
        createdAt: new Date().toISOString(),
        type: 'free'
    };
    
    addOrder(order);
    
    res.json({ success: true, orderId: orderId, key: key });
});

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