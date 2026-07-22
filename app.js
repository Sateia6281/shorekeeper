const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8950107483:AAGtvDaNSXEA-fULAPn86B6r5jCEn2fEM-A';
const ADMIN_ID = '6284402885';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// ============================================================
// DATABASE — PAKAI data.json (FILE)
// ============================================================

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('❌ Error loading data.json:', e.message);
    }
    return {
        stock: {
            "2Jam": [],
            "5Jam": [],
            "1Day": [],
            "3Day": [],
            "7Day": [],
            "14Day": [],
            "30Day": [],
            "60Day": [],
            "Free1Day": []
        },
        orders: [],
        pendingOrders: [],
        lastOrderId: 0,
        totalSold: 0,
        totalRevenue: 0,
        reviews: [],
        chatMessages: {},
        apkFile: null,
        usedKeys: []
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Error saving data.json:', e.message);
    }
}

// ============================================================
// LABEL MAP
// ============================================================
const LABEL_MAP = {
    '2JAM': '2Jam', '2 JAM': '2Jam',
    '5JAM': '5Jam', '5 JAM': '5Jam',
    '1HARI': '1Day', '1 HARI': '1Day', '1DAY': '1Day',
    '3HARI': '3Day', '3 HARI': '3Day', '3DAY': '3Day',
    '7HARI': '7Day', '7 HARI': '7Day', '7DAY': '7Day',
    '14HARI': '14Day', '14 HARI': '14Day', '14DAY': '14Day',
    '30HARI': '30Day', '30 HARI': '30Day', '30DAY': '30Day',
    '60HARI': '60Day', '60 HARI': '60Day', '60DAY': '60Day',
    'FREE': 'Free1Day', 'FREE1DAY': 'Free1Day', 'FREE 1 HARI': 'Free1Day'
};

const PKG_LIST = [
    { id: '2Jam', name: '2 JAM', price: 5000 },
    { id: '5Jam', name: '5 JAM', price: 10000 },
    { id: '1Day', name: '1 HARI', price: 20000 },
    { id: '3Day', name: '3 HARI', price: 50000 },
    { id: '7Day', name: '7 HARI', price: 100000 },
    { id: '14Day', name: '14 HARI', price: 150000 },
    { id: '30Day', name: '30 HARI', price: 250000 },
    { id: '60Day', name: '60 HARI', price: 400000 },
];

// ============================================================
// FUNGSI STOK
// ============================================================
function addKey(label, key) {
    const data = loadData();
    const normalizedLabel = LABEL_MAP[label.toUpperCase().replace(/\s+/g, '')] || label;
    if (!data.stock[normalizedLabel]) data.stock[normalizedLabel] = [];
    if (!data.stock[normalizedLabel].includes(key)) {
        data.stock[normalizedLabel].push(key);
        saveData(data);
        return true;
    }
    return false;
}

function getStockCount(label) {
    const data = loadData();
    const normalizedLabel = LABEL_MAP[label.toUpperCase().replace(/\s+/g, '')] || label;
    if (!data.stock[normalizedLabel]) return 0;
    return data.stock[normalizedLabel].length;
}

function getTotalStock() {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    return total;
}

function reserveKey(label) {
    const data = loadData();
    const normalizedLabel = LABEL_MAP[label.toUpperCase().replace(/\s+/g, '')] || label;
    if (!data.stock[normalizedLabel] || data.stock[normalizedLabel].length === 0) {
        return null;
    }
    const key = data.stock[normalizedLabel].pop();
    saveData(data);
    return key;
}

function markKeyAsUsed(key) {
    const data = loadData();
    if (!data.usedKeys) data.usedKeys = [];
    if (!data.usedKeys.includes(key)) {
        data.usedKeys.push(key);
        saveData(data);
        return true;
    }
    return false;
}

