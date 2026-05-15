const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sendEmail = require('../config/mailer');


// View Cart
router.get('/', (req, res) => {
  const cart = req.session.cart || {};
  res.render('cart', { cart });
});

// Add to Cart
router.post('/add', (req, res) => {
  const productId = req.body.productId;

  db.query('SELECT * FROM products WHERE product_id = ?', [productId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(500).send('Product not found');
    }

    const product = results[0];
    if (product.in_stock === 0) {
      return res.status(400).send('Item out of stock');
    }

    // Initialize cart
    if (!req.session.cart) req.session.cart = {};

    // Add or update quantity
    const cart = req.session.cart;
    if (cart[productId]) {
      cart[productId].quantity += 1;
    } else {
      cart[productId] = {
        name: product.product_name,
        price: product.unit_price,
        quantity: 1,
        unit: product.unit_quantity
      };
    }

    res.redirect('back');
  });
});

// Delivery details form
router.get('/checkout', (req, res) => {
  const cart = req.session.cart;
  if (!cart || Object.keys(cart).length === 0) {
    return res.redirect('/cart');
  }
  res.render('delivery');
});

// Delivery form submission
router.post('/checkout', (req, res) => {
  const { name, email, mobile, street, city, state } = req.body;
  const cart = req.session.cart;

  const productIds = Object.keys(cart);

  if (!productIds.length) return res.redirect('/cart');

  const placeholders = productIds.map(() => '?').join(',');
  const sql = `SELECT product_id, in_stock FROM products WHERE product_id IN (${placeholders})`;

  db.query(sql, productIds, (err, results) => {
    if (err) return res.status(500).send('Server Error');

    const stockMap = {};
    results.forEach(row => stockMap[row.product_id] = row.in_stock);

    for (let id of productIds) {
      if (!stockMap[id] || cart[id].quantity > stockMap[id]) {
        return res.send(`<script>alert("Item ${cart[id].name} is out of stock or insufficient."); window.location.href='/cart';</script>`);
      }
    }

    // Reduce stock
    productIds.forEach(id => {
      const quantity = cart[id].quantity;
      db.query(`UPDATE products SET in_stock = in_stock - ? WHERE product_id = ?`, [quantity, id]);
    });

    // Clear cart
    req.session.cart = null;

    // Send confirmation email
    sendEmail(email, 'Order Confirmation - VORTREXYN Grocery',
      `<h3>Your order is confirmed!</h3>
      <p>Thank you, ${name}. Your items will be delivered to: ${street}, ${city}, ${state}</p>`
    ).then(() => {
      console.log("✅ Confirmation email sent");
    }).catch(err => {
      console.error("❌ Email sending failed:", err);
    });
    
    // Show confirmation
    res.render('order-confirmation', {
      name, email, mobile, street, city, state
    });
  });
});

// Update cart quantities or remove items
router.post('/update', (req, res) => {
  if (!req.session.cart) return res.redirect('/cart');

  const cart = req.session.cart;
  const updatedQuantities = req.body.quantities || {};
  const removeId = req.body.remove;

  if (removeId && cart[removeId]) {
    delete cart[removeId];
  } else {
    for (let id in updatedQuantities) {
      const quantity = parseInt(updatedQuantities[id]);
      if (quantity > 0) {
        cart[id].quantity = quantity;
      }
    }
  }

  res.redirect('/cart');
});

// Clear cart
router.post('/clear', (req, res) => {
  req.session.cart = {};
  res.redirect('/cart');
});


module.exports = router;
