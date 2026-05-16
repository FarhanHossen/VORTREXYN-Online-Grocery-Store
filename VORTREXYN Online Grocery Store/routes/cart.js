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
  const freeThreshold = tier >= 6 ? 0 : tier === 5 ? 150 : tier === 4 ? 100 : tier === 3 ? 100 : tier === 2 ? 50 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;
  const discountRate  = tier >= 7 ? 3.50 : tier >= 6 ? 3.00 : tier === 5 ? 2.50 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;
  const autoDiscountPct = tier >= 7 ? 25 : tier >= 6 ? 20 : tier === 5 ? 15 : tier === 4 ? 10 : tier === 3 ? 5 : 0;
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
  const freeThreshold = tier >= 6 ? 0 : tier === 5 ? 150 : tier === 4 ? 100 : tier === 3 ? 100 : tier === 2 ? 50 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;
  const baseTotal     = total + shipping;
  const discountRate  = tier >= 7 ? 3.50 : tier >= 6 ? 3.00 : tier === 5 ? 2.50 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;
  const autoDiscPct   = tier >= 7 ? 25 : tier >= 6 ? 20 : tier >= 5 ? 15 : tier === 4 ? 10 : tier === 3 ? 5 : 0;

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

    // Within-tier earned counter — cascades through all tiers the points can cover
    const tierThresholds = { 1: 500, 2: 1000, 3: 2000, 4: 3000, 5: 5000, 6: 8000 };
    let earned      = (req.session.user.totalPointsEarned || 0) + pointsEarned;
    let currentTier = tier;
    while (currentTier < 7) {
      const threshold = tierThresholds[currentTier];
      if (earned >= threshold) {
        earned -= threshold;
        currentTier++;
      } else {
        break;
      }
    }
    newTier = currentTier;
    req.session.user.tier              = currentTier;
    req.session.user.totalPointsEarned = earned;

    newRewardPoints      = req.session.user.rewardPoints;
    newTotalOrders       = req.session.user.totalOrders;
    newTotalPointsEarned = req.session.user.totalPointsEarned;
    newTier              = req.session.user.tier || tier;
  }

  const baseUrl   = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  const logoUrl   = `${baseUrl}/images/logo.png`;

  // Build order rows from cart items
  const itemRows = Object.values(cart).map(item => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px">${item.name}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;text-align:center">×${item.quantity}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-weight:600">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const shippingRow = shipping > 0
    ? `<tr><td colspan="2" style="padding:7px 12px;color:#64748b;font-size:13px">Shipping</td><td style="padding:7px 12px;text-align:right;color:#64748b;font-size:13px">$${shipping.toFixed(2)}</td></tr>`
    : `<tr><td colspan="2" style="padding:7px 12px;color:#16a34a;font-size:13px">Shipping</td><td style="padding:7px 12px;text-align:right;color:#16a34a;font-size:13px;font-weight:600">FREE</td></tr>`;

  const autoDiscRow = autoDiscPct > 0
    ? `<tr><td colspan="2" style="padding:7px 12px;color:#d97706;font-size:13px">⚡ ${autoDiscPct}% Auto-Discount</td><td style="padding:7px 12px;text-align:right;color:#d97706;font-size:13px;font-weight:600">-$${autoDiscount.toFixed(2)}</td></tr>`
    : '';

  const pointsRow = actualPointsUsed > 0
    ? `<tr><td colspan="2" style="padding:7px 12px;color:#16a34a;font-size:13px">🏷️ Points Redeemed (${actualPointsUsed} pts)</td><td style="padding:7px 12px;text-align:right;color:#16a34a;font-size:13px;font-weight:600">-$${discount.toFixed(2)}</td></tr>`
    : '';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center">
            <img src="${logoUrl}" alt="VORTREXYN" height="60" style="height:60px;object-fit:contain;display:block;margin:0 auto">
            <p style="color:#94a3b8;font-size:12px;margin:10px 0 0;letter-spacing:1px;text-transform:uppercase">Online Grocery Store</p>
          </td>
        </tr>

        <!-- Green confirmed banner -->
        <tr>
          <td style="background:#16a34a;padding:18px 32px;text-align:center">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700">✓ Order Confirmed!</p>
            <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px">Thank you for shopping with us, <strong>${name}</strong>!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px">

            <!-- Order items table -->
            <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a">🛒 Your Order</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Item</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                ${shippingRow}
                ${autoDiscRow}
                ${pointsRow}
                <tr style="background:#f0fdf4">
                  <td colspan="2" style="padding:12px;font-size:15px;font-weight:700;color:#0f172a">Total Charged</td>
                  <td style="padding:12px;text-align:right;font-size:18px;font-weight:800;color:#16a34a">$${grandTotal}</td>
                </tr>
              </tbody>
            </table>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0">

            <!-- Delivery address -->
            <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a">📦 Delivery Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;color:#64748b;font-size:13px;width:110px">Name</td>
                <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600">${name}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#64748b;font-size:13px">Phone</td>
                <td style="padding:5px 0;color:#1e293b;font-size:13px">${mobile}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#64748b;font-size:13px">Address</td>
                <td style="padding:5px 0;color:#1e293b;font-size:13px">${street}, ${city}, ${state}</td>
              </tr>
            </table>

            <!-- Divider -->
            <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0">

            <!-- Reward points -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:18px">
              <tr>
                <td style="padding:0 0 0 18px">
                  <p style="margin:0;font-size:15px;font-weight:700;color:#92400e">⭐ Reward Points</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#78350f">You earned <strong>+${pointsEarned} pts</strong> on this order &nbsp;·&nbsp; New balance: <strong>${newRewardPoints ?? 0} pts</strong></p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;border-radius:0 0 12px 12px;padding:22px 32px;text-align:center">
            <p style="margin:0;color:#64748b;font-size:12px">© 2025 VORTREXYN Online Grocery Store. All rights reserved.</p>
            <p style="margin:8px 0 0;color:#334155;font-size:12px">Questions? Reply to this email and we'll be happy to help.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  sendEmail(email, '✓ Order Confirmed — VORTREXYN Grocery', emailHtml)
    .catch(err => console.error('Email failed:', err));

  res.render('order-confirmation', {
    name, email, mobile, street, city, state,
    grandTotal, pointsEarned, newRewardPoints, newTotalOrders,
    pointsUsed: actualPointsUsed, discount: discount.toFixed(2),
    tier, newTier, newTotalPointsEarned
  });
});

module.exports = router;
