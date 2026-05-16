const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sendEmail = require('../config/mailer');

// View Cart
router.get('/', (req, res) => {
  const cart = req.session.cart || {};
  res.render('cart', { cart });
});

// Add to Cart — reduces stock immediately
router.post('/add', (req, res) => {
  const productId = req.body.productId;
  const requestedQty = Math.max(1, parseInt(req.body.qty) || 1);

  db.query('SELECT * FROM products WHERE product_id = ?', [productId], (err, results) => {
    if (err || results.length === 0) return res.redirect('back');

    const product = results[0];
    const inStock = parseInt(product.in_stock);
    if (inStock === 0) return res.redirect('back');

    if (!req.session.cart) req.session.cart = {};
    const cart = req.session.cart;
    const currentQty = cart[productId] ? cart[productId].quantity : 0;
    const addQty = Math.min(requestedQty, inStock - currentQty);
    if (addQty <= 0) return res.redirect('back');

    // Reduce stock in DB immediately
    db.query('UPDATE products SET in_stock = in_stock - ? WHERE product_id = ?', [addQty, productId], () => {});

    if (cart[productId]) {
      cart[productId].quantity += addQty;
    } else {
      cart[productId] = {
        name: product.product_name,
        price: product.unit_price,
        quantity: addQty,
        unit: product.unit_quantity
      };
    }
    res.redirect('back');
  });
});

// Update quantities or remove — restores stock on remove
router.post('/update', (req, res) => {
  if (!req.session.cart) return res.redirect('/cart');
  const cart = req.session.cart;
  const updatedQuantities = req.body.quantities || {};
  const removeId = req.body.remove;

  if (removeId && cart[removeId]) {
    const restoreQty = cart[removeId].quantity;
    db.query('UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?', [restoreQty, removeId], () => {});
    delete cart[removeId];
  } else {
    for (let id in updatedQuantities) {
      const newQty = parseInt(updatedQuantities[id]);
      if (newQty > 0 && cart[id]) {
        const diff = cart[id].quantity - newQty;
        if (diff > 0) {
          db.query('UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?', [diff, id], () => {});
        } else if (diff < 0) {
          db.query('UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?', [diff, id], () => {}); // diff is negative
        }
        cart[id].quantity = newQty;
      }
    }
  }
  res.redirect('/cart');
});

// Clear cart — restores all stock
router.post('/clear', (req, res) => {
  const cart = req.session.cart || {};
  for (let id in cart) {
    db.query('UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?', [cart[id].quantity, id], () => {});
  }
  req.session.cart = {};
  res.redirect('/cart');
});

// Checkout step 1: delivery details form
router.get('/checkout', (req, res) => {
  const cart = req.session.cart;
  if (!cart || Object.keys(cart).length === 0) return res.redirect('/cart');
  res.render('delivery');
});

// Checkout step 2: save delivery info → go to payment
router.post('/checkout', (req, res) => {
  const { name, email, mobile, street, city, state, saveAddress } = req.body;
  const cart = req.session.cart;
  if (!cart || !Object.keys(cart).length) return res.redirect('/cart');
  req.session.delivery = { name, email, mobile, street, city, state };
  // Optionally persist address to session for future checkouts
  if (saveAddress && req.session.user) {
    req.session.user.savedAddress = { name, mobile, street, city, state };
  }
  res.redirect('/cart/payment');
});

// Checkout step 3: payment page
router.get('/payment', (req, res) => {
  if (!req.session.delivery) return res.redirect('/cart/checkout');
  const cart = req.session.cart;
  if (!cart || !Object.keys(cart).length) return res.redirect('/cart');
  let total = 0;
  for (let id in cart) total += parseFloat(cart[id].price) * cart[id].quantity;
  const delivery  = req.session.delivery;
  const tier          = req.session.user ? (req.session.user.tier || 1) : 1;
  const freeThreshold = tier >= 7 ? 0 : tier >= 6 ? 300 : tier === 5 ? 250 : tier === 4 ? 200 : tier === 3 ? 150 : tier === 2 ? 100 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;
  const discountRate  = tier >= 7 ? 3.50 : tier >= 6 ? 2.50 : tier === 5 ? 2.00 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;
  const autoDiscountPct = tier >= 7 ? 25 : tier >= 6 ? 15 : tier === 5 ? 10 : 0;
  res.render('payment', { delivery, cart, total, shipping, tier, discountRate, autoDiscountPct, freeThreshold });
});

