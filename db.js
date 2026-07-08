const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'veritabani.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Veritabanı bağlantı hatası:", err.message);
    } else {
        console.log("SQLite veritabanına bağlanıldı.");
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            category TEXT,
            image TEXT
        )`);
        // db.js
        db.run(`CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         username TEXT UNIQUE NOT NULL,
         email TEXT UNIQUE NOT NULL,
         password TEXT NOT NULL,
         role TEXT DEFAULT 'user' -- Buradaki virgüle ve yazıma dikkat
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        // db.js
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' 
)`); 
    }
    db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_details TEXT, -- Satın alınan ürünlerin JSON hali
    total_price REAL,
    status TEXT DEFAULT 'Hazırlanıyor', -- 'Kargoya Verildi', 'Teslim Edildi'
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
)`);
});

module.exports = db;