const TelegramBot = require('node-telegram-bot-api');
const { 
    generateKeyAtKruncpoint, 
    checkLogin, 
    loginToKruncpoint,
    getCookieInfo 
} = require('./kruncpoint');
const { 
    data,
    getStockCount, 
    getTotalStock,
    getOrders,
    getPendingOrders,
    PKG_LIST,
    addKey,
    getOrderById
} = require('./database');

// 🔥 GANTI INI!
const BOT_TOKEN = '8950107483:AAE-GLbaL0SgsT9nzvh-LZCPPXw0vAVZ_yM';
const ADMIN_ID = '6284402885';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Bot Telegram started!');

// ============================================================
// COMMAND: /start
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '👋 **SHOREKEEPER BOT**\n' +
        '─────────────────\n\n' +
        '🔑 /login - Login ke Kruncpoint\n' +
        '🔑 /genkey - Generate key di Kruncpoint\n' +
        '📊 /stok - Cek stok key\n' +
        '📋 /orders - Lihat semua order\n' +
        '📊 /stats - Statistik\n' +
        '📦 /pkg - Lihat daftar paket\n' +
        '✅ /check - Cek status login\n' +
        '❓ /help - Bantuan',
        { parse_mode: 'Markdown' }
    );
});

// ============================================================
// COMMAND: /help
// ============================================================
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '❓ **BANTUAN**\n' +
        '─────────────────\n\n' +
        '/start - Menu utama\n' +
        '/login - Login ke Kruncpoint (admin only)\n' +
        '/genkey - Generate key baru (admin only)\n' +
        '/stok - Cek stok key\n' +
        '/orders - Lihat semua order (admin only)\n' +
        '/stats - Statistik (admin only)\n' +
        '/pkg - Lihat daftar paket\n' +
        '/check - Cek status login Kruncpoint\n' +
        '/help - Bantuan ini',
        { parse_mode: 'Markdown' }
    );
});

// ============================================================
// COMMAND: /login
// ============================================================
bot.onText(/\/login/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }
    
    await bot.sendMessage(chatId, '⏳ Login ke Kruncpoint...');
    
    const cookie = await loginToKruncpoint();
    
    if (cookie) {
        bot.sendMessage(chatId,
            '✅ **LOGIN BERHASIL!**\n' +
            '─────────────────\n\n' +
            `🍪 Cookie: \`${cookie.substring(0, 50)}...\`\n\n` +
            '💡 Bot sekarang bisa generate key di Kruncpoint!',
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            '❌ **LOGIN GAGAL!**\n' +
            '─────────────────\n\n' +
            '⚠️ Cek:\n' +
            '• Username/password benar?\n' +
            '• Ada captcha?\n' +
            '• Website Kruncpoint bisa diakses?',
            { parse_mode: 'Markdown' }
        );
    }
});

// ============================================================
// COMMAND: /check - Cek status login
// ============================================================
bot.onText(/\/check/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, '⏳ Mengecek status login...');
    
    const info = await getCookieInfo();
    
    if (info.valid) {
        bot.sendMessage(chatId, 
            '✅ **LOGIN VALID!**\n' +
            '─────────────────\n\n' +
            `🍪 Cookie: \`${info.cookie.substring(0, 50)}...\`\n` +
            `⏰ Expiry: ${info.expiry}\n\n` +
            '💡 Bot bisa generate key di Kruncpoint.',
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId,
            '❌ **BELUM LOGIN / EXPIRED!**\n' +
            '─────────────────\n\n' +
            '⚠️ Ketik /login dulu ya!',
            { parse_mode: 'Markdown' }
        );
    }
});

// ============================================================
// COMMAND: /genkey (Admin Only)
// ============================================================
bot.onText(/\/genkey/, (msg) => {
    const chatId = msg.chat.id;
    
    if (String(chatId) !== String(ADMIN_ID)) {
        bot.sendMessage(chatId, '⛔ Hanya admin yang bisa generate key!');
        return;
    }

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '1 JAM', callback_data: 'kp_1JAM' }],
                [{ text: '5 JAM', callback_data: 'kp_5JAM' }],
                [{ text: '1 HARI', callback_data: 'kp_1DAY' }],
                [{ text: '3 HARI', callback_data: 'kp_3DAY' }],
                [{ text: '⭐ 7 HARI', callback_data: 'kp_7DAY' }],
                [{ text: '15 HARI', callback_data: 'kp_15DAY' }],
                [{ text: '30 HARI', callback_data: 'kp_30DAY' }],
                [{ text: '👑 LIFETIME', callback_data: 'kp_Lifetime' }],
                [{ text: '❌ BATAL', callback_data: 'kp_cancel' }]
            ]
        }
    };

    bot.sendMessage(chatId,
        '🔑 **GENERATE KEY DI KRUNCPOINT**\n' +
        '─────────────────\n' +
        'Pilih paket di bawah:\n' +
        '⚠️ Key akan otomatis masuk ke database lokal juga!',
        { parse_mode: 'Markdown', ...keyboard }
    );
});