// Checkout step 4: process payment → confirm order
router.post('/payment', (req, res) => {
  const delivery = req.session.delivery;
  const cart     = req.session.cart;
  if (!delivery || !cart || !Object.keys(cart).length) return res.redirect('/cart');

  const { name, email, mobile, street, city, state } = delivery;
  let total = 0;
  for (let id in cart) total += parseFloat(cart[id].price) * cart[id].quantity;
  // ── Tier & discount rate (tier is stored, not computed) ──
  const tier          = req.session.user ? (req.session.user.tier || 1) : 1;
  const freeThreshold = tier >= 7 ? 0 : tier >= 6 ? 300 : tier === 5 ? 250 : tier === 4 ? 200 : tier === 3 ? 150 : tier === 2 ? 100 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;
  const baseTotal     = total + shipping;
  const discountRate  = tier >= 7 ? 3.50 : tier >= 6 ? 2.50 : tier === 5 ? 2.00 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;
  const autoDiscPct   = tier >= 7 ? 25 : tier >= 6 ? 15 : tier >= 5 ? 10 : 0;

  // ── Tier 5/6: auto-discount applied first ──
  const autoDiscount   = autoDiscPct > 0 ? parseFloat((baseTotal * autoDiscPct / 100).toFixed(2)) : 0;
  const afterAuto      = parseFloat((baseTotal - autoDiscount).toFixed(2));

  // ── Points redemption (applied on top of auto-discount) ──
  const userBalance      = req.session.user ? (req.session.user.rewardPoints || 0) : 0;
  const requestedPoints  = Math.floor(parseInt(req.body.pointsToUse) || 0);
  const maxByBalance     = Math.floor(userBalance / 10) * 10;
  const maxByTotal       = Math.floor(afterAuto / discountRate) * 10;
  const actualPointsUsed = Math.min(
    Math.floor(requestedPoints / 10) * 10,
    maxByBalance,
    maxByTotal
  );
  const discount     = (actualPointsUsed / 10) * discountRate;
  const grandTotal   = Math.max(0, afterAuto - discount).toFixed(2);
  const pointsEarned = Math.floor(parseFloat(grandTotal));

  req.session.cart     = {};
  req.session.delivery = null;

  // ── Update session: points, tier-reset earnings & orders ──
  let newRewardPoints      = null;
  let newTotalOrders       = null;
  let newTotalPointsEarned = null;
  let newTier              = tier;
  if (req.session.user) {
    req.session.user.rewardPoints = Math.max(0,
      (req.session.user.rewardPoints || 0) - actualPointsUsed + pointsEarned
    );
    req.session.user.totalOrders = (req.session.user.totalOrders || 0) + 1;

    // Within-tier earned counter — resets (with overflow) on tier-up
    const tierThreshold = tier === 1 ? 500 : tier === 2 ? 1000 : tier === 3 ? 2000 : tier === 4 ? 3000 : tier === 5 ? 5000 : tier === 6 ? 8000 : Infinity;
    const newEarned     = (req.session.user.totalPointsEarned || 0) + pointsEarned;
    if (tier < 7 && newEarned >= tierThreshold) {
      newTier = Math.min(tier + 1, 7);
      req.session.user.tier              = newTier;
      req.session.user.totalPointsEarned = newEarned - tierThreshold;
    } else {
      req.session.user.totalPointsEarned = newEarned;
    }

    newRewardPoints      = req.session.user.rewardPoints;
    newTotalOrders       = req.session.user.totalOrders;
    newTotalPointsEarned = req.session.user.totalPointsEarned;
    newTier              = req.session.user.tier || tier;
  }

  const discountLine = actualPointsUsed > 0
    ? `<br>Points redeemed: ${actualPointsUsed} pts (-$${discount.toFixed(2)})` : '';
  sendEmail(email, 'Order Confirmation — VORTREXYN Grocery',
    `<h2>Order Confirmed!</h2><p>Thank you, ${name}. Total: $${grandTotal}.${discountLine}</p>` +
    `<p>You earned ${pointsEarned} reward points! New balance: ${newRewardPoints ?? 0} pts</p>` +
    `<p>Delivery to: ${street}, ${city}, ${state}</p>`
  ).catch(err => console.error('Email failed:', err));

  res.render('order-confirmation', {
    name, email, mobile, street, city, state,
    grandTotal, pointsEarned, newRewardPoints, newTotalOrders,
    pointsUsed: actualPointsUsed, discount: discount.toFixed(2),
    tier, newTier, newTotalPointsEarned
  });
});

module.exports = router;
