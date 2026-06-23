const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        stock: {
            "1Jam": [],
            "5Jam": [],
            "1Day": [],
            "3Day": [],
            "7Day": [],
            "15Day": [],
            "30Day": [],
            "Lifetime": [],
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

function addKey(label, key) {
    if (!data.stock[label]) data.stock[label] = [];
    if (!data.stock[label].includes(key)) {
        data.stock[label].push(key);
        saveData(data);
        return true;
    }
    return false;
}

function getStockCount(label) {
    if (!data.stock[label]) return 0;
    return data.stock[label].length;
}

function getTotalStock() {
    let total = 0;
    for (const label in data.stock) {
        total += data.stock[label].length;
    }
    return total;
}

function generateRandomKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BS-';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function reserveKey(label) {
    if (!data.stock[label] || data.stock[label].length === 0) return null;
    const key = data.stock[label].shift();
    saveData(data);
    return key;
}

function addOrder(order) {
    data.orders.push(order);
    data.totalSold = (data.totalSold || 0) + 1;
    data.totalRevenue = (data.totalRevenue || 0) + (order.price || 0);
    saveData(data);
}

function getOrders() {
    return data.orders || [];
}

function getPendingOrders() {
    return data.pendingOrders || [];
}

function getOrderById(orderId) {
    const pending = data.pendingOrders || [];
    const found = pending.find(o => o.orderId === orderId);
    if (found) return found;
    const orders = data.orders || [];
    return orders.find(o => o.orderId === orderId);
}

function generateOrderId() {
    data.lastOrderId = (data.lastOrderId || 0) + 1;
    saveData(data);
    return 'ORD' + Date.now().toString(36).toUpperCase() + String(data.lastOrderId).padStart(4, '0');
}

function addPendingOrder(order) {
    if (!data.pendingOrders) data.pendingOrders = [];
    data.pendingOrders.push(order);
    saveData(data);
    return order;
}

function approveOrder(orderId) {
    const pending = data.pendingOrders || [];
    const index = pending.findIndex(o => o.orderId === orderId);
    if (index === -1) return null;
    const order = pending[index];
    data.pendingOrders.splice(index, 1);
    order.status = 'approved';
    order.confirmedAt = new Date().toISOString();
    data.orders.push(order);
    data.totalSold = (data.totalSold || 0) + 1;
    data.totalRevenue = (data.totalRevenue || 0) + (order.price || 0);
    saveData(data);
    return order;
}

function rejectOrder(orderId) {
    const pending = data.pendingOrders || [];
    const index = pending.findIndex(o => o.orderId === orderId);
    if (index === -1) return null;
    const order = pending[index];
    data.pendingOrders.splice(index, 1);
    // Kembalikan key ke stok
    if (order.key && order.packageId) {
        addKey(order.packageId, order.key);
    }
    saveData(data);
    return order;
}

const PKG_LIST = [
    { id: '1JAM', name: '1 JAM', price: 5000 },
    { id: '5JAM', name: '5 JAM', price: 10000 },
    { id: '1DAY', name: '1 HARI', price: 20000 },
    { id: '3DAY', name: '3 HARI', price: 50000 },
    { id: '7DAY', name: '7 HARI', price: 100000 },
    { id: '15DAY', name: '15 HARI', price: 150000 },
    { id: '30DAY', name: '30 HARI', price: 200000 },
    { id: 'Lifetime', name: 'LIFETIME', price: 300000 },
];

module.exports = {
    data,
    loadData,
    saveData,
    addKey,
    getStockCount,
    getTotalStock,
    generateRandomKey,
    reserveKey,
    addOrder,
    getOrders,
    getPendingOrders,
    getOrderById,
    generateOrderId,
    addPendingOrder,
    approveOrder,
    rejectOrder,
    PKG_LIST
};