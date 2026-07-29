// Called right after Razorpay Checkout succeeds, from the browser.
// Verifies the payment is genuinely valid, then returns the Drive
// download link directly — no email step needed.

import crypto from "crypto";
import Razorpay from "razorpay";

const DRIVE_LINKS = {
  "zero-to-trader": "https://drive.google.com/file/d/1WUH-JyctTKCeYb7d5OA5NIgyymOKeBHJ/view?usp=sharing",
  "screener-guide": "https://drive.google.com/file/d/1bCGHwBVjoOmcaCyIO5xd6bthgoT_7KH6/view?usp=sharing",
  "chart-setups-bible": "https://drive.google.com/file/d/1fJD-0DeBXaWZsQrmT8MB_RMNotEqJJfJ/view?usp=drive_link",
  "price-action-strategies": "https://drive.google.com/file/d/1ZGTOkevnGxMnDw8JH41OXJkJ9QB9F7pM/view?usp=sharing",
};

const PRODUCT_NAMES = {
  "zero-to-trader": "From Zero to Trader",
  "screener-guide": "NSE Stock Screener Guide",
  "chart-setups-bible": "Chart Setups Bible",
  "price-action-strategies": "Price Action Strategies",
};

function driveDirectDownloadUrl(shareUrl) {
  const match = shareUrl.match(/\/d\/([^/]+)/);
  const fileId = match ? match[1] : null;
  return fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : shareUrl;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  // Step 1: verify this response genuinely came from Razorpay and wasn't
  // tampered with (this is the standard Razorpay signature check).
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    console.error("Payment signature verification failed for order:", razorpay_order_id);
    return res.status(400).json({ error: "Payment verification failed" });
  }

  // Step 2: fetch the order from Razorpay directly (don't trust a
  // productId sent from the browser) to find out what was actually paid for.
  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await instance.orders.fetch(razorpay_order_id);
    const productId = order.notes?.product;

    if (!productId || !DRIVE_LINKS[productId]) {
      console.error("Unknown product on verified order:", razorpay_order_id);
      return res.status(400).json({ error: "Unknown product for this order" });
    }

    return res.status(200).json({
      productName: PRODUCT_NAMES[productId],
      downloadUrl: driveDirectDownloadUrl(DRIVE_LINKS[productId]),
    });
  } catch (err) {
    console.error("Order fetch failed:", err);
    return res.status(500).json({ error: "Could not verify order" });
  }
}
