// ============================================================
// routes/cart.js — Shopping cart, checkout, and order processing
//
// The cart is stored entirely in the Express session (req.session.cart).
// It is a plain object keyed by product_id:
//   {
//     "42": { name: "Whole Milk", price: 2.99, quantity: 3, unit: "1L" },
//     "17": { name: "Cheddar",    price: 4.49, quantity: 1, unit: "200g" }
//   }
//
// Stock management strategy:
//   Stock is decremented in the DB as soon as items are added to the cart
//   (optimistic deduction). It is restored if items are removed or the
//   cart is cleared without completing checkout. This means stock shown
//   to other users reflects reserved (in-cart) quantities immediately.
//   Abandoned carts (session expiry) will leave stock under-counted —
//   consider a cron job to restore stock for expired sessions if needed.
//
// Checkout flow (4 steps):
//   Step 1: GET  /cart              → view cart
//   Step 2: GET  /cart/checkout     → delivery form
//           POST /cart/checkout     → save delivery info → redirect to payment
//   Step 3: GET  /cart/payment      → review order, enter points, pay
//           POST /cart/payment      → process order, award points, send email
//   Step 4: (rendered inline)       → order-confirmation.ejs
//
// Email: A branded HTML confirmation email is sent via config/mailer.js
// using Nodemailer (or equivalent). The email includes an inline SVG logo
// to avoid broken images in email clients.
// ============================================================

const express    = require('express');
const router     = express.Router();
const db         = require('../config/db');
const sendEmail  = require('../config/mailer'); // Nodemailer wrapper

// ── GET /cart — view cart ─────────────────────────────────────────────────────
// Renders the cart page showing all items currently in the session cart.
// If the session has no cart yet, defaults to an empty object.
router.get('/', (req, res) => {
  const cart = req.session.cart || {};
  res.render('cart', { cart });
});

// ── POST /cart/add — add item to cart ─────────────────────────────────────────
// Adds `qty` units of a product to the session cart.
//
// Logic:
//   1. Look up product in DB to get current stock and details.
//   2. Calculate how many units can actually be added (can't exceed
//      current in_stock minus what's already reserved in this cart).
//   3. Deduct addQty from DB stock immediately (optimistic reservation).
//   4. Update session cart quantity (or create new cart entry).
//   5. Redirect back to the previous page.
//
// Edge cases:
//   - Product not found or 0 stock → redirect back silently.
//   - Requested qty > available stock → add only what's left (capped).
//   - Cart already has max stock → addQty = 0, skip without error.
router.post('/add', (req, res) => {
  const productId    = req.body.productId;
  const requestedQty = Math.max(1, parseInt(req.body.qty) || 1); // At least 1

  db.query('SELECT * FROM products WHERE product_id = ?', [productId], (err, results) => {
    if (err || results.length === 0) return res.redirect('back');

    const product = results[0];
    const inStock = parseInt(product.in_stock);
    if (inStock <= 0) return res.redirect('back'); // Truly out of stock

    if (!req.session.cart) req.session.cart = {};
    const cart       = req.session.cart;
    const currentQty = cart[productId] ? cart[productId].quantity : 0;

    // Only add what's actually available (remaining stock - already in cart)
    const addQty = Math.min(requestedQty, inStock - currentQty);
    if (addQty <= 0) return res.redirect('back'); // Nothing to add

    // Deduct from DB stock immediately to prevent overselling to other sessions.
    // GREATEST(0, ...) is a safety floor so stock never goes negative.
    db.query(
      'UPDATE products SET in_stock = GREATEST(0, in_stock - ?) WHERE product_id = ?',
      [addQty, productId],
      () => {}
    );

    // Update or create the cart entry for this product
    if (cart[productId]) {
      cart[productId].quantity += addQty;
    } else {
      cart[productId] = {
        name:     product.product_name,
        price:    product.unit_price,
        quantity: addQty,
        unit:     product.unit_quantity
      };
    }
    res.redirect('back');
  });
});

