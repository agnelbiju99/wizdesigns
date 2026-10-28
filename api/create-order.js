import Razorpay from "razorpay";

const PRODUCTS = {
  "zero-to-trader": { name: "From Zero to Trader", amount: 28900 },
  "screener-guide": { name: "NSE Stock Screener Guide", amount: 39900 },
  "chart-setups-bible": { name: "Chart Setups Bible", amount: 14900 },
  "price-action-strategies": { name: "Price Action Strategies", amount: 14900 },
  "combo-all-4": { name: "Complete Bundle (All 4 Products)", amount: 74900 },
  "combo-all-4-planner": { name: "Complete Bundle + AI Money Coach Planner", amount: 99800 },
  "money-planner": { name: "AI Money Coach Planner", amount: 69900 },
  "combo-zero-screener": { name: "From Zero to Trader + NSE Screener Guide", amount: 54900 },
  "combo-price-chart": { name: "Price Action Strategies + Chart Setups Bible", amount: 17900 },
  "product-journey": { name: "What Is A Digital Product?", amount: 8900 },
};

// Scheduled price change: from 4 Nov 2026, 12:00 AM IST these amounts are charged instead.
// The website switches the prices it shows at the same moment.
const PRICE_CHANGE_AT = Date.parse("2026-11-03T18:30:00Z");
const NEW_AMOUNTS = {
  "zero-to-trader": 49900,
  "screener-guide": 69900,
  "chart-setups-bible": 29900,
  "price-action-strategies": 29900,
  "combo-all-4": 127900,
  "combo-all-4-planner": 152800,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productId } = req.body || {};
  const product = PRODUCTS[productId];

  if (!product) {
    return res.status(400).json({ error: "Invalid product" });
  }

  const amount = Date.now() >= PRICE_CHANGE_AT && NEW_AMOUNTS[productId] ? NEW_AMOUNTS[productId] : product.amount;

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await instance.orders.create({
      amount,
      currency: "INR",
      notes: { product: productId },
    });

    return res.status(200).json({
      orderId: order.id,
      amount,
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: product.name,
    });
  } catch (err) {
    console.error("Order creation failed:", err);
    return res.status(500).json({ error: "Could not create order" });
  }
}
