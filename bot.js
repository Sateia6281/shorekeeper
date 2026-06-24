const TelegramBot = require('node-telegram-bot-api');
const { 
    data,
    getStockCount, 
    getTotalStock,
    getOrders,
    getPendingOrders,
    getOrderById,
    PKG_LIST,
    addKey,
    reserveKey,
    addOrder,
    generateOrderId,
    approveOrder,
    rejectOrder
} = require('./database');

// 🔥 GANTI INI!
const BOT_TOKEN = '8950107483:AAGdp4njIQSCmesk5-22p1bRODNMm6YqIaw';
const ADMIN_ID = '6284402885';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ============================================================
// STATE UNTUK ADDKEYS
// ============================================================
const userStates = new Map();

// ============================================================
// TRIGGER UPDATE WEBSITE - REAL TIME!
// ============================================================
const WEB_URL = 'https://shorekeeper-skcheat.up.railway.app';

async function triggerWebUpdate() {
    try {
        await fetch(`${WEB_URL}/api/trigger-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update' })
        });
        console.log('📡 Website triggered update!');
    } catch (e) {
        console.log('Trigger error:', e.message);
    }
}

console.log('🤖 Bot started!');
console.log('📌 BOT TIDAK BISA GENERATE KEY!');
console.log('📌 Kamu kirim key manual ke bot!');
console.log('⚡ Real-time update ke website!');

// ============================================================
// COMMAND: /start
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '👋 **SHOREKEEPER BOT**\n─────────────────\n\n';
    text += '🛒 **PEMBELI:**\n';
    text += '   /buy - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key (semua paket)\n';
        text += '   /addfreekey [key] - Tambah 1 key gratis\n';
        text += '   /addfreekeys - Tambah banyak key gratis\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /pkg - Daftar paket\n';
    }
    
    text += '\n❓ /help - Bantuan';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /payment (PUBLIC)
// ============================================================
bot.onText(/\/payment/, async (msg) => {
    const chatId = msg.chat.id;
    
    let text = '💳 **METODE PEMBAYARAN**\n─────────────────\n\n';
    text += '💰 **QRIS:**\n';
    text += '   Scan QRIS di website atau minta ke admin\n';
    text += '   📱 https://shorekeeper-skcheat.up.railway.app\n\n';
    text += '💰 **DANA / OVO / GOPAY:**\n';
    text += '   📞 0895401347006\n';
    text += '   👤 A/N SHOREKEEPER\n\n';
    text += '💰 **GIFT CARD:**\n';
    text += '   Kirim ke @Zelewin atau @Yuangme\n';
    text += '   (Google Play / App Store / Steam)\n\n';
    text += '👤 **ADMIN:**\n';
    text += '   @Zelewin\n';
    text += '   @Yuangme\n\n';
    text += '📌 Setelah transfer, kirim bukti ke admin!';
    
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
// COMMAND: /help
// ============================================================
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);
    
    let text = '❓ **BANTUAN**\n─────────────────\n\n';
    text += '🛒 **PEMBELI:**\n';
    text += '   /buy - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '      Contoh: /order 1HARI\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key (semua paket)\n';
        text += '   /addfreekey [key] - Tambah 1 key gratis\n';
        text += '   /addfreekeys - Tambah banyak key gratis\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /pkg - Daftar paket\n';
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /buy (PUBLIC)
// ============================================================
bot.onText(/\/buy/, (msg) => {
    const chatId = msg.chat.id;
    
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
    text += 'Contoh: /order 1HARI\n';
    text += '💳 /payment - Lihat cara bayar';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /order (PUBLIC)
// ============================================================
bot.onText(/\/order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';
    const packageInput = match[1].trim().toUpperCase();
    
    let pkg = PKG_LIST.find(p => p.id === packageInput);
    if (!pkg) {
        pkg = PKG_LIST.find(p => p.name === packageInput || p.name.includes(packageInput));
    }
    
    if (!pkg) {
        bot.sendMessage(chatId, 
            `❌ Paket *${packageInput}* tidak ditemukan!\n📋 /buy - Lihat daftar paket`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const stock = getStockCount(pkg.id);
    if (stock === 0) {
        bot.sendMessage(chatId, 
            `❌ Maaf, stok *${pkg.name}* habis!\n📊 /stok - Cek stok lain`,
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
            bot.sendMessage(chatId, '❌ Stok habis! Coba paket lain.');
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
        
        // 🔥 TRIGGER UPDATE WEBSITE
        triggerWebUpdate();
        
        const paymentInfo = 
            `\n\n💳 **CARA BAYAR:**\n` +
            `   QRIS: https://shorekeeper-skcheat.up.railway.app\n` +
            `   DANA/OVO: 0895401347006\n` +
            `   Kirim bukti ke @Zelewin atau @Yuangme`;
        
        bot.sendMessage(chatId,
            `✅ **ORDER BERHASIL!**\n─────────────────\n\n` +
            `🔑 **KEY:** \`${key}\`\n` +
            `📦 Paket: ${pkg.name}\n` +
            `💰 Harga: Rp ${pkg.price.toLocaleString()}\n` +
            `🆔 Order ID: \`${orderId}\`\n\n` +
            `📌 Simpan Order ID untuk cek nanti:\n/cek ${orderId}` +
            paymentInfo,
            { parse_mode: 'Markdown' }
        );
        
        const adminNotif = 
            `🛒 **ORDER BARU!**\n─────────────────\n\n` +
            `👤 ${username} (ID: ${userId})\n` +
            `📦 ${pkg.name}\n` +
            `💰 Rp ${pkg.price.toLocaleString()}\n` +
            `🔑 \`${key}\`\n` +
            `🆔 ${orderId}`;
        
        bot.sendMessage(ADMIN_ID, adminNotif, { parse_mode: 'Markdown' });
        
    } catch (error) {
        console.error('Error order:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
});

// ============================================================
// COMMAND: /cek (PUBLIC)
// ============================================================
bot.onText(/\/cek (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();
    
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
        text += `\n\n💡 Key sudah aktif!`;
    }
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /stok (PUBLIC)
// ============================================================
bot.onText(/\/stok/, (msg) => {
    const chatId = msg.chat.id;
    
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
    text += `\n\n🛒 /buy - Lihat paket & order`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// 🔴 COMMAND: /addkey (ADMIN ONLY)
// ============================================================
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
    
    if (success) {
        // 🔥 TRIGGER UPDATE WEBSITE
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

// ============================================================
// 🔴 COMMAND: /addkeys (ADMIN ONLY)
// ============================================================
bot.onText(/\/addkeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    bot.sendMessage(chatId,
        '📝 **TAMBAH BANYAK KEY SEKALIGUS**\n─────────────────\n\n' +
        'Kirim daftar key (support semua format!):\n\n' +
        '📌 Format 1 (dari panel):\n' +
        '`1313  BS  BS-ADF0P1TT  0/1  1 Day  (not started yet)`\n\n' +
        '📌 Format 2:\n' +
        '`BS-ABC123 0/1 1HARI`\n\n' +
        '📌 Format 3:\n' +
        '`1Day|BS-ABC123`\n\n' +
        '📌 Kirim dalam 1 pesan, bisa banyak baris!\n' +
        '📌 Paket: 2Jam, 5Jam, 1Day, 3Day, 7Day, 14Day, 30Day, 60Day',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_keys' });
});

// ============================================================
// 🔴 COMMAND: /addfreekey (ADMIN ONLY)
// ============================================================
bot.onText(/\/addfreekey (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    const key = match[1].trim().toUpperCase();
    
    if (!key.startsWith('BS-')) {
        bot.sendMessage(chatId, 
            `❌ Format key salah! Harus diawali *BS-*\nContoh: BS-ABC123XYZ`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const success = addKey('Free1Day', key);
    
    if (success) {
        // 🔥 TRIGGER UPDATE WEBSITE
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

// ============================================================
// 🔴 COMMAND: /addfreekeys (ADMIN ONLY)
// ============================================================
bot.onText(/\/addfreekeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    bot.sendMessage(chatId,
        '🎁 **TAMBAH BANYAK KEY GRATIS**\n─────────────────\n\n' +
        'Kirim daftar key gratis:\n\n' +
        '📌 Format 1:\n' +
        '`BS-ABC123`\n\n' +
        '📌 Format 2:\n' +
        '`BS-ABC123 0/1 FREE`\n\n' +
        '📌 Kirim dalam 1 pesan, bisa banyak baris!\n' +
        '📌 Semua key akan masuk ke stok FREE 1 HARI',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_free_keys' });
});

// ============================================================
// 🔴 COMMAND: /orders (ADMIN ONLY)
// ============================================================
bot.onText(/\/orders/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
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

// ============================================================
// 🔴 COMMAND: /stats (ADMIN ONLY)
// ============================================================
bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
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

// ============================================================
// 🔴 COMMAND: /pkg (ADMIN ONLY)
// ============================================================
bot.onText(/\/pkg/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
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
// CALLBACK: SETUJU / TOLAK ORDER DARI BUKTI
// ============================================================
bot.on('callback_query', async (callback) => {
    const chatId = callback.message.chat.id;
    const data = callback.data;
    const messageId = callback.message.message_id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        await bot.answerCallbackQuery(callback.id, { text: '⛔ Hanya admin!', show_alert: true });
        return;
    }
    
    await bot.answerCallbackQuery(callback.id);
    
    if (data.startsWith('approve_')) {
        const orderId = data.replace('approve_', '');
        
        const order = getOrderById(orderId);
        if (!order) {
            await bot.editMessageText(`❌ Order ${orderId} tidak ditemukan!`, {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const approved = approveOrder(orderId);
        if (approved) {
            // 🔥 TRIGGER UPDATE WEBSITE
            triggerWebUpdate();
            
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
        
        const order = getOrderById(orderId);
        if (!order) {
            await bot.editMessageText(`❌ Order ${orderId} tidak ditemukan!`, {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }
        
        const rejected = rejectOrder(orderId);
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
    
    // ============================================================
    // HANDLE /addkeys
    // ============================================================
    if (state.step === 'waiting_keys') {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        let added = 0;
        let skipped = 0;
        let failed = 0;
        let results = [];
        
        const packageMap = {
            '1JAM': '2Jam',
            '2JAM': '2Jam',
            '5JAM': '5Jam',
            '1HARI': '1Day',
            '1 DAY': '1Day',
            '3HARI': '3Day',
            '3 DAYS': '3Day',
            '7HARI': '7Day',
            '7 DAYS': '7Day',
            '14HARI': '14Day',
            '14 DAYS': '14Day',
            '30HARI': '30Day',
            '30 DAYS': '30Day',
            '60HARI': '60Day',
            '60 DAYS': '60Day',
            'LIFETIME': 'Lifetime'
        };
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // FORMAT 1: 1313  BS  BS-ADF0P1TT  0/1  1 Day
            const match1 = trimmed.match(/^\d+\s+BS\s+(BS-[A-Z0-9-]+)\s+([01]\/[0-9]+)\s+([\d]+\s+(?:Day|Days|Hari|JAM|Jam))/i);
            if (match1) {
                const key = match1[1].toUpperCase();
                const status = match1[2];
                const packageRaw = match1[3].trim();
                
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
                    let pkgId = packageMap[packageRaw.toUpperCase().replace(/\s+/g, '')];
                    if (!pkgId) {
                        const found = PKG_LIST.find(p => 
                            packageRaw.toUpperCase().includes(p.id.toUpperCase()) || 
                            p.id.toUpperCase().includes(packageRaw.toUpperCase())
                        );
                        if (found) pkgId = found.id;
                    }
                    if (!pkgId) {
                        failed++;
                        results.push(`❌ ${key} - Paket tidak dikenal: ${packageRaw}`);
                        continue;
                    }
                    packageId = pkgId;
                }
                
                const success = addKey(packageId, key);
                if (success) {
                    added++;
                    triggerWebUpdate();  // 🔥 TRIGGER UPDATE
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            // FORMAT 2: BS-ABC123 0/1 1HARI
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
                if (success) {
                    added++;
                    triggerWebUpdate();  // 🔥 TRIGGER UPDATE
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            // FORMAT 3: PAKET|KEY
            const match3 = trimmed.match(/^(.+)\|(BS-[A-Z0-9-]+)$/i);
            if (match3) {
                const packageRaw = match3[1].trim().toUpperCase();
                const key = match3[2].trim().toUpperCase();
                
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
                if (success) {
                    added++;
                    triggerWebUpdate();  // 🔥 TRIGGER UPDATE
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
                continue;
            }
            
            failed++;
            results.push(`❌ Format salah: ${trimmed.substring(0, 50)}...`);
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
    
    // ============================================================
    // HANDLE /addfreekeys
    // ============================================================
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
                if (success) {
                    added++;
                    triggerWebUpdate();  // 🔥 TRIGGER UPDATE
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

console.log('✅ Bot ready!');
console.log('🛒 Pembeli: /buy, /order, /cek, /stok, /payment');
console.log('🔑 Admin: /addkey, /addkeys, /addfreekey, /addfreekeys, /orders, /stats');
console.log('❌ BOT TIDAK BISA GENERATE KEY!');
console.log('⚡ Real-time update ke website!');