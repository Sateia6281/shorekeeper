const axios = require('axios');
const https = require('https');
const { generateRandomKey, addKey } = require('./database');

const KRUNCPOINT_URL = 'https://krunchpoint.x10.mx';

// 🔥 KODE REFERRAL KAMU!
const REFERRAL_CODE = 'PxHzfV';

// ============================================================
// BIKIN AKUN BARU DI KRUNCPOINT (SSL OFF)
// ============================================================
async function registerNewAccount() {
    try {
        // Generate random
        const randomStr = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        const username = 'user_' + randomStr;
        const password = 'Pass' + Math.random().toString(36).substr(2, 8) + '!@';
        const email = username + '@tempmail.com';
        
        console.log('📝 Bikin akun baru:', username);
        console.log('🔗 Pake referral:', REFERRAL_CODE);

        // 🔥 AMBIL CSRF TOKEN (SSL OFF)
        const csrfRes = await axios.get(`${KRUNCPOINT_URL}/register`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 🔥 MATIKAN SSL!
        });
        
        let csrfToken = '';
        const html = csrfRes.data;
        
        const patterns = [
            /name="csrf_test_name"\s+value="([^"]+)"/i,
            /name="csrf_token"\s+value="([^"]+)"/i,
            /name="_token"\s+value="([^"]+)"/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                csrfToken = match[1];
                break;
            }
        }

        // 🔥 KIRIM REGISTER (SSL OFF)
        const registerData = {
            username: username,
            email: email,
            password: password,
            confirm_password: password,
            referral: REFERRAL_CODE,
            csrf_test_name: csrfToken,
            csrf_token: csrfToken,
            _token: csrfToken
        };

        console.log('📦 Register data:', { username, email, referral: REFERRAL_CODE });

        const registerRes = await axios.post(
            `${KRUNCPOINT_URL}/register`,
            new URLSearchParams(registerData),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5,
                timeout: 15000,
                httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 🔥 MATIKAN SSL!
            }
        );

        // Ambil cookie
        const cookies = registerRes.headers['set-cookie'];
        let cookie = '';
        if (cookies) {
            cookie = cookies.map(c => c.split(';')[0]).join('; ');
        }

        // Cek apakah berhasil
        const responseData = registerRes.data;
        if (typeof responseData === 'string') {
            if (responseData.includes('error') || responseData.includes('gagal')) {
                console.log('❌ Register gagal:', responseData.substring(0, 200));
                return { 
                    success: false, 
                    error: 'Register gagal',
                    response: responseData.substring(0, 500)
                };
            }
        }

        console.log('✅ Akun baru berhasil!');
        console.log(`👤 Username: ${username}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`📧 Email: ${email}`);
        console.log(`🔗 Referral: ${REFERRAL_CODE}`);

        return {
            success: true,
            username: username,
            password: password,
            email: email,
            referral: REFERRAL_CODE,
            cookie: cookie
        };

    } catch (error) {
        console.error('❌ Error register:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data ? error.response.data.substring(0, 500) : 'empty');
        }
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// ============================================================
// GENERATE KEY PAKE AKUN BARU (SSL OFF)
// ============================================================
async function generateKeyWithNewAccount(packageId = '1DAY') {
    try {
        // 1. Bikin akun baru
        const account = await registerNewAccount();
        if (!account.success) {
            console.log('❌ Gagal bikin akun');
            return { 
                success: false, 
                error: account.error,
                account: null,
                key: null
            };
        }

        // 2. Generate key
        const key = generateRandomKey();
        console.log('🔑 Generate key:', key, 'Package:', packageId);

        // 🔥 POST KEY KE KRUNCPOINT (SSL OFF)
        const response = await axios.post(
            `${KRUNCPOINT_URL}/keys`,
            new URLSearchParams({
                key: key,
                package: packageId,
                submit: 'Save'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': account.cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 5,
                timeout: 15000,
                httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 🔥 MATIKAN SSL!
            }
        );

        // 4. Cek berhasil
        const data = response.data;
        let generatedKey = key;
        
        if (typeof data === 'string') {
            const match = data.match(/BS-[A-Z0-9]{10,}/);
            if (match) {
                generatedKey = match[0];
            }
        }

        // Simpan ke database lokal
        addKey(packageId, generatedKey);

        console.log('✅ SEMUA BERHASIL!');
        console.log(`👤 Akun: ${account.username}`);
        console.log(`🔑 Key: ${generatedKey}`);
        console.log(`🔗 Referral: ${REFERRAL_CODE}`);

        return {
            success: true,
            account: {
                username: account.username,
                password: account.password,
                email: account.email,
                referral: account.referral
            },
            key: generatedKey,
            package: packageId
        };

    } catch (error) {
        console.error('❌ Error generate:', error.message);
        return {
            success: false,
            error: error.message,
            account: null,
            key: null
        };
    }
}

// ============================================================
// EXPORT
// ============================================================
async function checkLogin() {
    return true;
}

async function getCookieInfo() {
    return {
        valid: true,
        cookie: 'USING_NEW_ACCOUNT_EACH_TIME',
        expiry: 'N/A'
    };
}

async function loginToKruncpoint() {
    return true;
}

module.exports = {
    generateKeyAtKruncpoint: generateKeyWithNewAccount,
    registerNewAccount,
    loginToKruncpoint,
    checkLogin,
    getCookieInfo,
    KRUNCPOINT_URL,
    REFERRAL_CODE
};