// ── POST /cart/update — change quantities or remove an item ───────────────────
// Handles two sub-actions depending on what the cart form submitted:
//
//   body.remove = productId → remove that single item, restore its stock
//   body.quantities = { productId: newQty, ... } → update quantities
//     - If new qty < old qty: restore the difference to DB stock
//     - If new qty > old qty: deduct the difference from DB stock
//     - If new qty ≤ 0: ignored (use the remove button instead)
router.post('/update', (req, res) => {
  if (!req.session.cart) return res.redirect('/cart');
  const cart             = req.session.cart;
  const updatedQuantities = req.body.quantities || {};
  const removeId          = req.body.remove;

  if (removeId && cart[removeId]) {
    // ── Remove a single item: restore its reserved stock ──
    const restoreQty = cart[removeId].quantity;
    db.query(
      'UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?',
      [restoreQty, removeId],
      () => {}
    );
    delete cart[removeId];

  } else {
    // ── Update quantities for all items ──
    for (let id in updatedQuantities) {
      const newQty = parseInt(updatedQuantities[id]);
      if (newQty > 0 && cart[id]) {
        const diff = cart[id].quantity - newQty; // Positive = user reduced qty
        if (diff > 0) {
          // User reduced qty → restore the freed stock to DB
          db.query(
            'UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?',
            [diff, id],
            () => {}
          );
        } else if (diff < 0) {
          // User increased qty → deduct the extra from DB stock
          // diff is negative here, so in_stock + diff = in_stock - |diff|
          db.query(
            'UPDATE products SET in_stock = GREATEST(0, in_stock + ?) WHERE product_id = ?',
            [diff, id],
            () => {}
          );
        }
        cart[id].quantity = newQty;
      }
    }
  }
  res.redirect('/cart');
});

// ── POST /cart/clear — empty the entire cart ──────────────────────────────────
// Restores all reserved stock back to DB before wiping the session cart.
// Called when the user clicks "Clear Cart" on the cart page.
router.post('/clear', (req, res) => {
  const cart = req.session.cart || {};
  for (let id in cart) {
    db.query(
      'UPDATE products SET in_stock = in_stock + ? WHERE product_id = ?',
      [cart[id].quantity, id],
      () => {}
    );
  }
  req.session.cart = {};
  res.redirect('/cart');
});

// ── GET /cart/checkout — delivery details form (step 2) ───────────────────────
// Guards against accessing checkout with an empty cart.
// Renders the delivery address form (views/delivery.ejs).
// If the user has a saved address, delivery.ejs pre-fills the form fields.
router.get('/checkout', (req, res) => {
  const cart = req.session.cart;
  if (!cart || Object.keys(cart).length === 0) return res.redirect('/cart');
  res.render('delivery');
});

// ── POST /cart/checkout — save delivery info (step 2 → step 3) ───────────────
// Saves the submitted delivery details to the session so the payment page
// can display them, then redirects to the payment page.
// If saveAddress is checked and the user is logged in, also stores the
// address in their session profile (Firestore sync happens client-side).
router.post('/checkout', (req, res) => {
  const { name, email, mobile, street, city, state, saveAddress } = req.body;
  const cart = req.session.cart;
  if (!cart || !Object.keys(cart).length) return res.redirect('/cart');

  // Persist delivery info to session for use on the payment page
  req.session.delivery = { name, email, mobile, street, city, state };

  // Optionally save address to user profile for future checkout pre-fill
  if (saveAddress && req.session.user) {
    req.session.user.savedAddress = { name, mobile, street, city, state };
  }
  res.redirect('/cart/payment');
});

// ── GET /cart/payment — payment & order review page (step 3) ─────────────────
// Shows the full order breakdown including:
//   - Cart items and subtotal
//   - Shipping cost (free threshold depends on loyalty tier)
//   - Tier auto-discount percentage
//   - Reward points balance and redemption calculator
//
// Tier privilege table:
//   Tier 1 Iron    → $0.50 per 10pts, no auto-discount, free ship @$50
//   Tier 2 Bronze  → $1.00 per 10pts, no auto-discount, free ship @$50
//   Tier 3 Silver  → $1.50 per 10pts, 5% auto-discount, free ship @$100
//   Tier 4 Gold    → $2.00 per 10pts, 10% auto-discount, free ship @$100
//   Tier 5 Diamond → $2.50 per 10pts, 15% auto-discount, free ship @$150
//   Tier 6 Titanium→ $3.00 per 10pts, 20% auto-discount, free ship always
//   Tier 7 Radiant → $3.50 per 10pts, 25% auto-discount, free ship always
router.get('/payment', (req, res) => {
  if (!req.session.delivery) return res.redirect('/cart/checkout');
  const cart = req.session.cart;
  if (!cart || !Object.keys(cart).length) return res.redirect('/cart');

  // Calculate subtotal from cart items
  let total = 0;
  for (let id in cart) total += parseFloat(cart[id].price) * cart[id].quantity;

  const delivery = req.session.delivery;
  const tier     = req.session.user ? (req.session.user.tier || 1) : 1;

  // Free shipping thresholds by tier (Tier 6+ = always free)
  const freeThreshold = tier >= 6 ? 0 : tier === 5 ? 150 : tier === 4 ? 100 : tier === 3 ? 100 : tier === 2 ? 50 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;

  // Dollar value earned per 10 reward points spent (increases with tier)
  const discountRate = tier >= 7 ? 3.50 : tier >= 6 ? 3.00 : tier === 5 ? 2.50 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;

  // Automatic percentage discount applied before points (Tier 3+)
  const autoDiscountPct = tier >= 7 ? 25 : tier >= 6 ? 20 : tier === 5 ? 15 : tier === 4 ? 10 : tier === 3 ? 5 : 0;

  res.render('payment', { delivery, cart, total, shipping, tier, discountRate, autoDiscountPct, freeThreshold });
});

