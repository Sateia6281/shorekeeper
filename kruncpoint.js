const axios = require('axios');
const { generateRandomKey, addKey } = require('./database');

const KRUNCPOINT_URL = 'https://krunchpoint.x10.mx';

// 🔥 PAKE USERNAME/PASSWORD (ga perlu cookie!)
const KRUNCPOINT_USERNAME = 'Zelewin1';
const KRUNCPOINT_PASSWORD = 'Satria12';

// Simpan cookie hasil login
let cachedCookie = null;
let cookieExpiry = null;

async function loginToKruncpoint() {
    try {
        console.log('🔑 Login ke Kruncpoint...');
        
        // Coba login
        const response = await axios.post(
            `${KRUNCPOINT_URL}/login`,
            new URLSearchParams({
                username: KRUNCPOINT_USERNAME,
                password: KRUNCPOINT_PASSWORD
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400,
                timeout: 15000
            }
        );

        // Ambil cookie dari header Set-Cookie
        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            const cookies = setCookie.map(c => c.split(';')[0]).join('; ');
            cachedCookie = cookies;
            cookieExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 hari
            console.log('✅ Login berhasil! Cookie:', cookies);
            return cookies;
        }

        // Kalo ga dapet cookie, coba cek response body
        if (response.data && typeof response.data === 'string') {
            // Coba ekstrak cookie dari meta atau script
            const match = response.data.match(/csrf_cookie_name=([^;]+)/);
            if (match) {
                const cookie = `csrf_cookie_name=${match[1]}`;
                cachedCookie = cookie;
                cookieExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
                console.log('✅ Cookie ditemukan di response:', cookie);
                return cookie;
            }
        }

        console.log('❌ Gagal login, ga dapet cookie');
        return null;

    } catch (error) {
        console.error('❌ Login error:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
        return null;
    }
}

async function getValidCookie() {
    // Kalo cookie masih valid, pake
    if (cachedCookie && cookieExpiry && Date.now() < cookieExpiry) {
        return cachedCookie;
    }
    
    // Kalo expired, login ulang
    console.log('🍪 Cookie expired atau belum ada, login ulang...');
    return await loginToKruncpoint();
}

async function generateKeyAtKruncpoint(packageId = '1DAY') {
    try {
        // Ambil cookie (login kalo perlu)
        const cookie = await getValidCookie();
        if (!cookie) {
            console.log('❌ Gagal dapat cookie');
            return null;
        }

        const key = generateRandomKey();
        console.log('🔑 Generate di Kruncpoint:', key, 'Package:', packageId);

        // Coba POST ke /keys
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
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000,
                maxRedirects: 5
            }
        );

        const dataResponse = response.data;
        
        if (typeof dataResponse === 'string') {
            if (dataResponse.includes(key) || dataResponse.includes('success') || dataResponse.includes('berhasil')) {
                console.log('✅ Key berhasil di Kruncpoint:', key);
                addKey(packageId, key);
                return key;
            }
            
            const match = dataResponse.match(/BS-[A-Z0-9]{10,}/);
            if (match) {
                console.log('✅ Key ditemukan:', match[0]);
                addKey(packageId, match[0]);
                return match[0];
            }
        }

        // Fallback: POST ke /keys/generate
        const response2 = await axios.post(
            `${KRUNCPOINT_URL}/keys/generate`,
            new URLSearchParams({
                key: key,
                package: packageId,
                submit: 'Save'
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            }
        );

        const dataResponse2 = response2.data;
        if (typeof dataResponse2 === 'string') {
            const match = dataResponse2.match(/BS-[A-Z0-9]{10,}/);
            if (match) {
                console.log('✅ Key ditemukan di response2:', match[0]);
                addKey(packageId, match[0]);
                return match[0];
            }
        }

        console.log('❌ Gagal generate di Kruncpoint');
        return null;

    } catch (error) {
        console.error('❌ Error Kruncpoint:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        }
        return null;
    }
}

async function checkLogin() {
    const cookie = await getValidCookie();
    return cookie !== null;
}

async function getCookieInfo() {
    const cookie = await getValidCookie();
    if (cookie) {
        return {
            valid: true,
            cookie: cookie,
            expiry: cookieExpiry ? new Date(cookieExpiry).toLocaleString() : 'Unknown'
        };
    }
    return {
        valid: false,
        cookie: null,
        expiry: null
    };
}

module.exports = {
    generateKeyAtKruncpoint,
    checkLogin,
    loginToKruncpoint,
    getCookieInfo,
    KRUNCPOINT_URL,
    KRUNCPOINT_USERNAME,
    KRUNCPOINT_PASSWORD
};