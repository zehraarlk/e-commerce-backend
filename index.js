const express = require('express');
const cors = require('cors');
const db = require('./db');
const axios = require('axios');

const app = express();
const PORT = 5000;

// Middleware (Veri alışverişi için şart)
app.use(cors());
app.use(express.json());

// 1. Ürünleri Listele
app.get('/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json(rows);
    });
});

// 2. Veritabanını Sıfırla ve Ürünleri API'den Çek
app.get('/reset-products', (req, res) => {
    db.run(`DELETE FROM products`, async (err) => {
        if (err) return res.status(500).send("Hata: " + err.message);

        try {
            const response = await axios.get('https://fakestoreapi.com/products');
            const apiProducts = response.data;
            const query = `INSERT INTO products (title, price, description, category, image) VALUES (?, ?, ?, ?, ?)`;

            apiProducts.forEach(product => {
                db.run(query, [product.title, product.price, product.description, product.category, product.image]);
            });

            return res.send("Veritabanı sıfırlandı ve 20 orijinal ürün yüklendi! Şimdi React sayfanı yenile.");
        } catch (apiErr) {
            return res.status(500).send("API Hatası: " + apiErr.message);
        }
    });
});

// 3. Kullanıcı Kayıt (Register)
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const query = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
    
    db.run(query, [username, email, password], function(err) {
        if (err) return res.status(400).json({ error: "Bu kullanıcı zaten kayıtlı!" });
        return res.status(201).json({ message: "Kayıt başarılı!", id: this.lastID });
    });
});

// 4. Kullanıcı Giriş (Login) - Düzenlenmiş ve Teke İndirilmiş Halı
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = `SELECT * FROM users WHERE username = ? AND password = ?`;

    db.get(query, [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: "Veritabanı hatası!" });
        
        if (row) {
            // Eğer kullanıcı adı 'admin' ise geçici olarak rol atıyoruz
            if (row.username === 'admin') { 
                row.role = 'admin'; 
            }
            return res.json({ message: "Giriş başarılı", user: row });
        } else {
            return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı!" });
        }
    });
});

// 5. Kullanıcının Sepetini Getir
app.get('/cart/:userId', (req, res) => {
    const query = `
        SELECT products.*, cart.quantity, cart.id as cart_item_id 
        FROM cart 
        JOIN products ON cart.product_id = products.id 
        WHERE cart.user_id = ?`;
    db.all(query, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json(rows);
    });
});

// 6. Sepete Ürün Ekle
app.post('/cart', (req, res) => {
    const { user_id, product_id, quantity } = req.body;
    db.get(`SELECT * FROM cart WHERE user_id = ? AND product_id = ?`, [user_id, product_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run(`UPDATE cart SET quantity = quantity + ? WHERE id = ?`, [quantity || 1, row.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                return res.json({ message: "Miktar güncellendi" });
            });
        } else {
            db.run(`INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)`, 
            [user_id, product_id, quantity || 1], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                return res.json({ id: this.lastID });
            });
        }
    });
});

// 7. Sepetten Ürün Sil
app.delete('/cart/:userId/:productId', (req, res) => {
    db.run(`DELETE FROM cart WHERE user_id = ? AND product_id = ?`, 
    [req.params.userId, req.params.productId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ message: "Ürün silindi" });
    });
});

// 8. Yeni Ürün Ekleme (Admin)
app.post('/products', (req, res) => {
    const { title, price, description, category, image } = req.body;
    const query = `INSERT INTO products (title, price, description, category, image) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [title, price, description, category, image], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.status(201).json({ id: this.lastID, message: "Ürün başarıyla eklendi!" });
    });
});

// 9. Ürün Silme (Admin)
app.delete('/products/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM products WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ message: "Ürün başarıyla silindi!" });
    });
});

// 10. Ürün Güncelleme (Admin)
app.put('/products/:id', (req, res) => {
    const { id } = req.params;
    const { title, price, description, category, image } = req.body;
    const query = `UPDATE products SET title=?, price=?, description=?, category=?, image=? WHERE id=?`;
    
    db.run(query, [title, price, description, category, image, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        return res.json({ message: "Ürün başarıyla güncellendi!" });
    });
});

// Sipariş Oluşturma (Checkout)
app.post('/checkout', (req, res) => {
    const { user_id, total_price, product_details } = req.body;

    // 1. Siparişi orders tablosuna ekle
    const orderQuery = `INSERT INTO orders (user_id, product_details, total_price) VALUES (?, ?, ?)`;
    
    db.run(orderQuery, [user_id, JSON.stringify(product_details), total_price], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const orderId = this.lastID;

        // 2. Sipariş başarıyla oluştuktan sonra sepeti boşalt
        db.run(`DELETE FROM cart WHERE user_id = ?`, [user_id], (err) => {
            if (err) return res.status(500).json({ error: "Sepet boşaltılamadı" });
            
            res.json({ 
                message: "Siparişiniz başarıyla alındı!", 
                orderId: orderId 
            });
        });
    });
});

// Kullanıcının kendi siparişlerini çekmesi
app.get('/orders/:userId', (req, res) => {
    db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC`, [req.params.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin için tüm siparişleri çekme
app.get('/admin/orders', (req, res) => {
    db.all(`SELECT orders.*, users.username FROM orders JOIN users ON orders.user_id = users.id ORDER BY order_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Admin için sipariş durumu güncelleme
app.put('/admin/orders/:orderId', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.orderId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Sipariş durumu güncellendi" });
    });
});

// Admin Dashboard İstatistikleri
app.get('/admin/stats', async (req, res) => {
    try {
        // 1. Toplam Ürün Sayısı
        const products = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM products", (err, row) => err ? reject(err) : resolve(row.count));
        });

        // 2. Toplam Kullanıcı Sayısı
        const users = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users", (err, row) => err ? reject(err) : resolve(row.count));
        });

        // 3. Kategori Bazlı Ürün Sayıları
        const categories = await new Promise((resolve, reject) => {
            db.all("SELECT category, COUNT(*) as count FROM products GROUP BY category", (err, rows) => err ? reject(err) : resolve(rows));
        });

        res.json({
            totalProducts: products,
            totalUsers: users,
            categories: categories
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tüm kullanıcıları listele (Admin için)
app.get('/admin/users', (req, res) => {
    db.all("SELECT id, username, email FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json(rows);
    });
});

// Belirli bir kategoriye ait ürünleri getir
app.get('/products/category/:categoryName', (req, res) => {
    const { categoryName } = req.params;
    db.all("SELECT * FROM products WHERE category = ?", [categoryName], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        return res.json(rows);
    });
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});