// ── POST /cart/payment — process order and confirm (step 4) ──────────────────
// This is the heart of the checkout flow. It:
//   1. Recalculates all pricing server-side (never trust client totals).
//   2. Applies the tier auto-discount (Tier 3+).
//   3. Applies reward points redemption (capped by balance & order value).
//   4. Clears the cart and delivery info from session.
//   5. Updates reward points, order count, and tier in session.
//   6. Calculates whether the user has crossed into a new tier.
//   7. Builds and sends a branded HTML confirmation email.
//   8. Renders the order-confirmation page with all the summary data.
//
// NOTE: Points and tier are updated only in session here. Firestore
// persistence is handled by order-confirmation.ejs client-side after render.
router.post('/payment', (req, res) => {
  const delivery = req.session.delivery;
  const cart     = req.session.cart;
  if (!delivery || !cart || !Object.keys(cart).length) return res.redirect('/cart');

  const { name, email, mobile, street, city, state } = delivery;

  // ── Step 1: Recalculate subtotal server-side ──
  let total = 0;
  for (let id in cart) total += parseFloat(cart[id].price) * cart[id].quantity;

  // ── Step 2: Tier-based shipping and discount rates ──
  const tier          = req.session.user ? (req.session.user.tier || 1) : 1;
  const freeThreshold = tier >= 6 ? 0 : tier === 5 ? 150 : tier === 4 ? 100 : tier === 3 ? 100 : tier === 2 ? 50 : 50;
  const shipping      = total >= freeThreshold ? 0 : 5.99;
  const baseTotal     = total + shipping;
  const discountRate  = tier >= 7 ? 3.50 : tier >= 6 ? 3.00 : tier === 5 ? 2.50 : tier === 4 ? 2.00 : tier === 3 ? 1.50 : tier === 2 ? 1.00 : 0.50;
  const autoDiscPct   = tier >= 7 ? 25 : tier >= 6 ? 20 : tier >= 5 ? 15 : tier === 4 ? 10 : tier === 3 ? 5 : 0;

  // ── Step 3a: Apply tier auto-discount (Tier 3+) ──
  // Calculated on the base total (subtotal + shipping) before points
  const autoDiscount = autoDiscPct > 0 ? parseFloat((baseTotal * autoDiscPct / 100).toFixed(2)) : 0;
  const afterAuto    = parseFloat((baseTotal - autoDiscount).toFixed(2));

  // ── Step 3b: Apply reward points redemption ──
  // Points must be redeemed in multiples of 10.
  // Capped by: user's actual balance, and the maximum discount allowed
  // by the remaining order value (can't redeem more than the order total).
  const userBalance     = req.session.user ? (req.session.user.rewardPoints || 0) : 0;
  const requestedPoints = Math.floor(parseInt(req.body.pointsToUse) || 0);
  const maxByBalance    = Math.floor(userBalance / 10) * 10;         // Floor to multiple of 10
  const maxByTotal      = Math.floor(afterAuto / discountRate) * 10; // Max points that fit in total
  const actualPointsUsed = Math.min(
    Math.floor(requestedPoints / 10) * 10, // Round submitted value to multiple of 10
    maxByBalance,
    maxByTotal
  );

  // Discount amount = (points used / 10) × discountRate per tier
  const discount   = (actualPointsUsed / 10) * discountRate;
  const grandTotal = Math.max(0, afterAuto - discount).toFixed(2);

  // Points earned = £1 spent → 1 point (rounded down)
  const pointsEarned = Math.floor(parseFloat(grandTotal));

  // ── Step 4: Clear cart and delivery from session ──
  req.session.cart     = {};
  req.session.delivery = null;

  // ── Step 5: Update user stats in session ──
  let newRewardPoints      = null;
  let newTotalOrders       = null;
  let newTotalPointsEarned = null;
  let newTier              = tier;

  if (req.session.user) {
    // Deduct used points, add earned points (net balance update)
    req.session.user.rewardPoints = Math.max(0,
      (req.session.user.rewardPoints || 0) - actualPointsUsed + pointsEarned
    );
    req.session.user.totalOrders = (req.session.user.totalOrders || 0) + 1;

    // ── Step 6: Tier progression ──
    // Each tier has a lifetime-points threshold. When totalPointsEarned
    // crosses a threshold, the user advances to the next tier.
    // The while loop handles edge cases where a single order earns
    // enough points to skip multiple tiers at once (unlikely but possible).
    //
    // Tier thresholds (lifetime points earned within that tier):
    //   Tier 1 → 2: 500 pts   Tier 4 → 5: 3000 pts
    //   Tier 2 → 3: 1000 pts  Tier 5 → 6: 5000 pts
    //   Tier 3 → 4: 2000 pts  Tier 6 → 7: 8000 pts (max tier)
    const tierThresholds = { 1: 500, 2: 1000, 3: 2000, 4: 3000, 5: 5000, 6: 8000 };
    let earned      = (req.session.user.totalPointsEarned || 0) + pointsEarned;
    let currentTier = tier;

    while (currentTier < 7) {
      const threshold = tierThresholds[currentTier];
      if (earned >= threshold) {
        earned -= threshold;    // Carry over excess points into the new tier
        currentTier++;          // Advance tier
      } else {
        break; // Not enough points to advance further
      }
    }

    newTier = currentTier;
    req.session.user.tier              = currentTier;
    req.session.user.totalPointsEarned = earned; // Points within current tier

    // Snapshot the new values for passing to the confirmation page
    newRewardPoints      = req.session.user.rewardPoints;
    newTotalOrders       = req.session.user.totalOrders;
    newTotalPointsEarned = req.session.user.totalPointsEarned;
    newTier              = req.session.user.tier || tier;
  }

  // ── Step 7a: Build order summary HTML rows for email ──
  // Each cart item becomes a table row in the email body.
  const itemRows = Object.values(cart).map(item => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#f0e6d3;font-size:14px">${item.name}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#a8956e;font-size:14px;text-align:center">&times;${item.quantity}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #1e1608;color:#f59e0b;font-size:14px;text-align:right;font-weight:700">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`).join('');

  // Shipping row: green "FREE" label if free, amber cost if not
  const shippingRow = shipping > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#a8956e;font-size:13px">Shipping</td><td style="padding:8px 14px;text-align:right;color:#a8956e;font-size:13px">$${shipping.toFixed(2)}</td></tr>`
    : `<tr><td colspan="2" style="padding:8px 14px;color:#86efac;font-size:13px">Shipping</td><td style="padding:8px 14px;text-align:right;color:#86efac;font-size:13px;font-weight:600">FREE</td></tr>`;

  // Auto-discount row: only shown if the user's tier qualifies (Tier 3+)
  const autoDiscRow = autoDiscPct > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#fcd34d;font-size:13px">${autoDiscPct}% Auto-Discount Applied</td><td style="padding:8px 14px;text-align:right;color:#fcd34d;font-size:13px;font-weight:600">-$${autoDiscount.toFixed(2)}</td></tr>`
    : '';

  // Points redemption row: only shown if points were actually used
  const pointsRow = actualPointsUsed > 0
    ? `<tr><td colspan="2" style="padding:8px 14px;color:#86efac;font-size:13px">Reward Points Redeemed (${actualPointsUsed} pts)</td><td style="padding:8px 14px;text-align:right;color:#86efac;font-size:13px;font-weight:600">-$${discount.toFixed(2)}</td></tr>`
    : '';

  // ── Step 7b: Inline SVG logo for email ──
  // External images are blocked by most email clients, so the logo is
  // embedded as an inline SVG directly in the HTML. This is the Hex V logo
  // (Concept C) scaled down to 56×56px for the email header.
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

  // ── Step 7c: Assemble the full HTML email ──
  // Inline styles are required for email client compatibility.
  // Tables are used for layout (Outlook doesn't support flexbox/grid).
  // The "Night Market Glow" dark theme colours are used throughout:
  //   Background: #0c0a06   Surface: #131009   Primary: #f59e0b
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

            <!-- Reward points earned this order -->
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

  // ── Step 8: Send confirmation email (fire-and-forget) ──
  // We don't await the email — the order is already placed.
  // If email delivery fails, it's logged but doesn't affect the user.
  sendEmail(email, 'Order Confirmed — VORTREXYN Grocery', emailHtml)
    .catch(err => console.error('Email failed:', err));

  // ── Step 9: Render the confirmation page ──
  // order-confirmation.ejs also handles the Firestore update for
  // reward points and tier (client-side, after the page loads).
  res.render('order-confirmation', {
    name, email, mobile, street, city, state,
    grandTotal,
    pointsEarned,
    newRewardPoints,
    newTotalOrders,
    pointsUsed:          actualPointsUsed,
    discount:            discount.toFixed(2),
    tier,
    newTier,
    newTotalPointsEarned
  });
});

module.exports = router;
