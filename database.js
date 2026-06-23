const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error('Error loading data:', e.message);
    }
    
    // Default data
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
        chatMessages: {}
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving data:', e.message);
    }
}

const LABEL_MAP = {
    '2JAM': '2Jam',
    '2 JAM': '2Jam',
    '5JAM': '5Jam',
    '5 JAM': '5Jam',
    '1HARI': '1Day',
    '1 HARI': '1Day',
    '1DAY': '1Day',
    '3HARI': '3Day',
    '3 HARI': '3Day',
    '3DAY': '3Day',
    '7HARI': '7Day',
    '7 HARI': '7Day',
    '7DAY': '7Day',
    '14HARI': '14Day',
    '14 HARI': '14Day',
    '14DAY': '14Day',
    '30HARI': '30Day',
    '30 HARI': '30Day',
    '30DAY': '30Day',
    '60HARI': '60Day',
    '60 HARI': '60Day',
    '60DAY': '60Day',
    'FREE': 'Free1Day',
    'FREE1DAY': 'Free1Day',
    'FREE 1 HARI': 'Free1Day'
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

// === FUNCTIONS ===

function addKey(label, key) {
    const data = loadData();
    const normalizedLabel = LABEL_MAP[label.toUpperCase().replace(/\s+/g, '')] || label;
    
    if (!data.stock[normalizedLabel]) {
        data.stock[normalizedLabel] = [];
    }
    
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
    return (data.stock[normalizedLabel] || []).length;
}

function getTotalStock() {
    const data = loadData();
    let total = 0;
    for (const label in data.stock) {
        total += (data.stock[label] || []).length;
    }
    return total;
}

function reserveKey(label) {
    const data = loadData();
    const normalizedLabel = LABEL_MAP[label.toUpperCase().replace(/\s+/g, '')] || label;
    
    if (!data.stock[normalizedLabel] || data.stock[normalizedLabel].length === 0) {
        return null;
    }
    
    const key = data.stock[normalizedLabel].shift();
    saveData(data);
    return key;
}

function addOrder(order) {
    const data = loadData();
    data.orders.push(order);
    data.totalSold = (data.totalSold || 0) + 1;
    data.totalRevenue = (data.totalRevenue || 0) + (order.priceNumber || 0);
    saveData(data);
}

function getOrders() {
    const data = loadData();
    return data.orders || [];
}

function getPendingOrders() {
    const data = loadData();
    return data.pendingOrders || [];
}

function getOrderById(orderId) {
    const data = loadData();
    
    let found = (data.pendingOrders || []).find(o => o.orderId === orderId);
    if (found) return found;
    
    found = (data.orders || []).find(o => o.orderId === orderId);
    return found;
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
        addKey(order.packageId, order.key);
    }
    
    saveData(data);
    return order;
}

// === EXPORTS ===

module.exports = {
    data: loadData(),
    loadData,
    saveData,
    addKey,
    getStockCount,
    getTotalStock,
    reserveKey,
    addOrder,
    getOrders,
    getPendingOrders,
    getOrderById,
    generateOrderId,
    addPendingOrder,
    approveOrder,
    rejectOrder,
    PKG_LIST,
    LABEL_MAP
};
