const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = '8950107483:AAGtvDaNSXEA-fULAPn86B6r5jCEn2fEM-A';
const ADMIN_ID = '6284402885';
const API_URL = 'https://skcheatshop.up.railway.app/api/bot';
const API_KEY = 'SK-BOT-2024-SECURE-7X9K2M4N6P8Q';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ============================================================
// /START
// ============================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);

    let text = '╔══════════════════════════╗\n';
    text += '║   SHOREKEEPER ELITE BOT   ║\n';
    text += '╚══════════════════════════╝\n\n';

    text += '🛒 PEMBELI — Fitur Untuk Kamu\n';
    text += '─────────────────────────────\n';
    text += '   /buy   - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok  - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n';
    text += '   /apk   - Download APK\n\n';

    if (isAdmin) {
        text += '🔑 ADMIN — Fitur Khusus\n';
        text += '─────────────────────────────\n';
        text += '   /genkey [paket] - Generate 1 key\n';
        text += '   /genfree - Generate 1 key gratis\n';
        text += '   /massgen [paket] [jumlah] - Generate banyak key\n';
        text += '   /cekkey [key] - Cek detail key\n';
        text += '   /resetkey [key] - Reset devices\n';
        text += '   /delkey [key] - Delete key\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /addapk - Upload APK file\n';
        text += '   /broadcast [pesan] - Kirim pesan ke semua user\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key (kirim list)\n\n';
        text += '⚠️ ADMIN ID: ' + ADMIN_ID + '\n';
    } else {
        text += '─────────────────────────────\n';
        text += '❓ /help - Bantuan\n';
        text += '📌 Belum punya key? /buy\n';
    }

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// /HELP
// ============================================================
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(chatId) === String(ADMIN_ID);

    let text = '❓ BANTUAN\n─────────────────────────────\n\n';

    text += '🛒 PEMBELI:\n';
    text += '   /buy - Lihat paket & harga\n';
    text += '   /order [paket] - Order key\n';
    text += '      Contoh: /order 1HARI\n';
    text += '   /cek [order_id] - Cek status key\n';
    text += '   /stok - Cek stok key\n';
    text += '   /payment - Cara pembayaran\n';
    text += '   /apk - Download APK\n\n';

    if (isAdmin) {
        text += '🔑 ADMIN:\n';
        text += '   /genkey [paket] - Generate 1 key\n';
        text += '      Contoh: /genkey 1DAY\n';
        text += '   /genfree - Generate 1 key gratis\n';
        text += '   /massgen [paket] [jumlah] - Generate banyak key\n';
        text += '      Contoh: /massgen 1DAY 5\n';
        text += '   /cekkey [key] - Cek detail key\n';
        text += '   /resetkey [key] - Reset devices\n';
        text += '   /delkey [key] - Delete key\n';
        text += '   /orders - Lihat semua order\n';
        text += '   /stats - Statistik\n';
        text += '   /addapk - Upload APK file\n';
        text += '   /broadcast [pesan] - Kirim ke semua user\n';
        text += '   /addkey [paket] [key] - Tambah 1 key\n';
        text += '   /addkeys - Tambah banyak key (kirim list)\n';
    }

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// /BUY
// ============================================================
bot.onText(/\/buy/, (msg) => {
    const chatId = msg.chat.id;
    let text = '🛒 DAFTAR PAKET\n─────────────────────────────\n\n';
    text += '📌 2 JAM   - Rp 5.000\n';
    text += '📌 5 JAM   - Rp 10.000\n';
    text += '📌 1 HARI  - Rp 20.000\n';
    text += '📌 3 HARI  - Rp 50.000\n';
    text += '📌 7 HARI  - Rp 100.000\n';
    text += '📌 14 HARI - Rp 150.000\n';
    text += '📌 30 HARI - Rp 250.000\n';
    text += '📌 60 HARI - Rp 400.000\n\n';
    text += '─────────────────────────────\n';
    text += '📝 Cara order: /order [paket]\n';
    text += 'Contoh: /order 1HARI\n';
    text += '💳 /payment - Lihat cara bayar';
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// /PAYMENT
// ============================================================
bot.onText(/\/payment/, (msg) => {
    const chatId = msg.chat.id;
    let text = '💳 METODE PEMBAYARAN\n─────────────────────────────\n\n';
    text += '💰 QRIS:\n';
    text += '   Scan QRIS di website\n';
    text += '   📱 https://skcheatshop.up.railway.app\n\n';
    text += '💰 DANA / OVO / GOPAY:\n';
    text += '   📞 0895401347006\n';
    text += '   👤 A/N SHOREKEEPER\n\n';
    text += '👤 ADMIN:\n';
    text += '   @Zelewin\n';
    text += '   @Yuangme\n\n';
    text += '📌 Setelah transfer, kirim bukti ke admin!';
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// /APK
// ============================================================
bot.onText(/\/apk/, (msg) => {
    const chatId = msg.chat.id;
    let text = '📦 SHOREKEEPER ELITE APK\n─────────────────────────────\n\n';
    text += '🔗 Download APK:\n';
    text += '   https://skcheatshop.up.railway.app\n\n';
    text += '📌 Install APK, lalu masukkan key.\n';
    text += '💡 Butuh bantuan? Hubungi admin:\n';
    text += '   @Zelewin / @Yuangme';
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ============================================================
// /ORDER
// ============================================================
bot.onText(/\/order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';
    const packageInput = match[1].trim().toUpperCase();

    const packageMap = {
        '2JAM': '2JAM',
        '5JAM': '5JAM',
        '1HARI': '1DAY',
        '1DAY': '1DAY',
        '3HARI': '3DAY',
        '3DAY': '3DAY',
        '7HARI': '7DAY',
        '7DAY': '7DAY',
        '14HARI': '14DAY',
        '14DAY': '14DAY',
        '30HARI': '30DAY',
        '30DAY': '30DAY',
        '60HARI': '60DAY',
        '60DAY': '60DAY',
    };

    const packageId = packageMap[packageInput];
    if (!packageId) {
        bot.sendMessage(chatId,
            `❌ Paket ${packageInput} tidak ditemukan!\n📋 /buy - Lihat daftar paket`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    await bot.sendMessage(chatId, `⏳ Memproses order ${packageId}...`);

    try {
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                package_id: packageId,
                game: 'BS'
            })
        });

        const result = await response.json();

        if (result.success) {
            const paymentInfo =
                `\n\n💳 CARA BAYAR:\n` +
                `   QRIS: https://skcheatshop.up.railway.app\n` +
                `   DANA/OVO: 0895401347006\n` +
                `   Kirim bukti ke @Zelewin atau @Yuangme`;

            bot.sendMessage(chatId,
                `✅ ORDER BERHASIL!\n─────────────────────────────\n\n` +
                `🔑 KEY: ${result.key}\n` +
                `📦 Paket: ${result.package}\n` +
                `📅 Expired: ${result.expired}\n` +
                `🆔 Order ID: ORD-${Date.now()}\n\n` +
                `📌 Simpan key ini!` +
                paymentInfo,
                { parse_mode: 'Markdown' }
            );

            bot.sendMessage(ADMIN_ID,
                `🛒 ORDER BARU!\n─────────────────────────────\n\n` +
                `👤 ${username} (ID: ${userId})\n` +
                `📦 ${result.package}\n` +
                `🔑 ${result.key}\n` +
                `📅 Expired: ${result.expired}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal memproses order!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// /STOK
// ============================================================
bot.onText(/\/stok/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const response = await fetch(`${API_URL}/stock`, {
            headers: { 'X-API-Key': API_KEY }
        });

        const result = await response.json();

        if (!result.success) {
            bot.sendMessage(chatId, '❌ Gagal mengambil data stok!');
            return;
        }

        let text = '📊 STOK KEY\n─────────────────────────────\n\n';

        const packages = [
            { label: '2 JAM', id: '2 Hours' },
            { label: '5 JAM', id: '5 Hours' },
            { label: '1 HARI', id: '1 Day' },
            { label: '3 HARI', id: '3 Days' },
            { label: '7 HARI', id: '7 Days' },
            { label: '14 HARI', id: '14 Days' },
            { label: '30 HARI', id: '30 Days' },
            { label: '60 HARI', id: '60 Days' },
        ];

        packages.forEach(pkg => {
            const count = result.stock[pkg.id] || 0;
            text += `📦 ${pkg.label}: ${count > 0 ? `✅ ${count}` : '❌ 0'}\n`;
        });

        text += `🎁 FREE: ${result.stock.FREE > 0 ? `✅ ${result.stock.FREE}` : '❌ 0'}\n`;
        text += `\n─────────────────────────────\n`;
        text += `📦 Total: ${result.total} key`;
        text += `\n\n🛒 /buy - Lihat paket & order`;

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// /CEK
// ============================================================
bot.onText(/\/cek (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const orderId = match[1].trim();

    try {
        const response = await fetch(`${API_URL}/order/${orderId}`, {
            headers: { 'X-API-Key': API_KEY }
        });

        const result = await response.json();

        if (!result.success || !result.order) {
            bot.sendMessage(chatId,
                `❌ Order ${orderId} tidak ditemukan!`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const order = result.order;
        const isPending = order.status === 'pending' || order.status === 'pending_payment';
        const statusEmoji = isPending ? '⏳' : '✅';
        const statusText = isPending ? 'Menunggu Verifikasi' : 'Aktif';

        let text = `🔍 CEK ORDER\n─────────────────────────────\n\n`;
        text += `🆔 Order: ${order.orderId}\n`;
        text += `📦 Paket: ${order.package}\n`;
        text += `💰 Harga: ${order.price}\n`;
        text += `📊 Status: ${statusEmoji} ${statusText}\n`;

        if (!isPending && order.key) {
            text += `\n🔑 KEY: ${order.key}\n`;
        } else {
            text += `\n⏳ Key akan muncul setelah diverifikasi admin`;
        }

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============================================================
// 🔑 ADMIN COMMANDS
// ============================================================

function isAdmin(chatId) {
    return String(chatId) === String(ADMIN_ID);
}

// ===== /ADDKEY — TAMBAH 1 KEY VIA API =====
bot.onText(/\/addkey (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const packageInput = match[1].trim().toUpperCase();
    const key = match[2].trim().toUpperCase();

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
        '60DAY': '60Day',
    };

    const packageId = packageMap[packageInput];
    if (!packageId) {
        bot.sendMessage(chatId,
            `❌ Paket ${packageInput} tidak ditemukan!\n` +
            `📋 Paket: 2JAM, 5JAM, 1DAY, 3DAY, 7DAY, 14DAY, 30DAY, 60DAY`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    try {
        const response = await fetch(`${API_URL}/addkey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ packageId, key })
        });

        const result = await response.json();

        if (result.success) {
            bot.sendMessage(chatId,
                `✅ KEY ADDED!\n─────────────────────────────\n\n` +
                `🔑 ${key}\n` +
                `📦 ${packageId}\n` +
                `📊 Stok ${packageId}: ${result.stock || '?'}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal tambah key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /ADDKEYS — TAMBAH BANYAK KEY =====
bot.onText(/\/addkeys/, (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    bot.sendMessage(chatId,
        '📝 **ADD MULTIPLE KEYS**\n─────────────────────────────\n\n' +
        'Send key list (SUPPORTS PANEL FORMAT!):\n\n' +
        '📌 Panel Format:\n' +
        '`1313  BS  BS-ADF0P1TT  0/1  1 Day  (not started yet)`\n\n' +
        '📌 Simple Format:\n' +
        '`BS-ABC123 0/1 1Day`\n\n' +
        '📌 Minimal Format:\n' +
        '`BS-ABC123`\n\n' +
        '📌 Send in 1 message, multiple lines allowed!',
        { parse_mode: 'Markdown' }
    );

    // Simpan state
    userStates.set(chatId, { step: 'waiting_keys' });
});

// ===== HANDLE PESAN UNTUK /ADDKEYS =====
const userStates = new Map();

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/')) return;
    if (msg.document) return;

    const state = userStates.get(chatId);
    if (!state || state.step !== 'waiting_keys') return;

    if (!isAdmin(chatId)) {
        userStates.delete(chatId);
        return;
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const keysToSend = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Format: BS-ABC123 0/1 1Day
        const match = trimmed.match(/^(BS-[A-Z0-9-]+)\s+([01]\/[0-9]+)\s+([A-Z0-9 ]+)$/i);
        if (match) {
            const key = match[1].toUpperCase();
            const status = match[2];
            const packageRaw = match[3].toUpperCase().trim();

            if (status.startsWith('1/')) continue;

            const packageMap = {
                '1JAM': '2Jam', '2JAM': '2Jam', '5JAM': '5Jam',
                '1HARI': '1Day', '1DAY': '1Day',
                '3HARI': '3Day', '3DAY': '3Day',
                '7HARI': '7Day', '7DAY': '7Day',
                '14HARI': '14Day', '14DAY': '14Day',
                '30HARI': '30Day', '30DAY': '30Day',
                '60HARI': '60Day', '60DAY': '60Day'
            };

            let packageId = packageMap[packageRaw.replace(/\s+/g, '')];
            if (!packageId) {
                const found = ['2Jam', '5Jam', '1Day', '3Day', '7Day', '14Day', '30Day', '60Day']
                    .find(p => packageRaw.includes(p.toUpperCase()) || p.toUpperCase().includes(packageRaw));
                if (found) packageId = found;
            }

            if (packageId) {
                keysToSend.push({ packageId, key });
            }
            continue;
        }

        // Format panel: 1313  BS  BS-ADF0P1TT  0/1  1 Day
        const panelMatch = trimmed.match(/^\d+\s+BS\s+(BS-[A-Z0-9-]+)\s+([01]\/[0-9]+)\s+([\d]+\s+(?:Day|Days|Hari|JAM|Jam))/i);
        if (panelMatch) {
            const key = panelMatch[1].toUpperCase();
            const status = panelMatch[2];
            const packageRaw = panelMatch[3].trim();

            if (status.startsWith('1/')) continue;

            const daysMatch = packageRaw.match(/(\d+)/);
            if (daysMatch) {
                const days = parseInt(daysMatch[1]);
                let packageId;
                if (days === 1) packageId = '1Day';
                else if (days === 2) packageId = '2Jam';
                else if (days === 3) packageId = '3Day';
                else if (days === 5) packageId = '5Jam';
                else if (days === 7) packageId = '7Day';
                else if (days === 14) packageId = '14Day';
                else if (days === 30) packageId = '30Day';
                else if (days === 60) packageId = '60Day';

                if (packageId) {
                    keysToSend.push({ packageId, key });
                }
            }
            continue;
        }

        // Format: package|key
        const pipeMatch = trimmed.match(/^(.+)\|(BS-[A-Z0-9-]+)$/i);
        if (pipeMatch) {
            const packageRaw = pipeMatch[1].trim().toUpperCase();
            const key = pipeMatch[2].trim().toUpperCase();

            const packageMap = {
                '1JAM': '2Jam', '2JAM': '2Jam', '5JAM': '5Jam',
                '1HARI': '1Day', '1DAY': '1Day',
                '3HARI': '3Day', '3DAY': '3Day',
                '7HARI': '7Day', '7DAY': '7Day',
                '14HARI': '14Day', '14DAY': '14Day',
                '30HARI': '30Day', '30DAY': '30Day',
                '60HARI': '60Day', '60DAY': '60Day'
            };

            let packageId = packageMap[packageRaw.replace(/\s+/g, '')];
            if (!packageId) {
                const found = ['2Jam', '5Jam', '1Day', '3Day', '7Day', '14Day', '30Day', '60Day']
                    .find(p => packageRaw.includes(p.toUpperCase()) || p.toUpperCase().includes(packageRaw));
                if (found) packageId = found;
            }

            if (packageId) {
                keysToSend.push({ packageId, key });
            }
            continue;
        }

        // Key only
        const keyOnly = trimmed.match(/^(BS-[A-Z0-9-]+)$/i);
        if (keyOnly) {
            // Skip, karena ga ada package
            continue;
        }
    }

    if (keysToSend.length === 0) {
        bot.sendMessage(chatId, '❌ Tidak ada key yang valid ditemukan! Pastikan formatnya benar.');
        userStates.delete(chatId);
        return;
    }

    await bot.sendMessage(chatId, `⏳ Memproses ${keysToSend.length} key...`);

    try {
        const response = await fetch(`${API_URL}/addkeys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ keys: keysToSend })
        });

        const result = await response.json();

        if (result.success) {
            let reply = '📊 **ADD KEY RESULTS**\n─────────────────────────────\n\n';
            reply += `✅ Success: ${result.added}\n`;
            reply += `⏭️ Skipped: ${result.skipped}\n`;
            reply += `❌ Failed: ${result.failed}\n\n`;
            reply += '📋 **DETAILS:**\n';
            reply += result.results.slice(0, 20).join('\n');

            if (result.results.length > 20) {
                reply += `\n\n... and ${result.results.length - 20} more`;
            }

            bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal tambah key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }

    userStates.delete(chatId);
});

