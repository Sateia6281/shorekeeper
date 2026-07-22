const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const FormData = require('form-data');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = '8950107483:AAGtvDaNSXEA-fULAPn86B6r5jCEn2fEM-A';
const ADMIN_ID = '6284402885';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// ============================================================
// DATABASE FUNCTIONS — PAKAI MySQL
// ============================================================

// AMBIL STOK
async function getStockCount(packageId) {
    const [rows] = await db.query(
        `SELECT COUNT(*) as count 
         FROM keys_code 
         WHERE game = ? 
           AND status = 1 
           AND (expired_date IS NULL OR expired_date > NOW())`,
        [packageId]
    );
    return rows[0].count;
}

// RESERVE KEY
async function reserveKey(packageId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT user_key, duration, expired_date 
             FROM keys_code 
             WHERE game = ? 
               AND status = 1 
               AND (expired_date IS NULL OR expired_date > NOW())
             LIMIT 1`,
            [packageId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return null;
        }

        const key = rows[0].user_key;

        await conn.query(
            `UPDATE keys_code SET status = 0 WHERE user_key = ?`,
            [key]
        );

        await conn.commit();
        return key;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

// TAMBAH ORDER
async function addPendingOrder(order) {
    await db.query(
        `INSERT INTO pending_orders 
         (order_id, package, package_id, key_code, price, price_number, 
          email, phone, username, status, created_at, proof_image, user_chat_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            order.orderId, order.package, order.packageId, order.key,
            order.price, order.priceNumber, order.email, order.phone,
            order.username, order.status, order.createdAt,
            order.proofImage, order.userChatId
        ]
    );
}

// CEK ORDER
async function getOrderById(orderId) {
    const [rows] = await db.query(
        `SELECT * FROM pending_orders WHERE order_id = ? 
         UNION 
         SELECT * FROM orders WHERE order_id = ?`,
        [orderId, orderId]
    );
    return rows[0] || null;
}

