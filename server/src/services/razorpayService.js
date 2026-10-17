const crypto = require('crypto');

/**
 * Minimal Razorpay client — orders, payment lookup and signature checks.
 * Uses the REST API directly (Node's built-in fetch) rather than the SDK,
 * since these four calls are all the checkout needs.
 *
 * Keys come from Settings → Payments and are passed in by the caller.
 */

const API = 'https://api.razorpay.com/v1';

function isReady(payments) {
  return payments.gateway === 'razorpay' && Boolean(payments.razorpayKeyId && payments.razorpayKeySecret);
}

async function request(payments, path, { method = 'GET', body } = {}) {
  const auth = Buffer.from(`${payments.razorpayKeyId}:${payments.razorpayKeySecret}`).toString('base64');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.description || `Razorpay request failed (${res.status})`);
    err.status = 502;
    throw err;
  }
  return data;
}

/** `amount` is in rupees; Razorpay wants paise. */
function createOrder(payments, { amount, currency, receipt, notes }) {
  return request(payments, '/orders', {
    method: 'POST',
    body: { amount: Math.round(Number(amount) * 100), currency: currency || 'INR', receipt, notes },
  });
}

async function fetchOrderPayments(payments, orderId) {
  const data = await request(payments, `/orders/${encodeURIComponent(orderId)}/payments`);
  return data.items || [];
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** The checkout handler's signature: HMAC-SHA256(order_id|payment_id, key secret). */
function verifyPaymentSignature(secret, orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook secret). */
function verifyWebhookSignature(secret, rawBody, signature) {
  if (!secret || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { isReady, createOrder, fetchOrderPayments, verifyPaymentSignature, verifyWebhookSignature };