// ============================================================
// ADMIN COMMANDS LAINNYA (GENKEY, GENFREE, DLL)
// ============================================================

// ===== /GENKEY =====
bot.onText(/\/genkey (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const packageInput = match[1].trim().toUpperCase();
    const packageMap = {
        '2JAM': '2JAM', '5JAM': '5JAM',
        '1HARI': '1DAY', '1DAY': '1DAY',
        '3HARI': '3DAY', '3DAY': '3DAY',
        '7HARI': '7DAY', '7DAY': '7DAY',
        '14HARI': '14DAY', '14DAY': '14DAY',
        '30HARI': '30DAY', '30DAY': '30DAY',
        '60HARI': '60DAY', '60DAY': '60DAY',
    };

    const packageId = packageMap[packageInput];
    if (!packageId) {
        bot.sendMessage(chatId,
            `❌ Paket ${packageInput} tidak ditemukan!\n` +
            `📋 Paket: 2JAM, 5JAM, 1DAY, 3DAY, 7DAY, 14DAY, 30DAY, 60DAY`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    await bot.sendMessage(chatId, `⏳ Generating key for ${packageId}...`);

    try {
        const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ package_id: packageId })
        });

        const result = await response.json();

        if (result.success) {
            bot.sendMessage(chatId,
                `✅ KEY GENERATED!\n─────────────────────────────\n\n` +
                `🔑 ${result.key}\n` +
                `📦 ${result.package}\n` +
                `📅 Expired: ${result.expired}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal generate key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /GENFREE =====
bot.onText(/\/genfree/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    await bot.sendMessage(chatId, `⏳ Generating free key...`);

    try {
        const response = await fetch(`${API_URL}/generate-free`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ game: 'BS' })
        });

        const result = await response.json();

        if (result.success) {
            bot.sendMessage(chatId,
                `🎁 FREE KEY GENERATED!\n─────────────────────────────\n\n` +
                `🔑 ${result.key}\n` +
                `📦 ${result.package}\n` +
                `📅 Expired: ${result.expired}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal generate free key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /MASSGEN =====
bot.onText(/\/massgen (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const parts = match[1].trim().split(' ');
    const packageInput = parts[0].toUpperCase();
    const count = Math.min(parseInt(parts[1]) || 5, 50);

    const packageMap = {
        '2JAM': '2JAM', '5JAM': '5JAM',
        '1HARI': '1DAY', '1DAY': '1DAY',
        '3HARI': '3DAY', '3DAY': '3DAY',
        '7HARI': '7DAY', '7DAY': '7DAY',
        '14HARI': '14DAY', '14DAY': '14DAY',
        '30HARI': '30DAY', '30DAY': '30DAY',
        '60HARI': '60DAY', '60DAY': '60DAY',
    };

    const packageId = packageMap[packageInput];
    if (!packageId) {
        bot.sendMessage(chatId,
            `❌ Paket ${packageInput} tidak ditemukan!`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    await bot.sendMessage(chatId, `⏳ Generating ${count} keys for ${packageId}...`);

    let success = 0;
    let keys = [];

    for (let i = 0; i < count; i++) {
        try {
            const response = await fetch(`${API_URL}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify({ package_id: packageId })
            });

            const result = await response.json();
            if (result.success) {
                success++;
                keys.push(result.key);
            }
        } catch (e) {
            console.error('Error generating key:', e);
        }
    }

    if (success > 0) {
        let text = `✅ ${success} KEY GENERATED!\n─────────────────────────────\n\n`;
        text += `📦 ${packageId}\n\n`;
        text += `🔑 Keys:\n`;
        keys.slice(0, 15).forEach(k => {
            text += `   ${k}\n`;
        });
        if (keys.length > 15) {
            text += `   ... dan ${keys.length - 15} lainnya`;
        }
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Gagal generate key!');
    }
});

// ===== /CEKKEY =====
bot.onText(/\/cekkey (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const key = match[1].trim().toUpperCase();

    try {
        const response = await fetch(`${API_URL}/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ key })
        });

        const result = await response.json();

        if (!result.success) {
            bot.sendMessage(chatId,
                `❌ Key ${key} tidak ditemukan!`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const data = result.key;
        const statusEmoji = data.status === 'Active' ? '✅' : '❌';

        let text = `🔍 CEK KEY\n─────────────────────────────\n\n`;
        text += `🔑 Key: ${data.user_key}\n`;
        text += `🎮 Game: ${data.game}\n`;
        text += `📦 Paket: ${data.duration}\n`;
        text += `📱 Devices: ${data.devices}/${data.max_devices}\n`;
        text += `📅 Expired: ${data.expired}\n`;
        text += `📊 Status: ${statusEmoji} ${data.status}\n`;
        text += `👤 Registrator: ${data.registrator}`;

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /RESETKEY =====
bot.onText(/\/resetkey (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const key = match[1].trim().toUpperCase();

    try {
        const response = await fetch(`${API_URL}/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ key })
        });

        const result = await response.json();

        if (result.success) {
            bot.sendMessage(chatId,
                `✅ KEY RESET!\n─────────────────────────────\n\n` +
                `🔑 ${key}\n` +
                `📱 Semua devices telah direset!`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal reset key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /DELKEY =====
bot.onText(/\/delkey (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const key = match[1].trim().toUpperCase();

    try {
        const response = await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ key })
        });

        const result = await response.json();

        if (result.success) {
            bot.sendMessage(chatId,
                `✅ KEY DELETED!\n─────────────────────────────\n\n` +
                `🔑 ${key}\n` +
                `🗑️ Key telah dihapus dari database!`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ ${result.message || 'Gagal delete key!'}`);
        }
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /ORDERS =====
bot.onText(/\/orders/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    bot.sendMessage(chatId,
        '📋 DAFTAR ORDER\n─────────────────────────────\n\n' +
        '📊 Lihat di panel admin:\n' +
        '   https://skcheat.my.id\n\n' +
        '📌 Atau download semua key:\n' +
        '   https://skcheat.my.id/keys',
        { parse_mode: 'Markdown' }
    );
});

// ===== /STATS =====
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/stock`, {
            headers: { 'X-API-Key': API_KEY }
        });

        const result = await response.json();

        if (!result.success) {
            bot.sendMessage(chatId, '❌ Gagal mengambil data!');
            return;
        }

        let text = '📊 STATISTIK\n─────────────────────────────\n\n';
        text += `📦 Total Stok: ${result.total}\n`;
        text += `🕐 ${new Date().toLocaleString('id-ID')}`;

        bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ===== /ADDAPK =====
bot.onText(/\/addapk/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    bot.sendMessage(chatId,
        '📦 UPLOAD APK\n─────────────────────────────\n\n' +
        'Kirim file APK sekarang!\n' +
        'File akan disimpan dan dikirim ke pembeli.',
        { parse_mode: 'Markdown' }
    );
});

// ===== /BROADCAST =====
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Akses ditolak! Fitur ini hanya untuk admin.');
        return;
    }

    const message = match[1];
    bot.sendMessage(chatId, `📢 Broadcast dikirim ke semua user!\n\nPesan: ${message}`);
});

// ===== HANDLE APK FILE =====
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '⛔ Hanya admin!');
        return;
    }

    const file = msg.document;
    const fileName = file.file_name || 'Shorekeeper.apk';

    if (!fileName.endsWith('.apk')) {
        bot.sendMessage(chatId, '❌ Harus file APK! (.apk)');
        return;
    }

    try {
        const fileId = file.file_id;
        const fileLink = await bot.getFileLink(fileId);

        bot.sendMessage(chatId,
            `✅ APK BERHASIL DISIMPAN!\n─────────────────────────────\n\n` +
            `📦 File: ${fileName}\n` +
            `🕐 Diupdate: ${new Date().toLocaleString('id-ID')}\n\n` +
            `📌 Pembeli bisa dapatkan dengan:\n` +
            `   /apk - Download APK`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        bot.sendMessage(chatId, `❌ Gagal menyimpan file: ${e.message}`);
    }
});

console.log('🤖 Bot started!');
console.log('🔑 API Key: SK-BOT-2024-SECURE-7X9K2M4N6P8Q');
console.log('📌 Admin ID: ' + ADMIN_ID);
console.log('🛒 Member commands: /buy, /order, /cek, /stok, /payment, /apk');
console.log('🔑 Admin commands: /genkey, /genfree, /massgen, /cekkey, /resetkey, /delkey, /orders, /stats, /addapk, /addkey, /addkeys, /broadcast');