// ============================================================
// CALLBACK: Handle tombol genkey
// ============================================================
bot.on('callback_query', async (callback) => {
    const chatId = callback.message.chat.id;
    const dataCb = callback.data;
    const messageId = callback.message.message_id;
    
    await bot.answerCallbackQuery(callback.id);
    
    if (dataCb.startsWith('kp_')) {
        const packageId = dataCb.replace('kp_', '');
        
        if (packageId === 'cancel') {
            await bot.editMessageText('❌ Dibatalkan.', {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        // Cek login dulu
        const isLoggedIn = await checkLogin();
        if (!isLoggedIn) {
            await bot.editMessageText(
                '❌ **BELUM LOGIN KE KRUNCPOINT!**\n' +
                '─────────────────\n\n' +
                '⚠️ Ketik /login dulu ya!',
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            return;
        }

        await bot.editMessageText(
            `⏳ Generate key untuk **${packageId}** di Kruncpoint...\n` +
            `Mohon tunggu ~5 detik.`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );

        const key = await generateKeyAtKruncpoint(packageId);
        
        if (key) {
            const pkg = PKG_LIST.find(p => p.id === packageId);
            const pkgName = pkg ? pkg.name : packageId;
            
            await bot.editMessageText(
                `✅ **KEY BERHASIL!**\n` +
                `─────────────────\n\n` +
                `🔑 \`${key}\`\n` +
                `📦 ${pkgName}\n` +
                `🌐 Sumber: Kruncpoint\n\n` +
                `💡 Key sudah terdaftar di:\n` +
                `• Kruncpoint ✅\n` +
                `• Database lokal ✅\n\n` +
                `📊 Stok ${pkgName}: ${getStockCount(packageId)} key`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Salin Key', callback_data: `copy_${key}` }],
                            [{ text: '🔄 Generate Lagi', callback_data: 'genkey_again' }]
                        ]
                    }
                }
            );
        } else {
            await bot.editMessageText(
                `❌ **GAGAL GENERATE KEY!**\n` +
                `─────────────────\n\n` +
                `⚠️ Kemungkinan:\n` +
                `• Belum login (ketik /login)\n` +
                `• Cookie expired (ketik /login)\n` +
                `• Website Kruncpoint down\n\n` +
                `🔄 Coba /login dulu ya!`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        }
    }

    // Copy key
    if (dataCb.startsWith('copy_')) {
        const key = dataCb.replace('copy_', '');
        await bot.sendMessage(chatId, 
            `📋 **Key:** \`${key}\``,
            { parse_mode: 'Markdown' }
        );
    }

    // Generate lagi
    if (dataCb === 'genkey_again') {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1 JAM', callback_data: 'kp_1JAM' }],
                    [{ text: '5 JAM', callback_data: 'kp_5JAM' }],
                    [{ text: '1 HARI', callback_data: 'kp_1DAY' }],
                    [{ text: '3 HARI', callback_data: 'kp_3DAY' }],
                    [{ text: '⭐ 7 HARI', callback_data: 'kp_7DAY' }],
                    [{ text: '15 HARI', callback_data: 'kp_15DAY' }],
                    [{ text: '30 HARI', callback_data: 'kp_30DAY' }],
                    [{ text: '👑 LIFETIME', callback_data: 'kp_Lifetime' }],
                    [{ text: '❌ BATAL', callback_data: 'kp_cancel' }]
                ]
            }
        };
        await bot.sendMessage(chatId,
            '🔑 **PILIH PAKET LAGI:**',
            { parse_mode: 'Markdown', ...keyboard }
        );
    }
});

// ============================================================
// COMMAND: /stok
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
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /orders (Admin Only)
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
    
    if (pending.length > 0) {
        text += `⏳ **PENDING (${pending.length})**\n`;
        pending.slice(-5).forEach(o => {
            text += `• ${o.orderId} - ${o.package} (${o.price})\n`;
        });
        text += '\n';
    }
    
    if (orders.length > 0) {
        text += `✅ **SUKSES (${orders.length})**\n`;
        orders.slice(-5).forEach(o => {
            text += `• ${o.orderId} - ${o.package}\n`;
        });
    }
    
    text += `\n─────────────────\n📌 Total: ${orders.length + pending.length} order`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// COMMAND: /stats (Admin Only)
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
// COMMAND: /pkg
// ============================================================
bot.onText(/\/pkg/, (msg) => {
    const chatId = msg.chat.id;
    
    let text = '📦 **DAFTAR PAKET**\n─────────────────\n\n';
    
    PKG_LIST.forEach(pkg => {
        text += `📌 ${pkg.name}\n`;
        text += `   💰 Rp ${pkg.price.toLocaleString()}\n`;
        text += `   📊 Stok: ${getStockCount(pkg.id)}\n\n`;
    });
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

console.log('✅ Bot ready! Commands:');
console.log('   /start, /login, /genkey, /stok, /orders, /stats, /pkg, /check, /help');