// APPROVE ORDER
async function approveOrder(orderId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM pending_orders WHERE order_id = ?`,
            [orderId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return null;
        }

        const order = rows[0];

        await conn.query(
            `INSERT INTO orders 
             (order_id, package, package_id, key_code, price, price_number,
              email, phone, username, status, created_at, confirmed_at, 
              proof_image, user_chat_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW(), ?, ?)`,
            [
                order.order_id, order.package, order.package_id, order.key_code,
                order.price, order.price_number, order.email, order.phone,
                order.username, order.created_at, order.proof_image,
                order.user_chat_id
            ]
        );

        await conn.query(
            `DELETE FROM pending_orders WHERE order_id = ?`,
            [orderId]
        );

        await conn.commit();
        return order;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

// REJECT ORDER
async function rejectOrder(orderId) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM pending_orders WHERE order_id = ?`,
            [orderId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return null;
        }

        const order = rows[0];

        // Kembalikan key ke stok
        if (order.key_code) {
            await conn.query(
                `UPDATE keys_code SET status = 1 WHERE user_key = ?`,
                [order.key_code]
            );
        }

        await conn.query(
            `DELETE FROM pending_orders WHERE order_id = ?`,
            [orderId]
        );

        await conn.commit();
        return order;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

// GET TOTAL STOCK
async function getTotalStock() {
    const [rows] = await db.query(
        `SELECT COUNT(*) as total 
         FROM keys_code 
         WHERE status = 1 
           AND (expired_date IS NULL OR expired_date > NOW())`
    );
    return rows[0].total;
}

// ============================================================
// ENDPOINT STOCK
// ============================================================
app.get('/api/stock', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT game, COUNT(*) as count 
             FROM keys_code 
             WHERE status = 1 
               AND (expired_date IS NULL OR expired_date > NOW())
             GROUP BY game`
        );

        const stock = {
            '2Jam': 0,
            '5Jam': 0,
            '1Day': 0,
            '3Day': 0,
            '7Day': 0,
            '14Day': 0,
            '30Day': 0,
            '60Day': 0,
            'Free1Day': 0
        };

        rows.forEach(row => {
            if (stock[row.game] !== undefined) {
                stock[row.game] = row.count;
            }
        });

        const [orderRows] = await db.query(`SELECT COUNT(*) as total FROM orders`);
        const [pendingRows] = await db.query(`SELECT COUNT(*) as pending FROM pending_orders`);

        res.json({
            stock: stock,
            total: await getTotalStock(),
            totalSold: orderRows[0].total || 0,
            pending: pendingRows[0].pending || 0
        });
    } catch (e) {
        console.error('Error /api/stock:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// ENDPOINT ORDER CREATE
// ============================================================
app.post('/api/order/create', async (req, res) => {
    try {
        const { packageId, email, phone, method, proofImage, userChatId, username } = req.body;

        if (!packageId || !email || !phone) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Mapping package
        const packageMap = {
            '2JAM': '2Jam',
            '5JAM': '5Jam',
            '1HARI': '1Day',
            '1DAY': '1Day',
            '3HARI': '3Day',
            '3DAY': '3Day',
            '7HARI': '7Day',
            '7DAY': '7Day',
            '14HARI': '14Day',
            '14DAY': '14Day',
            '30HARI': '30Day',
            '30DAY': '30Day',
            '60HARI': '60Day',
            '60DAY': '60Day'
        };

        const normalizedPkgId = packageMap[packageId.toUpperCase().replace(/\s+/g, '')] || packageId;

        // Ambil key dari database
        const key = await reserveKey(normalizedPkgId);
        if (!key) {
            return res.status(400).json({ success: false, message: 'Stock is empty!' });
        }

        const orderId = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

        // Dapatkan nama package dari database
        const [pkgRows] = await db.query(
            `SELECT DISTINCT game FROM keys_code WHERE game = ?`,
            [normalizedPkgId]
        );
        const packageName = pkgRows.length > 0 ? pkgRows[0].game : normalizedPkgId;

        const order = {
            orderId: orderId,
            package: packageName,
            packageId: normalizedPkgId,
            price: 'Rp 0',
            priceNumber: 0,
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

        await addPendingOrder(order);

        res.json({ success: true, orderId: orderId, status: 'pending' });

        // Kirim notifikasi ke admin
        if (proofImage) {
            sendNotificationToAdmin(
                orderId,
                packageName,
                'Rp 0',
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

// ============================================================
// ENDPOINT CEK ORDER
// ============================================================
app.get('/api/order/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await getOrderById(orderId);

        if (order) {
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

// ============================================================
// ENDPOINT FREE KEY
// ============================================================
app.post('/api/free/request', async (req, res) => {
    try {
        const { userId, key } = req.body;
        if (!userId || !key) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const orderId = 'FREE' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();

        await db.query(
            `INSERT INTO orders 
             (order_id, package, package_id, key_code, price, price_number, username, status, created_at)
             VALUES (?, 'GRATIS 1 HARI', 'Free1Day', ?, 'Rp 0', 0, ?, 'approved', NOW())`,
            [orderId, key, userId]
        );

        res.json({ success: true, orderId: orderId, key: key });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ============================================================
// ENDPOINT VALIDATE — UNTUK MOD
// ============================================================
app.post('/api/validate', async (req, res) => {
    try {
        const { user_key } = req.body;

        if (!user_key) {
            return res.json({ status: false, reason: 'Key tidak boleh kosong' });
        }

        const [rows] = await db.query(
            `SELECT game, duration, expired_date 
             FROM keys_code 
             WHERE user_key = ? 
               AND status = 1 
               AND (expired_date IS NULL OR expired_date > NOW())`,
            [user_key]
        );

        if (rows.length === 0) {
            return res.json({ status: false, reason: 'Key tidak valid atau sudah expired!' });
        }

        const data = rows[0];
        const now = Math.floor(Date.now() / 1000);
        const token = 'SK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();

        const expDate = data.expired_date ? new Date(data.expired_date) : new Date();
        const expStr = expDate.toISOString().split('T')[0];

        res.json({
            status: true,
            data: {
                token: token,
                rng: now,
                EXP: expStr,
                MOD_NAME: 'Shorekeeper Elite',
                MOD_STATUS: 'SAFE',
                username: 'User',
                package: data.game,
                days_left: Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24)),
                created: new Date().toISOString(),
                menu_block: false,
                floating_text: 'Shorekeeper Elite • ' + data.game,
                sig: ''
            }
        });
    } catch (e) {
        console.error('Validate error:', e);
        res.status(500).json({ status: false, reason: 'Server error' });
    }
});

// ============================================================
// ENDPOINT LAINNYA
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

app.get('/api/stats', async (req, res) => {
    try {
        const [orderRows] = await db.query(`SELECT COUNT(*) as total FROM orders`);
        const [pendingRows] = await db.query(`SELECT COUNT(*) as pending FROM pending_orders`);
        const totalStock = await getTotalStock();

        res.json({
            totalOrders: orderRows[0].total || 0,
            totalSold: orderRows[0].total || 0,
            totalStock: totalStock,
            pending: pendingRows[0].pending || 0,
            totalRevenue: 0,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/reviews', (req, res) => {
    res.json({ reviews: [] });
});

app.post('/api/reviews', (req, res) => {
    res.json({ success: true });
});

// ============================================================
// NOTIFIKASI KE ADMIN
// ============================================================
async function sendNotificationToAdmin(orderId, packageName, price, email, phone, proofImage, username) {
    try {
        const formData = new FormData();
        const imageBuffer = Buffer.from(proofImage.split(',')[1] || proofImage, 'base64');

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

        // Kirim tombol approve
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_ID,
                text: `🔑 Verify Order: ${orderId}\n\nClick button below:`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ APPROVE', callback_data: `approve_${orderId}` },
                            { text: '❌ REJECT', callback_data: `reject_${orderId}` }
                        ]
                    ]
                }
            })
        });

    } catch (e) {
        console.error('Notif error:', e.message);
    }
}

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', async () => {
    const totalStock = await getTotalStock();
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📊 Total stock: ${totalStock} keys`);
    console.log(`🌐 Web: http://localhost:${PORT}`);
});

console.log('✅ Server + Bot ready!');