function generateOrderId() {
    const data = loadData();
    data.lastOrderId = (data.lastOrderId || 0) + 1;
    saveData(data);
    return 'ORD' + Date.now().toString(36).toUpperCase() + String(data.lastOrderId).padStart(4, '0');
}

function addPendingOrder(order) {
    const data = loadData();
    if (!data.pendingOrders) data.pendingOrders = [];
    data.pendingOrders.push(order);
    saveData(data);
    return order;
}

function getOrderById(orderId) {
    const data = loadData();
    const pending = data.pendingOrders || [];
    const found = pending.find(o => o.orderId === orderId);
    if (found) return found;
    const orders = data.orders || [];
    return orders.find(o => o.orderId === orderId);
}

function approveOrder(orderId) {
    const data = loadData();
    const pending = data.pendingOrders || [];
    const index = pending.findIndex(o => o.orderId === orderId);
    if (index === -1) return null;
    const order = pending[index];
    data.pendingOrders.splice(index, 1);
    order.status = 'approved';
    order.confirmedAt = new Date().toISOString();
    data.orders.push(order);
    data.totalSold = (data.totalSold || 0) + 1;
    data.totalRevenue = (data.totalRevenue || 0) + (order.priceNumber || 0);
    if (order.key) markKeyAsUsed(order.key);
    saveData(data);
    return order;
}

function rejectOrder(orderId) {
    const data = loadData();
    const pending = data.pendingOrders || [];
    const index = pending.findIndex(o => o.orderId === orderId);
    if (index === -1) return null;
    const order = pending[index];
    data.pendingOrders.splice(index, 1);
    if (order.key && order.packageId) {
        if (!data.stock[order.packageId]) data.stock[order.packageId] = [];
        data.stock[order.packageId].push(order.key);
    }
    saveData(data);
    return order;
}

// ============================================================
// TELEGRAM FUNCTIONS
// ============================================================
async function sendTelegramMessage(chatId, text, options = {}) {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        };
        if (options.approveBtn) {
            payload.reply_markup = {
                inline_keyboard: [
                    [
                        { text: '✅ APPROVE', callback_data: `approve_${options.approveBtn}` },
                        { text: '❌ REJECT', callback_data: `reject_${options.approveBtn}` }
                    ]
                ]
            };
        }
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('Telegram error:', e.message);
    }
}

async function sendNotificationToAdmin(orderId, packageName, price, email, phone, proofImage, username) {
    try {
        if (!proofImage || proofImage.length < 100) {
            await sendTelegramMessage(ADMIN_ID, `⚠️ Order ${orderId} - Gambar tidak valid!`);
            return false;
        }

        let imageBuffer;
        if (proofImage.startsWith('data:image')) {
            const matches = proofImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (matches) {
                imageBuffer = Buffer.from(matches[2], 'base64');
            } else {
                imageBuffer = Buffer.from(proofImage, 'base64');
            }
        } else {
            imageBuffer = Buffer.from(proofImage, 'base64');
        }

        const formData = new FormData();
        formData.append('chat_id', ADMIN_ID);
        formData.append('photo', imageBuffer, {
            filename: `proof_${orderId}.jpg`,
            contentType: 'image/jpeg'
        });

        const caption =
            `📸 PAYMENT PROOF!\n─────────────────\n\n` +
            `🆔 Order: ${orderId}\n` +
            `👤 User: ${username || 'Customer'}\n` +
            `📦 Package: ${packageName}\n` +
            `💰 Price: ${price}\n` +
            `📧 Email: ${email}\n` +
            `📱 WA: ${phone}`;

        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });

        await sendTelegramMessage(
            ADMIN_ID,
            `🔑 Verify Order: ${orderId}\n\nClick button below:`,
            { approveBtn: orderId }
        );

        return true;
    } catch (e) {
        console.error('Notif error:', e.message);
        return false;
    }
}

// ============================================================
// API ENDPOINTS
// ============================================================

