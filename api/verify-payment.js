// Called right after Razorpay Checkout succeeds, from the browser.
// Verifies the payment is genuinely valid, then returns the Drive
// download link(s) directly — no email step needed.
//
// Combos deliver multiple files, so every product maps to an ARRAY of
// { label, url } entries — single products just have one entry.

import crypto from "crypto";
import Razorpay from "razorpay";

const ZERO_TO_TRADER = "https://drive.google.com/file/d/1WUH-JyctTKCeYb7d5OA5NIgyymOKeBHJ/view?usp=sharing";
const SCREENER_GUIDE = "https://drive.google.com/file/d/1bCGHwBVjoOmcaCyIO5xd6bthgoT_7KH6/view?usp=sharing";
const CHART_SETUPS_BIBLE = "https://drive.google.com/drive/folders/1EsqJa6mxVbJ4f3QZl6uyzD7vbxFGnYxB?usp=drive_link";
const PRICE_ACTION_STRATEGIES = "https://drive.google.com/file/d/1ZGTOkevnGxMnDw8JH41OXJkJ9QB9F7pM/view?usp=sharing";

const PRODUCT_NAMES = {
  "zero-to-trader": "From Zero to Trader",
  "screener-guide": "NSE Stock Screener Guide",
  "chart-setups-bible": "Chart Setups Bible",
  "price-action-strategies": "Price Action Strategies",
  "combo-all-4": "Complete Bundle (All 4 Products)",
  "combo-zero-screener": "From Zero to Trader + NSE Screener Guide",
  "combo-price-chart": "Price Action Strategies + Chart Setups Bible",
};

const PRODUCT_FILES = {
  "zero-to-trader": [{ label: "From Zero to Trader", url: ZERO_TO_TRADER }],
  "screener-guide": [{ label: "NSE Stock Screener Guide", url: SCREENER_GUIDE }],
  "chart-setups-bible": [{ label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE }],
  "price-action-strategies": [{ label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES }],
  "combo-all-4": [
    { label: "From Zero to Trader", url: ZERO_TO_TRADER },
    { label: "NSE Stock Screener Guide", url: SCREENER_GUIDE },
    { label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE },
    { label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES },
  ],
  "combo-zero-screener": [
    { label: "From Zero to Trader", url: ZERO_TO_TRADER },
    { label: "NSE Stock Screener Guide", url: SCREENER_GUIDE },
  ],
  "combo-price-chart": [
    { label: "Price Action Strategies", url: PRICE_ACTION_STRATEGIES },
    { label: "Chart Setups Bible", url: CHART_SETUPS_BIBLE },
  ],
};

function driveDirectDownloadUrl(shareUrl) {
  // Folder links (multiple files inside) can't be auto-converted to a
  // direct download — just send the customer to the folder itself.
  if (shareUrl.includes("/drive/folders/")) {
    return shareUrl;
  }
  // Single-file links get converted to a direct-download URL.
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
  // tampered with (standard Razorpay signature check).
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

    if (!productId || !PRODUCT_FILES[productId]) {
      console.error("Unknown product on verified order:", razorpay_order_id);
      return res.status(400).json({ error: "Unknown product for this order" });
    }

    const files = PRODUCT_FILES[productId].map((f) => ({
      label: f.label,
      url: driveDirectDownloadUrl(f.url),
    }));

    return res.status(200).json({
      productName: PRODUCT_NAMES[productId],
      files,
    });
  } catch (err) {
    console.error("Order fetch failed:", err);
    return res.status(500).json({ error: "Could not verify order" });
  }
}
