const axios = require('axios');
const { generateRandomKey, addKey } = require('./database');

// 🔥 COOKIE ASLI DARI KAMU!
const KRUNCPOINT_COOKIE = 'csrf_cookie_name=a0eacb4cdf90b7b7d540dd0d7bada96a; ci_session=4b5f39cfacee1ccaf774916d1210f61e0c2fc2d0';
const KRUNCPOINT_URL = 'https://krunchpoint.x10.mx';

async function generateKeyAtKruncpoint(packageId = '1DAY') {
    try {
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
                    'Cookie': KRUNCPOINT_COOKIE,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
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
                    'Cookie': KRUNCPOINT_COOKIE,
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

async function checkCookieValid() {
    try {
        const response = await axios.get(`${KRUNCPOINT_URL}/dashboard`, {
            headers: {
                'Cookie': KRUNCPOINT_COOKIE,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        return response.status === 200 && !response.data.includes('login');
    } catch (error) {
        return false;
    }
}

function updateCookie(newCookie) {
    console.log('🍪 Cookie perlu diupdate ke:', newCookie);
    // Edit manual di file ini
}

module.exports = {
    generateKeyAtKruncpoint,
    checkCookieValid,
    updateCookie,
    KRUNCPOINT_COOKIE,
    KRUNCPOINT_URL
};