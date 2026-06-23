const TelegramBot = require('node-telegram-bot-api');
const { generateKeyAtKruncpoint } = require('./kruncpoint');
const { 
    data,
    getStockCount, 
    getTotalStock,
    getOrders,
    getPendingOrders,
    PKG_LIST
} = require('./database');

// 🔥 GANTI INI!
const BOT_TOKEN = '8950107483:AAE-GLbaL0SgsT9nzvh-LZCPPXw0vAVZ_yM';
const ADMIN_ID = '6284402885';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Bot Telegram started!');
console.log('🔗 Kode Referral: PxHzfV');

// ============================================================
// COMMAND: /start
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '👋 **SHOREKEEPER BOT**\n' +
        '─────────────────\n\n' +
        '🔑 /genkey - Generate key (bikin akun baru!)\n' +
        '📊 /stok - Cek stok key\n' +
        '📋 /orders - Lihat semua order\n' +
        '📊 /stats - Statistik\n' +
        '📦 /pkg - Lihat daftar paket\n' +
        '❓ /help - Bantuan\n\n' +
        '⚡ Setiap generate = akun baru di Kruncpoint!\n' +
        `🔗 Referral: PxHzfV`,
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
        '/genkey - Generate key (admin only)\n' +
        '/stok - Cek stok key\n' +
        '/orders - Lihat semua order (admin only)\n' +
        '/stats - Statistik (admin only)\n' +
        '/pkg - Lihat daftar paket\n' +
        '/help - Bantuan ini\n\n' +
        `🔗 Kode Referral: PxHzfV`,
        { parse_mode: 'Markdown' }
    );
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
        '🔑 **GENERATE KEY**\n' +
        '─────────────────\n' +
        'Pilih paket di bawah:\n\n' +
        '⚡ Bot akan:\n' +
        '1️⃣ Bikin akun baru di Kruncpoint\n' +
        '2️⃣ Pake referral: PxHzfV\n' +
        '3️⃣ Generate key\n' +
        '4️⃣ Kasih tau semua detail!',
        { parse_mode: 'Markdown', ...keyboard }
    );
});

// ============================================================
// CALLBACK: Handle tombol
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

        await bot.editMessageText(
            `⏳ **PROSES...**\n` +
            `─────────────────\n\n` +
            `📝 Bikin akun baru di Kruncpoint...\n` +
            `🔗 Pake referral: PxHzfV\n` +
            `🔑 Generate key...\n\n` +
            `⏳ Mohon tunggu ~10 detik.`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }
        );

        const result = await generateKeyAtKruncpoint(packageId);
        
        if (result.success) {
            const pkg = PKG_LIST.find(p => p.id === packageId);
            const pkgName = pkg ? pkg.name : packageId;
            
            await bot.editMessageText(
                `✅ **SEMUA BERHASIL!**\n` +
                `─────────────────\n\n` +
                `🔑 **KEY:** \`${result.key}\`\n` +
                `📦 Paket: ${pkgName}\n\n` +
                `👤 **AKUN BARU:**\n` +
                `   Username: \`${result.account.username}\`\n` +
                `   Password: \`${result.account.password}\`\n` +
                `   Email: \`${result.account.email}\`\n` +
                `   Referral: \`${result.account.referral}\`\n\n` +
                `🔗 Login: https://krunchpoint.x10.mx/login\n\n` +
                `💡 Key sudah masuk database lokal!\n` +
                `📊 Stok ${pkgName}: ${getStockCount(packageId)} key`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Salin Key', callback_data: `copy_${result.key}` }],
                            [{ text: '📋 Salin Akun', callback_data: `copy_account_${result.account.username}|${result.account.password}|${result.account.email}` }],
                            [{ text: '🔄 Generate Lagi', callback_data: 'genkey_again' }]
                        ]
                    }
                }
            );
        } else {
            await bot.editMessageText(
                `❌ **GAGAL!**\n` +
                `─────────────────\n\n` +
                `⚠️ Error: ${result.error || 'Unknown error'}\n\n` +
                `🔄 Coba lagi nanti.`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        }
    }

    // Copy account
    if (dataCb.startsWith('copy_account_')) {
        const data = dataCb.replace('copy_account_', '');
        const parts = data.split('|');
        if (parts.length === 3) {
            const text = `👤 Username: ${parts[0]}\n🔑 Password: ${parts[1]}\n📧 Email: ${parts[2]}`;
            await bot.sendMessage(chatId, 
                `📋 **AKUN:**\n\`\`\`\n${text}\n\`\`\``,
                { parse_mode: 'Markdown' }
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
            '🔑 **PILIH PAKET LAGI:**\n\n' +
            '⚡ Setiap generate = akun baru + referral PxHzfV',
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
console.log('   /start, /genkey, /stok, /orders, /stats, /pkg, /help');
console.log('⚡ Setiap generate = AKUN BARU + REFERRAL PxHzfV!');
console.log('⚡ SSL Certificate: DISABLED (bypass expired cert)');