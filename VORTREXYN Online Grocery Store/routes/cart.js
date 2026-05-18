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
    if (inStock <= 0) return res.redirect('back');

    if (!req.session.cart) req.session.cart = {};
    const cart = req.session.cart;
    const currentQty = cart[productId] ? cart[productId].quantity : 0;
    const addQty = Math.min(requestedQty, inStock - currentQty);
    if (addQty <= 0) return res.redirect('back');

    // Reduce stock in DB immediately — floor at 0, never negative
    db.query('UPDATE products SET in_stock = GREATEST(0, in_stock - ?) WHERE product_id = ?', [addQty, productId], () => {});

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
          db.query('UPDATE products SET in_stock = GREATEST(0, in_stock + ?) WHERE product_id = ?', [diff, id], () => {}); // diff is negative
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

  // Build order rows from cart items
  const itemRows = Object.values(cart).map(item => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#f0e6d3;font-size:14px">${item.name}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#a8956e;font-size:14px;text-align:center">&times;${item.quantity}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#f59e0b;font-size:14px;text-align:right;font-weight:700">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const shippingRow = shipping > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#a8956e;font-size:13px">Shipping</td><td style="padding:8px 14px;text-align:right;color:#a8956e;font-size:13px">$${shipping.toFixed(2)}</td></tr>`
    : `<tr><td colspan="2" style="padding:8px 14px;color:#86efac;font-size:13px">Shipping</td><td style="padding:8px 14px;text-align:right;color:#86efac;font-size:13px;font-weight:600">FREE</td></tr>`;

  const autoDiscRow = autoDiscPct > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#fcd34d;font-size:13px">${autoDiscPct}% Auto-Discount Applied</td><td style="padding:8px 14px;text-align:right;color:#fcd34d;font-size:13px;font-weight:600">-$${autoDiscount.toFixed(2)}</td></tr>`
    : '';

  const pointsRow = actualPointsUsed > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#86efac;font-size:13px">Reward Points Redeemed (${actualPointsUsed} pts)</td><td style="padding:8px 14px;text-align:right;color:#86efac;font-size:13px;font-weight:600">-$${discount.toFixed(2)}</td></tr>`
    : '';

  // Inline Hex V SVG logo for email (no external image dependency)
  const hexLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="56" height="56" style="display:block;margin:0 auto">
    <defs>
      <linearGradient id="ebg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a1008"/><stop offset="100%" stop-color="#080503"/></linearGradient>
    </defs>
    <polygon points="26,2 47,13.5 47,38.5 26,50 5,38.5 5,13.5" fill="url(#ebg)"/>
    <polygon points="26,2 47,13.5 47,38.5 26,50 5,38.5 5,13.5" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-opacity=".6" stroke-linejoin="round"/>
    <polygon points="26,11 39,18.5 39,33.5 26,41 13,33.5 13,18.5" fill="none" stroke="#f59e0b" stroke-width=".6" stroke-opacity=".2" stroke-linejoin="round"/>
    <line x1="26" y1="26" x2="36.5" y2="8"   stroke="#b45309" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    <line x1="26" y1="26" x2="47"   y2="26"   stroke="#b45309" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    <line x1="26" y1="26" x2="36.5" y2="44"   stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>
    <line x1="26" y1="26" x2="15.5" y2="44"   stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>
    <line x1="26" y1="26" x2="5"    y2="26"   stroke="#b45309" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    <line x1="26" y1="26" x2="15.5" y2="8"    stroke="#b45309" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    <line x1="17" y1="14" x2="26" y2="36" stroke="#fcd34d" stroke-width="2.6" stroke-linecap="round"/>
    <line x1="35" y1="14" x2="26" y2="36" stroke="#fcd34d" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="17" cy="14" r="1.6" fill="#d97706"/>
    <circle cx="35" cy="14" r="1.6" fill="#d97706"/>
    <circle cx="26" cy="36" r="2.2" fill="#fef3c7"/>
  </svg>`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order Confirmed — VORTREXYN</title>
</head>
<body style="margin:0;padding:0;background:#0c0a06;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a06;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;border:1px solid #2a1f0a">

        <!-- ── Header ── -->
        <tr>
          <td style="background:#070503;padding:36px 40px 28px;text-align:center;border-bottom:1px solid #2a1f0a">
            ${hexLogoSvg}
            <p style="margin:14px 0 2px;font-size:22px;font-weight:800;color:#f0e6d3;letter-spacing:6px;text-transform:uppercase;font-family:Georgia,serif">VORTREXYN</p>
            <p style="margin:0;font-size:10px;font-weight:600;color:#f59e0b;letter-spacing:4px;text-transform:uppercase">Online Grocery Store</p>
          </td>
        </tr>

        <!-- ── Confirmed banner ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1200 0%,#0f0b02 100%);padding:28px 40px;text-align:center;border-bottom:1px solid #2a1f0a">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto">
              <tr>
                <td style="background:#f59e0b;border-radius:50%;width:44px;height:44px;text-align:center;vertical-align:middle;font-size:22px;color:#070503;font-weight:900;line-height:44px">&#10003;</td>
              </tr>
            </table>
            <p style="margin:16px 0 4px;font-size:24px;font-weight:800;color:#f0e6d3;letter-spacing:1px">Order Confirmed</p>
            <p style="margin:0;font-size:14px;color:#a8956e;line-height:1.6">Thank you for your order, <strong style="color:#f59e0b">${name}</strong>. We have received your request and are preparing your items for delivery.</p>
          </td>
        </tr>

        <!-- ── Order summary ── -->
        <tr>
          <td style="background:#0d0b06;padding:32px 40px">

            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:3px;text-transform:uppercase">Order Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a1f0a;border-radius:10px;overflow:hidden">
              <thead>
                <tr style="background:#131009">
                  <th style="padding:11px 14px;text-align:left;font-size:11px;color:#a8956e;text-transform:uppercase;letter-spacing:1px;font-weight:600">Item</th>
                  <th style="padding:11px 14px;text-align:center;font-size:11px;color:#a8956e;text-transform:uppercase;letter-spacing:1px;font-weight:600">Qty</th>
                  <th style="padding:11px 14px;text-align:right;font-size:11px;color:#a8956e;text-transform:uppercase;letter-spacing:1px;font-weight:600">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                ${shippingRow}
                ${autoDiscRow}
                ${pointsRow}
                <tr style="background:#1a1200">
                  <td colspan="2" style="padding:14px;font-size:14px;font-weight:700;color:#f0e6d3;letter-spacing:.5px">Total Charged</td>
                  <td style="padding:14px;text-align:right;font-size:20px;font-weight:800;color:#f59e0b">$${grandTotal}</td>
                </tr>
              </tbody>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0">
              <tr><td style="border-top:1px solid #2a1f0a;font-size:0">&nbsp;</td></tr>
            </table>

            <!-- Delivery details -->
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:3px;text-transform:uppercase">Delivery Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#131009;border:1px solid #2a1f0a;border-radius:10px;padding:0">
              <tr>
                <td style="padding:10px 16px;color:#a8956e;font-size:13px;width:100px;vertical-align:top">Recipient</td>
                <td style="padding:10px 16px;color:#f0e6d3;font-size:13px;font-weight:600">${name}</td>
              </tr>
              <tr style="border-top:1px solid #1e1608">
                <td style="padding:10px 16px;color:#a8956e;font-size:13px;vertical-align:top">Phone</td>
                <td style="padding:10px 16px;color:#f0e6d3;font-size:13px">${mobile}</td>
              </tr>
              <tr style="border-top:1px solid #1e1608">
                <td style="padding:10px 16px;color:#a8956e;font-size:13px;vertical-align:top">Address</td>
                <td style="padding:10px 16px;color:#f0e6d3;font-size:13px">${street}, ${city}, ${state}</td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0">
              <tr><td style="border-top:1px solid #2a1f0a;font-size:0">&nbsp;</td></tr>
            </table>

            <!-- Reward points -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1200;border:1px solid #f59e0b;border-opacity:.3;border-radius:10px">
              <tr>
                <td style="padding:18px 20px">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:2px">Reward Points</p>
                  <p style="margin:0;font-size:13px;color:#a8956e;line-height:1.7">You earned <strong style="color:#fcd34d">+${pointsEarned} points</strong> on this order &nbsp;&middot;&nbsp; Your new balance is <strong style="color:#fcd34d">${newRewardPoints ?? 0} points</strong></p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#070503;padding:24px 40px;text-align:center;border-top:1px solid #2a1f0a">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:3px;text-transform:uppercase">VORTREXYN</p>
            <p style="margin:0 0 10px;font-size:11px;color:#4a3a20;letter-spacing:1px">Online Grocery Store</p>
            <p style="margin:0;font-size:12px;color:#4a3a20">If you have any questions regarding your order, please reply to this email and our team will be happy to assist you.</p>
            <p style="margin:12px 0 0;font-size:11px;color:#2a1f0a">&copy; 2024 VORTREXYN Grocery Store. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  sendEmail(email, 'Order Confirmed — VORTREXYN Grocery', emailHtml)
    .catch(err => console.error('Email failed:', err));

  res.render('order-confirmation', {
    name, email, mobile, street, city, state,
    grandTotal, pointsEarned, newRewardPoints, newTotalOrders,
    pointsUsed: actualPointsUsed, discount: discount.toFixed(2),
    tier, newTier, newTotalPointsEarned
  });
});

module.exports = router;
