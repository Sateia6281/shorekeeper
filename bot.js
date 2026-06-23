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
    generateOrderId
} = require('./database');

// 🔥 GANTI INI!
const BOT_TOKEN = '8950107483:AAE-GLbaL0SgsT9nzvh-LZCPPXw0vAVZ_yM';
const ADMIN_ID = '6284402885';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

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
    text += '   /stok - Cek stok key\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah key manual\n';
        text += '   /addkeys - Tambah banyak key sekaligus\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /pkg - Daftar paket\n';
    }
    
    text += '\n❓ /help - Bantuan';
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
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
    text += '   /stok - Cek stok key\n\n';
    
    if (isAdmin) {
        text += '🔑 **ADMIN:**\n';
        text += '   /addkey [paket] [key] - Tambah key\n';
        text += '   /addkeys - Tambah banyak key\n';
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
    text += 'Contoh: /order 1HARI';
    
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
        
        bot.sendMessage(chatId,
            `✅ **ORDER BERHASIL!**\n─────────────────\n\n` +
            `🔑 **KEY:** \`${key}\`\n` +
            `📦 Paket: ${pkg.name}\n` +
            `💰 Harga: Rp ${pkg.price.toLocaleString()}\n` +
            `🆔 Order ID: \`${orderId}\`\n\n` +
            `📌 Simpan Order ID untuk cek nanti:\n/cek ${orderId}`,
            { parse_mode: 'Markdown' }
        );
        
        // Notifikasi ke admin
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
    
    const packageId = match[1].trim().toUpperCase();
    const key = match[2].trim().toUpperCase();
    
    const pkg = PKG_LIST.find(p => p.id === packageId);
    if (!pkg) {
        bot.sendMessage(chatId, 
            `❌ Paket *${packageId}* tidak ditemukan!\n📋 Paket: 2Jam, 5Jam, 1Day, 3Day, 7Day, 14Day, 30Day, 60Day`,
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
    
    const success = addKey(packageId, key);
    
    if (success) {
        bot.sendMessage(chatId,
            `✅ **KEY BERHASIL DITAMBAHKAN!**\n─────────────────\n\n` +
            `🔑 \`${key}\`\n` +
            `📦 ${pkg.name}\n` +
            `📊 Stok ${pkg.name}: ${getStockCount(packageId)} key`,
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
// 🔴 COMMAND: /addkeys (ADMIN ONLY - TAMBAH BANYAK KEY!)
// ============================================================
const userStates = new Map();

bot.onText(/\/addkeys/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    bot.sendMessage(chatId,
        '📝 **TAMBAH BANYAK KEY SEKALIGUS**\n─────────────────\n\n' +
        'Kirim daftar key dengan format:\n' +
        '`PAKET|KEY`\n\n' +
        'Contoh:\n' +
        '`1Day|BS-ABC123`\n' +
        '`7Day|BS-DEF456`\n' +
        '`60Day|BS-GHI789`\n\n' +
        '📌 Kirim dalam 1 pesan, bisa banyak baris!\n' +
        '📌 Paket: 2Jam, 5Jam, 1Day, 3Day, 7Day, 14Day, 30Day, 60Day',
        { parse_mode: 'Markdown' }
    );
    
    userStates.set(chatId, { step: 'waiting_keys' });
});

// ============================================================
// HANDLE PESAN DARI USER (BUAT ADDKEYS)
// ============================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    
    const state = userStates.get(chatId);
    if (state && state.step === 'waiting_keys') {
        
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        let added = 0;
        let failed = 0;
        let results = [];
        
        const packageMap = {
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
            '60 DAYS': '60Day'
        };
        
        for (const line of lines) {
            const trimmed = line.trim();
            const parts = trimmed.split('|').map(s => s.trim());
            if (parts.length === 2) {
                const packageRaw = parts[0].toUpperCase();
                const key = parts[1].toUpperCase();
                
                let packageId = packageMap[packageRaw];
                if (!packageId) {
                    const found = PKG_LIST.find(p => 
                        packageRaw.includes(p.id) || 
                        p.id.includes(packageRaw)
                    );
                    if (found) packageId = found.id;
                }
                
                if (!packageId) {
                    failed++;
                    results.push(`❌ Paket tidak dikenal: ${packageRaw}`);
                    continue;
                }
                
                if (!key.startsWith('BS-')) {
                    failed++;
                    results.push(`❌ ${key} - Format salah (harus BS-...)`);
                    continue;
                }
                
                const success = addKey(packageId, key);
                if (success) {
                    added++;
                    const pkg = PKG_LIST.find(p => p.id === packageId);
                    results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                } else {
                    failed++;
                    results.push(`⚠️ ${key} - Sudah ada di stok`);
                }
            } else {
                // Coba format: BS-XXX 0/1 7HARI
                const match = trimmed.match(/^(BS-[A-Z0-9-]+)\s+[01]\/[0-9]+\s+([A-Z0-9 ]+)$/i);
                if (match) {
                    const key = match[1].toUpperCase();
                    const packageRaw = match[2].toUpperCase().trim();
                    
                    let packageId = packageMap[packageRaw];
                    if (!packageId) {
                        const found = PKG_LIST.find(p => 
                            packageRaw.includes(p.id) || 
                            p.id.includes(packageRaw)
                        );
                        if (found) packageId = found.id;
                    }
                    
                    if (!packageId) {
                        failed++;
                        results.push(`❌ Paket tidak dikenal: ${packageRaw}`);
                        continue;
                    }
                    
                    const success = addKey(packageId, key);
                    if (success) {
                        added++;
                        const pkg = PKG_LIST.find(p => p.id === packageId);
                        results.push(`✅ ${key} → ${pkg ? pkg.name : packageId}`);
                    } else {
                        failed++;
                        results.push(`⚠️ ${key} - Sudah ada di stok`);
                    }
                } else {
                    failed++;
                    results.push(`❌ Format salah: ${trimmed}`);
                }
            }
        }
        
        let reply = '📊 **HASIL TAMBAH KEY**\n─────────────────\n\n';
        reply += `✅ Berhasil: ${added}\n`;
        reply += `❌ Gagal: ${failed}\n\n`;
        reply += '📋 **DETAIL:**\n';
        reply += results.slice(0, 20).join('\n');
        
        if (results.length > 20) {
            reply += `\n\n... dan ${results.length - 20} lainnya`;
        }
        
        bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
        userStates.delete(chatId);
    }
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
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

console.log('✅ Bot ready!');
console.log('🛒 Pembeli: /buy, /order, /cek, /stok');
console.log('🔑 Admin: /addkey, /addkeys, /orders, /stats');