// STOCK
app.get('/api/stock', (req, res) => {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    res.json({
        stock: data.stock,
        total: total,
        totalSold: data.totalSold || 0,
        pending: (data.pendingOrders || []).length,
        totalRevenue: data.totalRevenue || 0
    });
});

// ORDER CREATE
app.post('/api/order/create', async (req, res) => {
    try {
        const { packageId, email, phone, method, proofImage, userChatId, username } = req.body;

        if (!packageId || !email || !phone) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const normalizedPkgId = LABEL_MAP[packageId.toUpperCase().replace(/\s+/g, '')] || packageId;
        const pkg = PKG_LIST.find(p => p.id === normalizedPkgId);

        if (!pkg) {
            return res.status(400).json({ success: false, message: 'Package not found' });
        }

        const key = reserveKey(normalizedPkgId);
        if (!key) {
            return res.status(400).json({ success: false, message: 'Stock is empty!' });
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
            sendNotificationToAdmin(
                orderId,
                pkg.name,
                'Rp ' + pkg.price.toLocaleString(),
                email,
                phone,
                proofImage,
                username || 'Customer'
            ).catch(e => console.log('Notif error:', e.message));
        }

    } catch (e) {
        console.error('Order create error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET ORDER
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

// FREE KEY REQUEST
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
    const data = loadData();
    data.orders.push(order);
    saveData(data);
    res.json({ success: true, orderId: orderId, key: key });
});

// VALIDATE KEY
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

// BOT API — TAMBAH 1 KEY
app.post('/api/bot/addkey', (req, res) => {
    try {
        const { packageId, key } = req.body;
        if (!packageId || !key) {
            return res.json({ success: false, message: 'Missing packageId or key' });
        }

        const data = loadData();
        if (!data.stock[packageId]) {
            return res.json({ success: false, message: 'Package not found: ' + packageId });
        }
        if (data.stock[packageId].includes(key)) {
            return res.json({ success: false, message: 'Key already exists: ' + key });
        }

        data.stock[packageId].push(key);
        saveData(data);

        console.log(`✅ Key ${key} ditambahkan ke ${packageId} via Bot`);
        res.json({ success: true, message: 'Key added!', package: packageId, key: key });
    } catch (e) {
        console.error('Error /api/bot/addkey:', e);
        res.json({ success: false, message: e.message });
    }
});

// BOT API — TAMBAH BANYAK KEY
app.post('/api/bot/addkeys', (req, res) => {
    try {
        const { keys } = req.body;
        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            return res.json({ success: false, message: 'Invalid keys array' });
        }

        const data = loadData();
        let added = 0;
        let skipped = 0;
        let failed = 0;
        let results = [];

        keys.forEach(({ packageId, key }) => {
            if (!packageId || !key) {
                failed++;
                results.push(`❌ Invalid: ${key || 'no key'}`);
                return;
            }

            if (!data.stock[packageId]) {
                failed++;
                results.push(`❌ Package not found: ${packageId}`);
                return;
            }

            if (data.stock[packageId].includes(key)) {
                skipped++;
                results.push(`⏭️ Already exists: ${key}`);
                return;
            }

            data.stock[packageId].push(key);
            added++;
            results.push(`✅ ${key} → ${packageId}`);
        });

        saveData(data);

        console.log(`📊 Bot added ${added} keys, skipped ${skipped}, failed ${failed}`);
        res.json({
            success: true,
            added: added,
            skipped: skipped,
            failed: failed,
            results: results
        });
    } catch (e) {
        console.error('Error /api/bot/addkeys:', e);
        res.json({ success: false, message: e.message });
    }
});

// PAYMENT
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

// GAMES
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

// STATS
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

// REVIEWS
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
app.listen(PORT, '0.0.0.0', () => {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stock: ${total} keys`);
    console.log(`📋 Pending orders: ${(data.pendingOrders || []).length}`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
    console.log(`📦 Total orders: ${data.orders.length}\n`);
});

console.log('✅ Server + Bot ready!');
